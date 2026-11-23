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
RAW_BASE = "https://raw.githubusercontent.com/%s/%s/scripts/" % (REPO, BRANCH)
META_BASE = "https://raw.githubusercontent.com/%s/%s/meta/" % (REPO, BRANCH)
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
    """只改元数据块：替换 updateURL/downloadURL，规范 version，追加来源注释。"""
    lines = code.splitlines(keepends=True)
    nl = detect_newline(lines)
    try:
        start = next(i for i, l in enumerate(lines) if '==UserScript==' in l)
        end = next(i for i, l in enumerate(lines) if '==/UserScript==' in l)
    except StopIteration:
        return code, {}

    orig_update = ""
    orig_download = ""
    version_changed = None
    out = []
    for idx, raw in enumerate(lines):
        content = raw.rstrip('\r\n')
        if start < idx < end:
            m = re.match(r'^(\s*//\s*@)(\w[\w:-]*)(\s+)(.+)$', content)
            if m:
                key, value = m.group(2), m.group(4).strip()
                if key in ('updateURL', 'downloadURL'):
                    if key == 'updateURL':
                        orig_update = value
                    else:
                        orig_download = value
                    continue  # 删除原行，稍后统一替换
                if key == 'version':
                    nv = norm_version(value)
                    if nv != value:
                        version_changed = (value, nv)
                        out.append(m.group(1) + key + m.group(3) + nv + nl)
                        continue
        if idx == end:
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

    info = {
        'orig_updateURL': orig_update,
        'orig_downloadURL': orig_download,
        'version_changed': version_changed,
    }
    return ''.join(out), info


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
        with open(os.path.join(meta_dir, meta_fn), 'wb') as f:
            f.write((meta_text.rstrip('\r\n') + mnl).encode('utf-8'))

        upstream_meta = info['orig_updateURL'] or old_update
        upstream_download = info['orig_downloadURL'] or old_download or file_url
        upstream_page = derive_homepage(homepage, [old_update, old_download, file_url])

        manifest.append({
            'file': fn,
            'meta_file': meta_fn,
            'name': name.strip(),
            'author': author.strip(),
            'version': norm_version(version),
            'original_version': version.strip(),
            'license': license_.strip(),
            'category': CATEGORIES[i] if i < len(CATEGORIES) else '其他',
            'summary': SUMMARIES[i] if i < len(SUMMARIES) else desc[:80],
            'origin': 'self' if n in SELF_ORIGIN else 'third_party',
            'enabled': bool(s.get('enabled', True)),
            'size_bytes': len(patched.encode('utf-8')),
            'upstream_meta': upstream_meta.strip(),
            'upstream_download': upstream_download.strip(),
            'upstream_page': upstream_page.strip(),
            'file_url': file_url.strip(),
            'supportURL': support.strip(),
            'match_count': len(matches),
            'namespace': first(block, 'namespace', '').strip(),
            'version_normalized': bool(info['version_changed']),
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
        'scripts': manifest,
    }
    with open(os.path.join(root, 'scripts-manifest.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest_doc, f, ensure_ascii=False, indent=2)

    write_readme(root, manifest_doc)
    write_changelog(root, manifest_doc)
    return manifest_doc


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
    L.append('仓库里的脚本已经把 `@updateURL` / `@downloadURL` 指向本仓库的 raw 地址。**要让篡改猴改用这个地址，需要你操作一次**：')
    L.append('')
    L.append('1. 打开篡改猴管理面板 → 「实用工具」→「导入」，选择本仓库 `scripts/` 下的 `.user.js`（或直接把 raw 链接粘进浏览器地址栏安装）；')
    L.append('2. 覆盖安装同名脚本即可。**`@namespace` 与 `@name` 均保持原样**，篡改猴会识别为同一个脚本，你原有的菜单设置与 `GM_setValue` 数据不会丢失；')
    L.append('3. 之后每周任务提交新版本时，篡改猴会自动检测到版本号变化并更新（也可在管理面板点「检查更新」手动触发）。')
    L.append('')
    L.append('> 每个脚本有两个地址：`@updateURL` 指向 `meta/` 下轻量的 `.meta.js`（只含元数据，用于检查版本），`@downloadURL` 指向 `scripts/` 下完整的 `.user.js`。')
    L.append('> 如果 `raw.githubusercontent.com` 在你的网络下不可用，可把这两个地址整体替换为 jsDelivr 镜像：')
    L.append('> `https://cdn.jsdelivr.net/gh/%s@%s/meta/<文件名>.meta.js` 与 `https://cdn.jsdelivr.net/gh/%s@%s/scripts/<文件名>.user.js`' % (REPO, BRANCH, REPO, BRANCH))
    L.append('')
    L.append('## 二、每周自动更新机制')
    L.append('')
    L.append('```')
    L.append('每周定时触发')
    L.append('  ├─ 1. 读取 scripts-manifest.json，按 upstream_meta / upstream_download 检查各脚本作者是否发布新版本')
    L.append('  ├─ 2. 上游有更新 → 拉取新版、做语法校验与差异对比')
    L.append('  ├─ 3. 分析与优化：自有脚本做实质优化；第三方脚本只做非破坏性检查（依赖地址可用性、@match/@grant 冗余、已知冲突）')
    L.append('  ├─ 4. 识别篡改猴中新增的脚本（读取最新导出文件或扩展存储），纳入本仓库')
    L.append('  ├─ 5. 提升版本号、更新 README / CHANGELOG / manifest，提交到 GitHub')
    L.append('  └─ 6. 篡改猴通过 @updateURL 检测到新版本 → 自动更新到本地')
    L.append('```')
    L.append('')
    L.append('**关于「优化」的边界（重要）**：第三方大型脚本（如 Bilibili Evolved、LinkSwift、CSDNGreener）是作者长期维护的成熟项目，')
    L.append('随意改动其逻辑极易破坏功能，因此本仓库对它们**保持代码主体零改动**，优化集中在「同步上游最新版 + 元数据与依赖层面的非破坏性检查」，')
    L.append('且每次改动都会记入 CHANGELOG。实质性优化只作用于自有脚本。')
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
        L.append('**本仓库更新地址**：')
        L.append('')
        L.append('```')
        L.append('检查更新 (@updateURL)   : ' + META_BASE + m.get('meta_file', m['file'].replace('.user.js', '.meta.js')))
        L.append('下载代码 (@downloadURL) : ' + RAW_BASE + m['file'])
        L.append('```')
        L.append('')
    L.append('---')
    L.append('')
    L.append('## 五、更新日志')
    L.append('')
    L.append('见 [CHANGELOG.md](CHANGELOG.md)。')
    L.append('')
    L.append('## 六、致谢')
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


def write_changelog(root, doc):
    path = os.path.join(root, 'CHANGELOG.md')
    if os.path.exists(path):
        return
    today = doc['generated_at']
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
