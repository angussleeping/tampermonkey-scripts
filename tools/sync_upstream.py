#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每周上游同步：拉取各脚本的上游最新版 -> 重放优化补丁 -> 提升版本号 -> 写回仓库。

与 tools/apply_optimizations.py 的分工：
  本脚本负责「取上游新代码 + 生成新的版本号」，apply_optimizations.py 负责
  重放补丁表、重建 meta/*.meta.js 与 README/CHANGELOG。CI 中依次执行两者。

幂等与安全：
  1. 上游 @version 与 manifest 里的 original_version 一致时不改动该脚本；
  2. 只改元数据块（复用 build_from_export.patch_code），脚本主体原样保留；
  3. 上游地址 404 / 返回 HTML / 限流时跳过该脚本并告警，不让整个任务失败；
  4. 版本号一定严格大于当前仓库版本，保证篡改猴能感知更新。

用法:
    python tools/sync_upstream.py              # 同步全部脚本
    python tools/sync_upstream.py --dry-run    # 只打印将要发生的变更
    python tools/sync_upstream.py --only Bilibili-Evolved
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_from_export as B  # noqa: E402

SCRIPTS = os.path.join(ROOT, 'scripts')
MAN_FILE = os.path.join(ROOT, 'scripts-manifest.json')
OPT_FILE = os.path.join(HERE, 'optimizations.json')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36 tampermonkey-scripts-sync '
      '(+https://github.com/angussleeping/tampermonkey-scripts)')

BANNER_PATTERNS = [
    re.compile(r'^//\s*-{4,}\s*本副本由.*$', re.M),
    re.compile(r'^//\s*上游原地址:.*$', re.M),
    re.compile(r'^//\s*托管仓库:.*$', re.M),
]


def fetch(url, retries=3, timeout=30):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': UA,
                'Accept': 'text/plain, */*',
                'Cache-Control': 'no-cache',
            })
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
            if len(data) < 200:
                raise ValueError('响应过短（%d 字节）' % len(data))
            return data.decode('utf-8', errors='replace')
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
    raise last


def version_of(code):
    block = re.search(r'//\s*==UserScript==(.*?)//\s*==/UserScript==', code, re.S)
    if not block:
        return ''
    m = re.search(r'//\s*@version\s+(\S+)', block.group(1))
    return m.group(1) if m else ''


def parse_numbers(value):
    return [int(x) for x in re.findall(r'\d+', B.norm_version(value or ''))] or [0]


def is_newer(a, b):
    """a 是否严格大于 b（按数字段比较）。"""
    return B.is_version_newer(a, b)


def next_version(incoming, current):
    nums = parse_numbers(incoming)
    nums[-1] += 1
    candidate = '.'.join(str(n) for n in nums)
    if not is_newer(candidate, current):
        nums = parse_numbers(current)
        nums[-1] += 1
        candidate = '.'.join(str(n) for n in nums)
    return candidate


def strip_banner(code):
    for pattern in BANNER_PATTERNS:
        code = pattern.sub('', code)
    return code


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='只打印，不写文件')
    parser.add_argument('--only', action='append', default=[], help='仅同步指定脚本（可重复）')
    args = parser.parse_args()

    man = json.load(open(MAN_FILE, encoding='utf-8'))
    opt_all = json.load(open(OPT_FILE, encoding='utf-8'))
    patches = opt_all.setdefault('patches', {})

    updated, skipped, failed = [], [], []

    for entry in man['scripts']:
        slug = entry['file'][:-len('.user.js')]
        if not entry.get('enabled', True):
            continue
        if args.only and slug not in args.only:
            continue
        url = (entry.get('upstream_download') or entry.get('file_url') or '').strip()
        if not url or url.startswith('(无'):
            continue

        try:
            code = fetch(url)
        except Exception as exc:  # noqa: BLE001
            failed.append((slug, str(exc)))
            print('[skip] %-44s 拉取失败: %s' % (slug, exc))
            continue

        if '==UserScript==' not in code[:8192] or '==/UserScript==' not in code[:32768]:
            failed.append((slug, '返回内容不是用户脚本'))
            print('[skip] %-44s 返回内容不是用户脚本' % slug)
            continue

        incoming = version_of(code)
        if not incoming:
            failed.append((slug, '缺少 @version'))
            print('[skip] %-44s 上游缺少 @version' % slug)
            continue

        if not is_newer(incoming, entry.get('original_version') or '0'):
            skipped.append(slug)
            print('[same] %-44s 上游 %s，无需更新' % (slug, incoming))
            continue

        old_version = entry.get('version') or incoming
        target = next_version(incoming, old_version)
        if not is_newer(target, old_version):
            target = next_version(old_version, old_version)

        # 让 patch_code 使用本次计算出的目标版本，并把结果固化回优化补丁表
        B.OPT_PATCHES.setdefault(slug, {})['version_bump'] = target
        patches.setdefault(slug, {})['version_bump'] = target

        if not args.dry_run:
            entry['original_version'] = incoming
            entry['version'] = target

        patched, info = B.patch_code(
            strip_banner(code), slug,
            entry.get('upstream_meta', ''), url, entry.get('file_url', ''),
        )
        if '==/UserScript==' not in patched[:32768]:
            failed.append((slug, '打补丁后元数据块损坏'))
            print('[skip] %-44s 打补丁后元数据块损坏' % slug)
            continue

        if not args.dry_run:
            with open(os.path.join(SCRIPTS, entry['file']), 'wb') as f:
                f.write(patched.encode('utf-8'))
            bumped_from = info.get('version_bumped_from') or entry.get('original_version', '')
            if bumped_from:
                entry['version_bumped_from'] = bumped_from

        updated.append((slug, old_version, target, incoming))
        print('[sync] %-44s %s -> %s（上游 %s）%s' % (
            slug, old_version, target, incoming, '（仅演练）' if args.dry_run else ''))

    if not args.dry_run and updated:
        opt_all['updated_at'] = time.strftime('%Y-%m-%d')
        with open(OPT_FILE, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(opt_all, f, ensure_ascii=False, indent=2)
        man['generated_at'] = time.strftime('%Y-%m-%d')
        with open(MAN_FILE, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(man, f, ensure_ascii=False, indent=2)

    print()
    print('=== 汇总 ===')
    print('已同步: %d 个，跳过（无更新/无上游）: %d 个，失败: %d 个' % (
        len(updated), len(skipped), len(failed)))
    if failed:
        for slug, reason in failed:
            print('  - %s: %s' % (slug, reason))

    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a', encoding='utf-8') as f:
            f.write('changed=%s\n' % ('true' if updated else 'false'))


if __name__ == '__main__':
    main()
