# -*- coding: utf-8 -*-
"""
对仓库现有脚本应用「声明式优化补丁」（tools/optimizations.json）。

设计要点：
  1. 只做元数据层面的定点替换，不重写脚本、不碰代码主体；
  2. 幂等：重复运行不会重复插入 @grant、不会再次提升版本、不会重复替换 URL；
  3. 以仓库现有文件为准（不以可能过期的篡改猴导出文件重建），避免覆盖每周任务的成果；
  4. 重新生成全部 meta/*.meta.js（精简版），并刷新 README / CHANGELOG / manifest。

用法: python tools/apply_optimizations.py
"""
import json
import os
import re
import sys
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_from_export as B  # noqa: E402

SCRIPTS = os.path.join(ROOT, 'scripts')
META = os.path.join(ROOT, 'meta')
OPT_FILE = os.path.join(HERE, 'optimizations.json')
MAN_FILE = os.path.join(ROOT, 'scripts-manifest.json')

opt_all = json.load(open(OPT_FILE, encoding='utf-8'))
PATCHES = opt_all.get('patches', {})
SLIM = opt_all.get('meta_slim', {})
THRESHOLD = int((opt_all.get('policy') or {}).get('large_script_threshold_bytes', 204800))

man = json.load(open(MAN_FILE, encoding='utf-8'))
warnings = []


def read_code(path):
    raw = open(path, 'rb').read()
    return raw.decode('utf-8', errors='replace')


def write_code(path, code):
    with open(path, 'wb') as f:
        f.write(code.encode('utf-8'))


for entry in man['scripts']:
    slug = entry['file'][:-len('.user.js')]
    spath = os.path.join(SCRIPTS, entry['file'])
    mpath = os.path.join(META, entry['meta_file'])
    code = read_code(spath)
    opt = PATCHES.get(slug)
    applied = []

    if opt:
        # ---- 1. 版本提升 ----
        bump = (opt.get('version_bump') or '').strip()
        if bump:
            m = re.search(r'//[ \t]*@version[ \t]+(\S+)', code)
            cur = m.group(1) if m else ''
            if cur != bump:
                code = re.sub(r'(//[ \t]*@version[ \t]+)\S+', lambda mm: mm.group(1) + bump, code, count=1)
                if not entry.get('version_bumped_from'):
                    entry['version_bumped_from'] = cur
                print('  [ver ] %-44s %s -> %s' % (slug, cur, bump))
            entry['version'] = bump

        # ---- 2. 元数据替换 ----
        for rep in (opt.get('replace_meta') or []):
            field = rep.get('field')
            old = (rep.get('old') or '').strip()
            new = rep.get('new') or ''
            name = rep.get('name')
            if field == 'resource' and name:
                pat = re.compile(r'(//[ \t]*@resource[ \t]+' + re.escape(name) + r'[ \t]+)(\S+)')
            else:
                pat = re.compile(r'(//[ \t]*@' + re.escape(field) + r'[ \t]+)(\S+)')
            mm = pat.search(code)
            if not mm:
                warnings.append('%s: 未找到 @%s %s，跳过' % (slug, field, name or ''))
                print('  [WARN] %-42s 未找到 @%s %s' % (slug, field, name or ''))
            elif mm.group(2) == new:
                print('  [same] %-44s @%s 已是目标值' % (slug, field))
            elif mm.group(2) == old:
                code = code[:mm.start(2)] + new + code[mm.end(2):]
                print('  [repl] %-44s @%s%s' % (slug, field, (' ' + name) if name else ''))
            else:
                warnings.append('%s: @%s 当前值既非 old 也非 new（%s），未改动' % (slug, field, mm.group(2)[:60]))
                print('  [WARN] %-42s @%s 当前值不匹配预期' % (slug, field))
            applied.append({
                'field': field, 'name': name or '', 'old': old, 'new': new,
                'reason': rep.get('reason', ''),
            })

        # ---- 3. 补声明 @grant（仅增不减） ----
        declared = set(re.findall(r'//[ \t]*@grant[ \t]+(\S+)', code))
        nl = '\r\n' if '\r\n' in code else '\n'
        for g in (opt.get('add_grant') or []):
            if g in declared:
                print('  [same] %-44s @grant %s 已存在' % (slug, g))
            else:
                # 追加到最后一条 @grant 之后，并沿用该行的缩进，保持权限声明聚在一起
                last = None
                last_prefix = '// @grant        '
                for mm in re.finditer(r'^//[ \t]*@grant[ \t]+[^\r\n]*', code, re.M):
                    last = mm
                    pm = re.match(r'(//[ \t]*@grant[ \t]+)', mm.group(0))
                    if pm:
                        last_prefix = pm.group(1)
                grant_line = last_prefix + g
                if last:
                    cut = last.end()
                    code = code[:cut] + nl + grant_line + code[cut:]
                else:
                    anchor = '// ---------- 本副本由'
                    if anchor in code:
                        code = code.replace(anchor, grant_line + nl + anchor, 1)
                    else:
                        code = re.sub(r'(// ==/UserScript==)', grant_line + nl + r'\1', code, count=1)
                print('  [grant] %-43s + @grant %s' % (slug, g))
            applied.append({
                'field': 'grant', 'name': g, 'old': '(未声明)', 'new': g,
                'reason': opt.get('grant_reason', ''),
            })

        # ---- 4. 代码级补丁（仅限 < 200 KiB 的脚本） ----
        if code.count('\r\n'):
            nl2 = '\r\n'
        else:
            nl2 = '\n'
        if len(code.encode('utf-8')) <= THRESHOLD:
            code = B.apply_code_replacements(code, opt.get('replace_code'), applied, nl2)

    entry['optimized'] = bool(applied)
    entry['optimizations'] = applied
    size_now = len(code.encode('utf-8'))
    entry['size_bytes'] = size_now
    entry['oversize'] = size_now > THRESHOLD
    entry['meta_bytes'] = 0  # 稍后填

    write_code(spath, code)

    # ---- 4. 重新生成 meta ----
    # 大型脚本（> 200 KiB）按约定完全不动，meta 也保持原样；
    # 其余脚本的 meta 精简（仅保留版本判断所需字段）。
    mb = re.search(r'// ==UserScript==.*?// ==/UserScript==', code, re.S)
    meta_text = mb.group(0) if mb else code
    mnl = '\r\n' if '\r\n' in meta_text else '\n'
    if size_now > THRESHOLD:
        slimmed = meta_text
    else:
        slimmed = B.slim_meta(meta_text, SLIM)
    payload = (slimmed.rstrip('\r\n') + mnl).encode('utf-8')
    with open(mpath, 'wb') as f:
        f.write(payload)

    entry['meta_bytes'] = len(payload)

# ---- 5. 刷新 manifest 汇总字段 ----
per_matches = {}
for entry in man['scripts']:
    c = read_code(os.path.join(SCRIPTS, entry['file']))
    block = re.search(r'// ==UserScript==(.*?)// ==/UserScript==', c, re.S)
    blk = block.group(1) if block else ''
    per_matches[entry['file'][:-len('.user.js')]] = B.meta_values(blk, 'match') + B.meta_values(blk, 'include')

man['generated_at'] = datetime.date.today().isoformat()
man['script_count'] = len(man['scripts'])
man['large_script_threshold_bytes'] = THRESHOLD
man['site_overlaps'] = B.compute_overlaps(per_matches)

with open(MAN_FILE, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(man, f, ensure_ascii=False, indent=2)

B.write_readme(ROOT, man)
B.write_changelog(ROOT, man)

print()
print('=== 汇总 ===')
print('优化脚本: %d 个' % sum(1 for e in man['scripts'] if e.get('optimized')))
print('meta 合计: %.1f KB' % (sum(e['meta_bytes'] for e in man['scripts']) / 1024.0))
if warnings:
    print('警告:')
    for w in warnings:
        print('  -', w)
