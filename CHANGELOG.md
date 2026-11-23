# 更新日志

每周自动任务会在此追加记录：上游版本变化、优化项、新增/移除脚本。

## 2026-11-23 — 仓库初始化

- 创建仓库 `angussleeping/tampermonkey-scripts`，归档篡改猴中全部 14 个脚本。
- 为每个脚本注入 `@updateURL`（指向 `meta/*.meta.js`）与 `@downloadURL`（指向 `scripts/*.user.js`）；原上游地址记录在脚本头注释与 `scripts-manifest.json` 中。
- 保留原 `@namespace` / `@name`，确保篡改猴覆盖安装时用户设置不丢失。
- 规范化非标准版本号：知乎去广告 + 沉浸模式（精简优化版） (`2.1 (2026-11-23)` → `2.1.0`)。
- 第三方脚本代码主体零改动；自有脚本（知乎去广告、微博按时间排序）沿用当前优化版本。
- 新增 `README.md`（逐脚本注释 + 作者致谢）、`scripts-manifest.json`（机器可读清单）、`tools/build_from_export.py`（重建工具）。
