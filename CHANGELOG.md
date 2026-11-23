# 更新日志

每周自动任务会在此追加记录：上游版本变化、优化项、新增/移除脚本。

## 2026-11-23 — 仓库初始化

- 创建仓库 `angussleeping/tampermonkey-scripts`，归档篡改猴中全部 14 个脚本。
- 为每个脚本注入 `@updateURL`（指向 `meta/*.meta.js`）与 `@downloadURL`（指向 `scripts/*.user.js`）；原上游地址记录在脚本头注释与 `scripts-manifest.json` 中。
- 保留原 `@namespace` / `@name`，确保篡改猴覆盖安装时用户设置不丢失。
- 规范化非标准版本号：知乎去广告 + 沉浸模式（精简优化版） (`2.1 (2026-11-23)` → `2.1.0`)。
- 第三方脚本代码主体零改动；自有脚本（知乎去广告、微博按时间排序）沿用当前优化版本。
- 新增 `README.md`（逐脚本注释 + 作者致谢）、`scripts-manifest.json`（机器可读清单）、`tools/build_from_export.py`（重建工具）。

## 2026-11-23 — 每周同步（首次闭环）

- **上游检查**：12 个第三方脚本逐一核对上游 `@version`，全部与本地一致（`0.7.1` / `27.20` / `3.25.41.2` / `2.6.41` / `6.6.75` / `1.1.3` / `2.12.0` / `2.18.2` / `1.0.15` / `7.8` / `5.0.5` / `1.5.9`），本周无需同步上游代码，第三方脚本主体与元数据零改动。
- **网络通道说明**：本机直连 `update.greasyfork.org` / `greasyfork.org` 超时、git 代理不转发该域名；改用独立网页读取通道拉取 10 个 `meta.js`，LinkSwift 由 git 代理访问 `scriptcat.org`、Bilibili Evolved 直连 `raw.githubusercontent.com`，最终 12/12 完成版本核对。
- **依赖与冲突检查**：15 个 `@require` URL 全部返回 HTTP 200（codeberg.org、registry.npmmirror.com、bowercdn.net、unpkg.com、raw.githubusercontent.com、s4.zstatic.net）；未发现跨脚本 GM 键名或菜单命令冲突。LinkSwift 存在 2 条重复 `@match`（pan.baidu.com / yun.baidu.com 的 timeline 规则），收益有限且可能系作者有意保留，按审慎原则保持原样。
- **优化（仅自有脚本）**：
  - 微博：按时间排序 + 屏蔽荐读并补齐空位 `1.0.0` → `1.0.1`：去除 1s / 4s 双高频轮询，切换与隐藏统一由 MutationObserver 事件驱动（400ms 节流），仅保留 15s 低频兜底；SPA 导航后立即重试切换。
  - 知乎去广告 + 沉浸模式（精简优化版） `2.1.0` → `2.1.1`：样式注入改为幂等（复用 `#zhihu-adclean-style`），菜单注册前校验 GM 菜单 API 存在性。
  - 两个脚本均通过 `node --check`，并同步更新对应 `meta/*.meta.js` 的 `@version`。
- **新增/移除脚本**：导出文件 `篡改猴脚本集合.txt` 含 14 个脚本，与 manifest 完全一致，未发现新增；本周无移除脚本。扩展存储兜底扫描发现若干历史/残留记录（如「新浪微博净化」「GitHub 中文化插件」「知乎增强」「CSDN免登录」等），因未出现在当前导出文件中，判定为旧版本残留，未纳入仓库。
- **检查失败项**：首轮批量 curl 探测因未使用 git 代理导致 12/12 超时；已按域名分通道重试并全部补齐，最终无遗留失败项。
