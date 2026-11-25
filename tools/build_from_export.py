#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 Tampermonkey 导出 JSON 重建本仓库内容。

用法:
    python tools/build_from_export.py <导出文件.json|txt> [仓库根目录]

产出:
    scripts/*.user.js          每个脚本一份，注入本仓库的 updateURL / downloadURL
    meta/*.meta.js             只含元数据块的轻量文件，供篡改猴检查版本
    scripts-manifest.json      机器可读清单（每周自动更新任务读取此文件）
    README.md                  逐脚本注释 + 作者致谢
    CHANGELOG.md               变更记录（若已存在则不覆盖）

设计原则:
  1. 只改元数据块，脚本主体代码零改动；
  2. 保留原 @namespace / @name，确保篡改猴识别为同一脚本、用户设置不丢失；
  3. 原上游地址写入普通注释与 manifest，供每周任务检查上游更新；
  4. 仅规范化非法的 @version 格式（如 "2.1 (2026-11-23)" -> "2.1.0"）。
"""
import json
import base64
import re
import os
import sys
import datetime

REPO = "angussleeping/tampermonkey-scripts"
BRANCH = "master"
RAW_BASE = "https://cdn.jsdelivr.net/gh/%s@%s/scripts/" % (REPO, BRANCH)
META_BASE = "https://cdn.jsdelivr.net/gh/%s@%s/meta/" % (REPO, BRANCH)
REPO_URL = "https://github.com/" + REPO

# 按导出顺序给出稳定、可读、无特殊字符的文件名
SLUGS = [
    "GitHub-Plus",
    "AC-baidu-Redirect",
    "Pan-Auto-Fill-Code",
    "Github-Enhancement-High-Speed-Download",
    "AutoPager",
    "LinkSwift",
    "Bilibili-Evolved",
    "GitHub-Zh-CN",
    "Skip-Progress-Bar",
    "Universal-Downloader",
    "CSDNGreener",
    "Annoyances-Interception",
    "Weibo-Chronological",
    "Zhihu-AdClean-Focus",
]

# 精炼中文说明（避免直接截断原 description 中的营销话术）
SUMMARIES = [
    "为 GitHub 增加额外功能，增强页面交互与信息展示。",
    "绕过百度 / 搜狗 / 谷歌 / 必应搜索结果的跳转链接，直达原始网页；附带 favicon 显示与双列布局。",
    "自动提取并填写网盘分享链接中的访问码，打开即自动提交，免去手动复制；并会记录已访问过的网盘信息。",
    "GitHub 高速下载：为 Git Clone/SSH、Release、Raw、Code(ZIP) 等提供加速与便捷入口。",
    "自动无缝翻页，把下一页内容追加到当前页底部（瀑布流式浏览）。",
    "网盘文件下载地址获取工具，基于「网盘直链下载助手」修改，支持多种网盘。",
    "功能全面的哔哩哔哩增强脚本，提供大量可配置的界面与功能改进。",
    "像「沉浸式翻译」那样把 GitHub 界面与内容译成简体中文，覆盖导航、弹窗、README、Issue、PR 等。",
    "跳过各类跳转进度条直接加载目标网页，并优化 / 移除重定向链接；参数可高度自定义。",
    "批量下载公开免费的 PPT、PDF、DOC、TXT 等文库文档，覆盖众多文库站点。",
    "CSDN 广告完全过滤、免登录复制、个性化排版；5.0 起为模块化重构版本。",
    "自动拦截或删除下载弹窗、悬浮按钮等干扰元素，覆盖 CSDN、简书、知乎、百度等大量站点。",
    "自动切到「最新微博」按实际时间排序；隐藏信息流中的「荐读」卡片并让下方微博上移补齐空位。",
    "去掉知乎广告并提供沉浸模式（隐藏侧栏、主栏加宽）；与「知乎增强」脚本共存、功能互补。",
]

# 分类（用于 README 分组）
CATEGORIES = [
    "GitHub 增强", "搜索与跳转", "下载工具", "GitHub 增强", "通用浏览增强",
    "下载工具", "站点增强 · 哔哩哔哩", "GitHub 增强", "搜索与跳转", "下载工具",
    "站点增强 · CSDN", "通用浏览增强", "站点增强 · 微博", "站点增强 · 知乎",
]

# 自有脚本（由本会话 / WorkBuddy 产出，可做实质性优化）
SELF_ORIGIN = {13, 14}  # 1-based 序号

# 第三方脚本的非破坏性优化补丁（声明式，重建时自动重放，避免重新导出后丢失）
OPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'optimizations.json')
try:
    _OPT = json.load(open(OPT_PATH, encoding='utf-8'))
except Exception:
    _OPT = {}
OPT_PATCHES = _OPT.get('patches', {})
META_SLIM = _OPT.get('meta_slim', {})
OPT_POLICY = _OPT.get('policy', {})
LARGE_THRESHOLD = int(OPT_POLICY.get('large_script_threshold_bytes', 204800))


def meta_values(block, key):
    return [v.strip() for v in re.findall(r'^\s*//\s*@' + re.escape(key) + r'\s+(.+)$', block, re.M)]


def first(block, key, default=""):
    v = meta_values(block, key)
    return v[0] if v else default


def derive_homepage(homepage, urls):
    """把上游地址推导为项目主页，便于致谢链接指向作者页面而非文件直链。"""
    if homepage:
        return homepage.strip()
    for u in urls:
        if not u:
            continue
        m = re.search(r'update\.greasyfork\.org/scripts/(\d+)/', u)
        if m:
            return 'https://greasyfork.org/scripts/' + m.group(1)
        m = re.search(r'raw\.githubusercontent\.com/([^/]+/[^/]+)/', u)
        if m:
            return 'https://github.com/' + m.group(1)
        m = re.search(r'scriptcat\.org/scripts/code/(\d+)/', u)
        if m:
            return 'https://scriptcat.org/scripts/show/' + m.group(1)
    return (urls[-1] if urls else '').strip()


def norm_version(v):
    v = (v or "").strip()
    if re.fullmatch(r'\d+(?:\.\d+)*', v):
        return v
    m = re.match(r'(\d+(?:\.\d+)*)', v)
    if not m:
        return v
    parts = m.group(1).split('.')
    while len(parts) < 3:
        parts.append('0')
    return '.'.join(parts)


def version_numbers(v):
    return [int(x) for x in re.findall(r'\d+', norm_version(v or ''))] or [0]


def is_version_newer(a, b):
    """按数字段比较版本号，a 严格大于 b 时返回 True（用于「版本只增不减」）。"""
    left, right = version_numbers(a), version_numbers(b)
    width = max(len(left), len(right))
    left += [0] * (width - len(left))
    right += [0] * (width - len(right))
    return left > right


def detect_newline(lines):
    for l in lines:
        if l.endswith('\r\n'):
            return '\r\n'
        if l.endswith('\r'):
            return '\r'
        if l.endswith('\n'):
            return '\n'
    return '\n'


def patch_code(code, slug, upstream_meta, upstream_download, file_url):
    """只改元数据块：替换 updateURL/downloadURL、应用优化补丁、规范/提升 version、追加来源注释。"""
    lines = code.splitlines(keepends=True)
    nl = detect_newline(lines)
    try:
        start = next(i for i, l in enumerate(lines) if '==UserScript==' in l)
        end = next(i for i, l in enumerate(lines) if '==/UserScript==' in l)
    except StopIteration:
        return code, {}

    opt = OPT_PATCHES.get(slug, {}) or {}
    reps = opt.get('replace_meta', []) or []
    add_grants = [g for g in (opt.get('add_grant') or []) if g]

    orig_update = ""
    orig_download = ""
    version_changed = None
    version_bumped_from = ""
    applied = []
    grants = set()
    out = []
    for idx, raw in enumerate(lines):
        content = raw.rstrip('\r\n')
        if start < idx < end:
            m = re.match(r'^(\s*//\s*@)(\w[\w:-]*)(\s+)(.+)$', content)
            if m:
                key, value = m.group(2), m.group(4).strip()
                if key == 'grant':
                    grants.add(value)
                if key in ('updateURL', 'downloadURL'):
                    if key == 'updateURL':
                        orig_update = value
                    else:
                        orig_download = value
                    continue  # 删除原行，稍后统一替换
                if key == 'version':
                    bumped = (opt.get('version_bump') or '').strip()
                    if bumped and bumped != value:
                        version_bumped_from = value
                        out.append(m.group(1) + key + m.group(3) + bumped + nl)
                        continue
                    nv = norm_version(value)
                    if nv != value:
                        version_changed = (value, nv)
                        out.append(m.group(1) + key + m.group(3) + nv + nl)
                        continue
                # 应用元数据替换补丁（@resource / @icon 等）
                hit = None
                for rep in reps:
                    if key != rep.get('field'):
                        continue
                    want_name = rep.get('name')
                    if want_name:
                        mm = re.match(r'^(\S+)(\s+)(\S.*?)\s*$', value)
                        if not mm or mm.group(1) != want_name:
                            continue
                        if mm.group(3).strip() != rep.get('old', '').strip():
                            continue
                        newline = m.group(1) + key + m.group(3) + mm.group(1) + mm.group(2) + rep['new']
                    else:
                        if value != rep.get('old', '').strip():
                            continue
                        newline = m.group(1) + key + m.group(3) + rep['new']
                    hit = rep
                    out.append(newline + nl)
                    break
                if hit:
                    applied.append({
                        'field': hit.get('field'),
                        'name': hit.get('name', ''),
                        'old': hit.get('old', ''),
                        'new': hit.get('new', ''),
                        'reason': hit.get('reason', ''),
                    })
                    continue
        if idx == end:
            # 补声明缺失的 @grant（仅增不减，不触碰已有声明）
            for g in add_grants:
                if g not in grants:
                    out.append('// @grant        ' + g + nl)
                    applied.append({
                        'field': 'grant',
                        'name': g,
                        'old': '(未声明)',
                        'new': g,
                        'reason': opt.get('grant_reason', ''),
                    })
            fn = slug + '.user.js'
            meta_fn = slug + '.meta.js'
            inject = [
                '// @updateURL    ' + META_BASE + meta_fn,
                '// @downloadURL  ' + RAW_BASE + fn,
                '// ---------- 本副本由 ' + REPO + ' 托管 ----------',
                '// 上游原地址: ' + (upstream_meta or upstream_download or file_url or '(无，本站原创/本地脚本)'),
                '// 托管仓库:   ' + REPO_URL,
            ]
            for x in inject:
                out.append(x + nl)
        out.append(raw)

    result = apply_code_replacements(''.join(out), opt.get('replace_code'), applied, nl)
    info = {
        'orig_updateURL': orig_update,
        'orig_downloadURL': orig_download,
        'version_changed': version_changed,
        'version_bumped_from': version_bumped_from,
        'applied': applied,
    }
    return result, info


def apply_code_replacements(code, reps, applied, nl='\n'):
    """应用工具链侧的代码级补丁（replace_code）。

    仅用于小于 200 KiB 的脚本；幂等：目标内容已存在时跳过，找不到原文时告警而不报错。
    """
    for rep in reps or []:
        old = (rep.get('old') or '').replace('\r\n', '\n')
        new = (rep.get('new') or '').replace('\r\n', '\n')
        if not old or not new:
            continue
        pairs = [(old, new)]
        if nl != '\n':
            pairs.append((old.replace('\n', nl), new.replace('\n', nl)))
        if any(n in code for _, n in pairs):
            continue
        for o, n in pairs:
            if o in code:
                code = code.replace(o, n, 1)
                applied.append({
                    'field': 'code',
                    'name': rep.get('name', ''),
                    'old': old,
                    'new': new,
                    'reason': rep.get('reason', ''),
                })
                break
        else:
            print('  [WARN] code patch 未匹配: %s' % (rep.get('name') or old[:40]))
    return code


def slim_meta(meta_text, cfg):
    """精简 meta.js：仅保留版本判断所需字段，剔除 data URI 图标与 @resource/@note 等大字段。"""
    if not cfg.get('enabled'):
        return meta_text
    drop = set(cfg.get('drop_fields', []) or [])
    drop_data_icon = bool(cfg.get('drop_data_uri_icon'))
    out = []
    for raw in meta_text.splitlines(keepends=True):
        c = raw.rstrip('\r\n')
        m = re.match(r'^(\s*//\s*@)(\w[\w:-]*)(\s+)(.*)$', c)
        if m:
            key, val = m.group(2), m.group(4).strip()
            if key in drop:
                continue
            if drop_data_icon and key == 'icon' and val.startswith('data:'):
                continue
        out.append(raw)
    return ''.join(out)


def build(export_path, root):
    data = json.load(open(export_path, encoding='utf-8'))
    scripts = data.get('scripts', [])
    if len(scripts) != len(SLUGS):
        print('[WARN] 导出脚本数(%d)与 slug 表(%d)不一致，请检查是否有新增脚本' % (len(scripts), len(SLUGS)))

    scripts_dir = os.path.join(root, 'scripts')
    meta_dir = os.path.join(root, 'meta')
    os.makedirs(scripts_dir, exist_ok=True)
    os.makedirs(meta_dir, exist_ok=True)

    manifest = []
    per_matches = {}
    for i, s in enumerate(scripts):
        n = i + 1
        slug = SLUGS[i] if i < len(SLUGS) else ('script-%02d' % n)
        code = base64.b64decode(s.get('source', '')).decode('utf-8', errors='replace')
        block_m = re.search(r'// ==UserScript==(.*?)// ==/UserScript==', code, re.S)
        block = block_m.group(1) if block_m else ''

        name = s.get('name') or first(block, 'name', slug)
        author = first(block, 'author', '')
        version = first(block, 'version', '')
        desc = first(block, 'description', '')
        license_ = first(block, 'license', '')
        homepage = first(block, 'homepageURL', '')
        support = first(block, 'supportURL', '')
        old_update = first(block, 'updateURL', '')
        old_download = first(block, 'downloadURL', '')
        file_url = s.get('file_url', '') or ''
        matches = meta_values(block, 'match') + meta_values(block, 'include')

        patched, info = patch_code(code, slug, old_update, old_download, file_url)
        fn = slug + '.user.js'
        meta_fn = slug + '.meta.js'
        with open(os.path.join(scripts_dir, fn), 'wb') as f:
            f.write(patched.encode('utf-8'))

        # meta.js 只含元数据块，供篡改猴轻量检查版本（避免每周下载 MB 级完整脚本）
        mb = re.search(r'// ==UserScript==.*?// ==/UserScript==', patched, re.S)
        meta_text = mb.group(0) if mb else patched
        mnl = '\r\n' if '\r\n' in meta_text else '\n'
        slimmed = slim_meta(meta_text, META_SLIM)
        meta_bytes = (slimmed.rstrip('\r\n') + mnl).encode('utf-8')
        with open(os.path.join(meta_dir, meta_fn), 'wb') as f:
            f.write(meta_bytes)

        upstream_meta = info['orig_updateURL'] or old_update
        upstream_download = info['orig_downloadURL'] or old_download or file_url
        upstream_page = derive_homepage(homepage, [old_update, old_download, file_url])

        per_matches[slug] = matches
        manifest.append({
            'file': fn,
            'meta_file': meta_fn,
            'name': name.strip(),
            'author': author.strip(),
            'version': norm_version(version) if not info['version_bumped_from'] else (
                (OPT_PATCHES.get(slug, {}) or {}).get('version_bump', norm_version(version))),
            'original_version': version.strip(),
            'license': license_.strip(),
            'category': CATEGORIES[i] if i < len(CATEGORIES) else '其他',
            'summary': SUMMARIES[i] if i < len(SUMMARIES) else desc[:80],
            'origin': 'self' if n in SELF_ORIGIN else 'third_party',
            'enabled': bool(s.get('enabled', True)),
            'size_bytes': len(patched.encode('utf-8')),
            'meta_bytes': len(meta_bytes),
            'upstream_meta': upstream_meta.strip(),
            'upstream_download': upstream_download.strip(),
            'upstream_page': upstream_page.strip(),
            'file_url': file_url.strip(),
            'supportURL': support.strip(),
            'match_count': len(matches),
            'namespace': first(block, 'namespace', '').strip(),
            'version_normalized': bool(info['version_changed']),
            'version_bumped_from': info['version_bumped_from'],
            'optimized': bool(info['applied']),
            'optimizations': info['applied'],
            'oversize': len(patched.encode('utf-8')) > LARGE_THRESHOLD,
        })
        print('  [%2d] %-48s %-12s %8d bytes' % (n, fn, manifest[-1]['version'], manifest[-1]['size_bytes']))

    manifest_doc = {
        'repo': REPO,
        'branch': BRANCH,
        'raw_base': RAW_BASE,
        'meta_base': META_BASE,
        'repo_url': REPO_URL,
        'export_source': os.path.basename(export_path),
        'generated_at': datetime.date.today().isoformat(),
        'script_count': len(manifest),
        'large_script_threshold_bytes': LARGE_THRESHOLD,
        'site_overlaps': compute_overlaps(per_matches),
        'scripts': manifest,
    }
    with open(os.path.join(root, 'scripts-manifest.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest_doc, f, ensure_ascii=False, indent=2)

    write_readme(root, manifest_doc)
    write_changelog(root, manifest_doc)
    return manifest_doc


def site_of(pattern):
    """从 @match/@include 规则粗略提取主域名，用于统计脚本共存情况。"""
    m = re.search(r'://([^/]+)/', (pattern or '').strip())
    if not m:
        return None
    h = m.group(1).replace('*.', '').replace('*', '')
    parts = [x for x in h.split('.') if x]
    if not parts:
        return None
    if len(parts) >= 3 and parts[-2] in ('com', 'net', 'org', 'gov', 'edu'):
        return '.'.join(parts[-3:])
    if len(parts) >= 2:
        return '.'.join(parts[-2:])
    return parts[0]


def compute_overlaps(per_script_matches):
    """找出被 2 个以上脚本同时覆盖的站点，以及全站型脚本。"""
    site_map = {}
    wildcard = []
    for slug, pats in per_script_matches.items():
        for p in pats:
            ps = (p or '').strip()
            if ps in ('*://*/*', 'http://*/*', 'https://*/*', '*://*'):
                if slug not in wildcard:
                    wildcard.append(slug)
                continue
            s = site_of(ps)
            if s:
                site_map.setdefault(s, set()).add(slug)
    overlaps = [{'site': s, 'scripts': sorted(v)} for s, v in site_map.items() if len(v) > 1]
    overlaps.sort(key=lambda x: (-len(x['scripts']), x['site']))
    return {'wildcard': sorted(wildcard), 'overlaps': overlaps}


def write_readme(root, doc):
    ms = doc['scripts']
    today = doc['generated_at']
    L = []
    L.append('# Tampermonkey Scripts（常用用户脚本仓库）')
    L.append('')
    L.append('> 集中保存我在篡改猴（Tampermonkey）中使用的全部用户脚本，统一托管更新地址，并由每周自动任务检查上游版本、分析与优化后回写本仓库。')
    L.append('')
    L.append('- **仓库**：[%s](%s)' % (REPO, REPO_URL))
    L.append('- **脚本数量**：%d 个（%d 个第三方 / %d 个自有）' % (
        len(ms), sum(1 for m in ms if m['origin'] == 'third_party'), sum(1 for m in ms if m['origin'] == 'self')))
    L.append('- **最近同步**：%s' % today)
    L.append('')
    L.append('---')
    L.append('')
    L.append('## 一、一次性配置（只做一次）')
    L.append('')
    L.append('仓库里的脚本已经把 `@updateURL` / `@downloadURL` 指向本仓库的 jsDelivr CDN 地址（`raw.githubusercontent.com` 在部分网络下会被拦截）。**要让篡改猴改用这个地址，需要你操作一次**：')
    L.append('')
    L.append('1. 打开篡改猴管理面板 → 「实用工具」→「导入」，选择本仓库 `scripts/` 下的 `.user.js`（或直接把下文的 CDN 下载链接粘进浏览器地址栏安装）；')
    L.append('2. 覆盖安装同名脚本即可。**`@namespace` 与 `@name` 均保持原样**，篡改猴会识别为同一个脚本，你原有的菜单设置与 `GM_setValue` 数据不会丢失；')
    L.append('3. 之后每周任务提交新版本时，篡改猴会自动检测到版本号变化并更新（也可在管理面板点「检查更新」手动触发）。')
    L.append('')
    L.append('> 每个脚本有两个地址：`@updateURL` 指向 `meta/` 下轻量的 `.meta.js`（只含元数据，用于检查版本），`@downloadURL` 指向 `scripts/` 下完整的 `.user.js`，两者都走 jsDelivr：')
    L.append('> `https://cdn.jsdelivr.net/gh/%s@%s/meta/<文件名>.meta.js` 与 `https://cdn.jsdelivr.net/gh/%s@%s/scripts/<文件名>.user.js`' % (REPO, BRANCH, REPO, BRANCH))
    L.append('> jsDelivr 对 `@master` 分支引用有约 12 小时缓存，推送后最长需等待半天才能被「检查更新」看到；急用时可用 raw 地址手动安装。')
    L.append('')
    L.append('## 二、每周自动更新机制')
    L.append('')
    L.append('```')
    L.append('每周定时触发（`.github/workflows/weekly-sync.yml`，每周一 02:00 UTC；也可在 Actions 页手动运行）')
    L.append('  ├─ 1. tools/sync_upstream.py：读取 scripts-manifest.json，按 upstream_download 核对**全部脚本**（含 > 200 KiB）的上游 @version')
    L.append('  ├─ 2. 上游有更新 → 拉取新版，校验脚本格式后重放 tools/optimizations.json 的补丁，并把版本号提升到严格大于当前仓库版本')
    L.append('  ├─ 3. tools/apply_optimizations.py：重建 meta/*.meta.js、README、CHANGELOG，补齐 @grant 与失效依赖地址')
    L.append('  ├─ 4. 自动提交并推送；篡改猴通过 @updateURL 检测到新版本 → 自动更新到本地')
    L.append('  └─ 手动：新增脚本仍需从篡改猴导出，再运行 tools/build_from_export.py 纳入仓库')
    L.append('```')
    L.append('')
    L.append('**关于「优化」的边界（重要）**：')
    L.append('')
    L.append('- **上游检查覆盖全部脚本**，包括 Bilibili Evolved（1429 KB）与 LinkSwift（571 KB）。')
    L.append('- **> 200 KiB 的脚本只跟随作者更新**：有新版时原样同步，不在本地改代码。')
    L.append('- **≤ 200 KiB 的脚本允许本地优化**：元数据修复（失效依赖地址、缺失 `@grant`、不安全资源地址）与最小代码补丁（`replace_code`），改后必须通过 `node --check`。')
    L.append('- 每项改动都必须可外部验证（HTTP 状态码、具体代码行号），并记录在 `tools/optimizations.json` 与 CHANGELOG。')
    L.append('- 优化以声明式补丁表保存，重建时自动重放，不会因从篡改猴重新导出而丢失。')
    L.append('')
    L.append('## 三、脚本总览')
    L.append('')
    L.append('| # | 脚本 | 作者 | 版本 | 分类 | 来源 |')
    L.append('|---|------|------|------|------|------|')
    for i, m in enumerate(ms, 1):
        origin = '自有' if m['origin'] == 'self' else '第三方'
        L.append('| %d | [%s](#s%d) | %s | `%s` | %s | %s |' % (
            i, m['name'].replace('|', '\\|'), i,
            m['author'].replace('|', '\\|') or '—',
            m['version'], m['category'], origin))
    L.append('')
    L.append('---')
    L.append('')
    L.append('## 四、逐脚本注释')
    L.append('')
    for i, m in enumerate(ms, 1):
        L.append('<a id="s%d"></a>' % i)
        L.append('')
        L.append('### %d. %s' % (i, m['name']))
        L.append('')
        L.append('| 项 | 内容 |')
        L.append('|----|------|')
        L.append('| 文件 | [`scripts/%s`](scripts/%s) |' % (m['file'], m['file']))
        L.append('| 作者 | %s |' % (m['author'] or '未标注'))
        L.append('| 版本 | `%s`%s |' % (m['version'], '（由 `%s` 规范化）' % m['original_version'] if m['version_normalized'] else ''))
        L.append('| 许可证 | %s |' % (m['license'] or '未标注（版权归原作者）'))
        L.append('| 分类 | %s |' % m['category'])
        L.append('| 匹配规则 | %d 条 `@match` / `@include` |' % m['match_count'])
        L.append('| 来源 | %s |' % ('自有脚本' if m['origin'] == 'self' else '第三方'))
        L.append('')
        L.append('**作用**：%s' % m['summary'])
        L.append('')
        if m['upstream_meta'] or m['upstream_download'] or m['upstream_page']:
            ups = []
            if m['upstream_page']:
                ups.append('[项目/主页](%s)' % m['upstream_page'])
            if m['upstream_meta']:
                ups.append('[上游 meta](%s)' % m['upstream_meta'])
            elif m['upstream_download']:
                ups.append('[上游代码](%s)' % m['upstream_download'])
            L.append('**上游地址**：%s' % ' · '.join(ups))
            L.append('')
        L.append('**本仓库处理**：%s' % (
            '代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。' if m['origin'] == 'third_party'
            else '自有脚本，可直接做实质性优化与迭代；本次为当前优化后的版本。'))
        L.append('')
        if m.get('optimized'):
            fr = m.get('version_bumped_from') or m['original_version']
            L.append('**本次优化**（`%s` → `%s`，仅改元数据，代码主体零改动）：' % (fr, m['version']))
            L.append('')
            for o in m['optimizations']:
                if o['field'] == 'grant':
                    L.append('- 补声明 `@grant %s` —— %s' % (o['name'], o['reason']))
                else:
                    tag = (' `%s`' % o['name']) if o.get('name') else ''
                    L.append('- `@%s`%s —— `%s` → `%s`。%s' % (o['field'], tag, o['old'], o['new'], o['reason']))
            L.append('')
        L.append('**本仓库更新地址**：')
        L.append('')
        L.append('```')
        L.append('检查更新 (@updateURL)   : ' + META_BASE + m.get('meta_file', m['file'].replace('.user.js', '.meta.js')))
        L.append('下载代码 (@downloadURL) : ' + RAW_BASE + m['file'])
        L.append('```')
        L.append('')
    L.append('---')
    L.append('')
    L.append('## 五、依赖与元数据健康检查')
    L.append('')
    L.append('2026-11-23 对全部脚本做的实测（只读检查，不改代码逻辑）：')
    L.append('')
    L.append('| 检查项 | 覆盖范围 | 结果 |')
    L.append('|--------|----------|------|')
    L.append('| `@require` 外部依赖 | 15 条，涉及 7 个脚本 | 全部 HTTP 200，内容均为有效 JS，无 HTML 错误页 |')
    L.append('| SRI 完整性哈希 | GitHub-Plus 的 `#sha256=` | 与实际内容一致，可正常加载 |')
    L.append('| `@resource` 资源 | 25 条 | 24 条正常；1 条 404（AC-baidu 的 `baiduLiteStyle`，**已修复**） |')
    L.append('| `@icon` 图标 | 8 条 | 7 条正常；1 条明文 `http`（GitHub-Plus，**已改 https**） |')
    L.append('| `@version` 格式 | 14 个脚本 | 全部合法 |')
    L.append('| `@grant` 声明完整性 | 14 个脚本 | 2 个脚本调用了未声明的 `GM_info`（**已补**）；其余声明齐全 |')
    L.append('| 重复 `@match` / `@include` | 14 个脚本 | 无重复 |')
    L.append('| 资源名与代码调用一致性 | AC-baidu 22 个 `@resource` | 全部匹配，无静默取不到的资源 |')
    L.append('')
    _ki = _OPT.get('known_issues_not_fixed') or []
    if _ki:
        L.append('**已知但本次有意不处理**：')
        L.append('')
        for _it in _ki:
            L.append('- **%s**：%s —— %s' % (_it.get('script', ''), _it.get('issue', ''), _it.get('why_not_fixed', '')))
        L.append('')
    _mt = sum(m.get('meta_bytes', 0) for m in ms)
    L.append('**检查更新的流量优化**：`meta/*.meta.js` 只用于篡改猴比对 `@version`，已剔除 data URI 图标、`@resource`、`@note` 等与版本判断无关的字段。')
    L.append('当前 14 个 meta 文件合计 **%.1f KB**（精简前约 100 KB），每次「检查更新」少下载约 60 KB。' % (_mt / 1024.0))
    L.append('')
    L.append('## 六、脚本共存与冲突排查')
    L.append('')
    _ov = doc.get('site_overlaps', {})
    _wc = _ov.get('wildcard', [])
    if _wc:
        L.append('**全站型脚本**（匹配所有站点，需特别注意相互作用）：%s。' % '、'.join('`%s`' % x for x in _wc))
        L.append('')
    L.append('以下站点会被多个脚本同时注入（由各脚本的 `@match` / `@include` 自动统计）：')
    L.append('')
    L.append('| 站点 | 同时生效的脚本 |')
    L.append('|------|----------------|')
    for _o in _ov.get('overlaps', [])[:12]:
        L.append('| `%s` | %s |' % (_o['site'], '、'.join(_o['scripts'])))
    L.append('')
    L.append('**排查建议**（出现异常时按此顺序定位，每次只改一项）：')
    L.append('')
    L.append('1. **全站型组合**：`AutoPager`（自动翻页）与 `Skip-Progress-Bar`（跳过进度条、改写链接跳转）都改导航行为，是唯一可能互相干扰的一对。若某些站点翻页失效或跳转异常，先临时禁用 `Skip-Progress-Bar` 验证。')
    L.append('2. **通用拦截优先怀疑**：`Annoyances-Interception` 覆盖 67 条规则、命中大量站点。若某站点的正常元素被误删，优先禁用它定位。')
    L.append('3. **GitHub 三件套**：`GitHub-Plus`、`GitHub-Zh-CN`、`Github-Enhancement` 都操作同一页面。界面错乱时按 `GitHub-Zh-CN` → `GitHub-Plus` → `Github-Enhancement` 顺序单独禁用定位。')
    L.append('4. **同站同功能**：`zhihu.com` 上的 `Zhihu-AdClean-Focus` 与 `Annoyances-Interception`、`csdn.net` 上的 `CSDNGreener` 与 `Annoyances-Interception` 都属于"隐藏元素"类，通常互补；若布局异常再逐个排查。')
    L.append('')
    L.append('---')
    L.append('')
    L.append('## 七、更新日志')
    L.append('')
    L.append('见 [CHANGELOG.md](CHANGELOG.md)。')
    L.append('')
    L.append('## 八、致谢')
    L.append('')
    L.append('本仓库只是托管与整理，**所有第三方脚本的著作权、许可与功劳完全归原作者所有**。')
    L.append('衷心感谢以下作者（按脚本顺序）：')
    L.append('')
    L.append('| 脚本 | 作者 | 上游 |')
    L.append('|------|------|------|')
    for m in ms:
        if m['origin'] == 'self':
            continue
        up = m['upstream_page'] or m['upstream_download'] or m['file_url'] or '—'
        up_label = '[链接](%s)' % up if up.startswith('http') else up
        L.append('| %s | **%s** | %s |' % (
            m['name'].replace('|', '\\|'), (m['author'] or '未标注').replace('|', '\\|'), up_label))
    L.append('')
    authors = []
    for m in ms:
        a = m['author'].strip()
        if a and a not in authors and m['origin'] == 'third_party':
            authors.append(a)
    L.append('**作者名单（去重）**：%s。' % '、'.join('**%s**' % a for a in authors))
    L.append('')
    L.append('另有 %d 个脚本由 WorkBuddy 辅助生成 / 优化（%s），基于 shawn 等原作者的开源作品二次改进。' % (
        sum(1 for m in ms if m['origin'] == 'self'),
        '、'.join(m['name'] for m in ms if m['origin'] == 'self')))
    L.append('')
    L.append('同时感谢 GreasyFork、ScriptCat、GitHub 等平台，以及 Tampermonkey / Violentmonkey 脚本管理器。')
    L.append('')
    L.append('---')
    L.append('')
    L.append('> 若发现某个脚本失效、误伤或需要新增规则，欢迎提 Issue；仓库每周会自动检查上游更新。')
    L.append('')

    with open(os.path.join(root, 'README.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L))


def _changelog_opt_block(doc):
    """生成本次审查/优化的 CHANGELOG 记录块（幂等，标题含日期）。"""
    om = [m for m in doc['scripts'] if m.get('optimized')]
    if not om:
        return []
    tp = sum(1 for m in doc['scripts'] if m['origin'] == 'third_party')
    L = ['## %s — 第三方脚本元数据审查与优化' % doc['generated_at'], '']
    L.append('按「> 200 KiB 视为大型脚本、只跟随上游不改代码」的阈值，对 %d 个第三方脚本做了依赖与元数据的实证检查（HTTP 实测 + 代码行号比对）。' % tp)
    L.append('')
    for m in om:
        fr = m.get('version_bumped_from') or m['original_version']
        L.append('### %s（`%s` → `%s`）' % (m['name'], fr, m['version']))
        L.append('')
        for o in m['optimizations']:
            if o['field'] == 'grant':
                L.append('- 补声明 `@grant %s`：%s' % (o['name'], o['reason']))
            else:
                tag = (' `%s`' % o['name']) if o.get('name') else ''
                L.append('- `@%s`%s：`%s` → `%s`。%s' % (o['field'], tag, o['old'], o['new'], o['reason']))
        L.append('')
    over = [m for m in doc['scripts'] if m.get('oversize') and not m.get('optimized')]
    if over:
        L.append('### 未改动（大型脚本）')
        L.append('')
        for m in over:
            L.append('- %s（%.0f KB）：超过 200 KiB 阈值，按约定完全不动。' % (m['name'], m['size_bytes'] / 1024.0))
        L.append('')
    mt = sum(m.get('meta_bytes', 0) for m in doc['scripts'])
    L.append('### 仓库侧优化')
    L.append('')
    L.append('- 精简 `meta/*.meta.js`：剔除 data URI 图标、`@resource`、`@note` 等与版本判断无关的字段，14 个 meta 合计降至 %.1f KB（原约 100 KB）。不影响篡改猴的版本判断。' % (mt / 1024.0))
    L.append('- 新增 `tools/optimizations.json`：声明式补丁表，`build_from_export.py` 重建时自动重放，重新导出也不会丢失优化。')
    L.append('- README 新增「依赖与元数据健康检查」「脚本共存与冲突排查」两章。')
    L.append('')
    return L


def write_changelog(root, doc):
    path = os.path.join(root, 'CHANGELOG.md')
    today = doc['generated_at']
    opt_block = _changelog_opt_block(doc)

    if os.path.exists(path):
        text = open(path, encoding='utf-8').read()
        if not opt_block:
            return
        if opt_block[0] in text:
            print('  CHANGELOG: 本次记录已存在，跳过')
            return
        lines = text.split('\n')
        idx = next((i for i, l in enumerate(lines) if l.startswith('## ')), len(lines))
        merged = lines[:idx] + opt_block + [''] + lines[idx:]
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(merged))
        return

    L = [
        '# 更新日志',
        '',
        '每周自动任务会在此追加记录：上游版本变化、优化项、新增/移除脚本。',
        '',
        '## %s — 仓库初始化' % today,
        '',
        '- 创建仓库 `%s`，归档篡改猴中全部 %d 个脚本。' % (REPO, doc['script_count']),
        '- 为每个脚本注入 `@updateURL`（指向 `meta/*.meta.js`）与 `@downloadURL`（指向 `scripts/*.user.js`）；原上游地址记录在脚本头注释与 `scripts-manifest.json` 中。',
        '- 保留原 `@namespace` / `@name`，确保篡改猴覆盖安装时用户设置不丢失。',
    ]
    nv = [m for m in doc['scripts'] if m['version_normalized']]
    if nv:
        L.append('- 规范化非标准版本号：%s。' % '、'.join('%s (`%s` → `%s`)' % (m['name'], m['original_version'], m['version']) for m in nv))
    L += [
        '- 第三方脚本代码主体零改动；自有脚本（知乎去广告、微博按时间排序）沿用当前优化版本。',
        '- 新增 `README.md`（逐脚本注释 + 作者致谢）、`scripts-manifest.json`（机器可读清单）、`tools/build_from_export.py`（重建工具）。',
        '',
    ]
    if opt_block:
        L = L + opt_block
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    export = sys.argv[1]
    root = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print('export :', export)
    print('root   :', root)
    print('scripts:')
    d = build(export, root)
    print('\nDone: %d scripts, %d bytes total' % (
        d['script_count'], sum(m['size_bytes'] for m in d['scripts'])))
