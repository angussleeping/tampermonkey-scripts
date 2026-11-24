# 更新日志

每周自动任务会在此追加记录：上游版本变化、优化项、新增/移除脚本。

## 2026-11-24 — 更新地址迁移到 jsDelivr

- **背景**：本机 `raw.githubusercontent.com` 被 DevSidecar 代理拦截（`ERR_INVALID_PROTOCOL`），篡改猴经 raw 地址无法检查更新。
- **迁移**：全部 14 个脚本的 `@updateURL` / `@downloadURL` 改指 `https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/...`；`tools/build_from_export.py` 的 `RAW_BASE` / `META_BASE` 与 `scripts-manifest.json` 的 `raw_base` / `meta_base` 同步更新，重建时保持一致。
- **版本号**：14 个脚本统一 +1（如 `2.18.5` → `2.18.6`、`2.12.0` → `2.12.1`），使篡改猴按常规「更新」覆盖已安装脚本；不升版则旧安装仍指向 raw，无法自动检查更新。
- **缓存说明**：jsDelivr 对 `@master` 分支引用约 12 小时缓存，推送后可能延迟生效；本轮已用 jsDelivr purge 接口主动刷新。
- **校验**：全部 ≤ 200 KiB 脚本通过 `node --check`；14 个 meta 与 manifest 的版本、字节数一致。

## 2026-11-24 — 审查规则升级 + GitHub 中文化本地修复

- **审查规则**：每次审查都核对全部脚本（含 > 200 KiB 的 Bilibili Evolved、LinkSwift）的上游版本，并判断上游改动属于优化还是回归；本地优化（含代码补丁）仅限 ≤ 200 KiB 的脚本，> 200 KiB 只原样跟随上游。已同步更新 README 与 `tools/optimizations.json` 的 policy。
- **上游复查**：12 个第三方脚本全部核对完成；除已同步的 GitHub 中文化 `2.18.4` 外均无新版本，Bilibili Evolved `2.12.0`、LinkSwift `1.1.3` 与本地一致。
- **本地修复**：GitHub 中文化 `2.18.4` → `2.18.5`：上游搜索框守护只记录非中文输入，用户先输入英文再输入中文时，中文会被 500ms 逻辑还原成旧值（第 3033–3054 行）；改为仅信任用户真实输入（`e.isTrusted`），注入的中文仍会被还原。
- **工具链**：`build_from_export.py` / `apply_optimizations.py` 新增 `replace_code` 代码补丁支持（幂等，仅 ≤ 200 KiB）；补丁以声明式记录，重建时自动重放。
- **校验**：`node --check` 通过；补丁从上游 2.18.4 重放结果与本地文件一致；脚本 204758 字节，仍在 200 KiB 阈值内。

## 2026-11-24 — 每周同步

- **上游检查**：12 个第三方脚本全部完成版本核对；GitHub 中文化由 `2.18.2` 更新至 `2.18.4`，其余 11 个脚本无版本变化。
- **同步内容**：新版扩展搜索输入、搜索建议与命令面板的防误翻译规则，修正简介 / README 开关定位并清理残留按钮；保留本仓库 `@updateURL` / `@downloadURL`，第三方代码主体不做二次修改。
- **审查与校验**：阈值内 12 个脚本通过 `node --check`；42 个去重后的依赖、资源与图标地址最终均可访问，无需新增元数据补丁。两个自有脚本未发现本轮值得修改的明确问题，保持 `1.0.1` / `2.1.1`。
- **已知上游问题**：GitHub 中文化 `2.18.4` 的搜索框守护可能在已有非中文输入记录时误还原后续中文输入（第 3033–3054 行）；按第三方主体零改动规则仅记录，不在本地修补。
- **新增/移除脚本**：无；仓库仍共 14 个脚本。

## 2026-11-23 — 第三方脚本元数据审查与优化

按「> 200 KiB 视为大型脚本、不做改动」的阈值，对 12 个第三方脚本做了依赖与元数据的实证检查（HTTP 实测 + 代码行号比对）。

### GitHub Plus（`0.7.1` → `0.7.2`）

- `@icon`：`http://github.com/favicon.ico` → `https://github.com/favicon.ico`。图标为明文 http，在 https 页面属混合内容，可能被浏览器阻止加载。
- 补声明 `@grant GM_info`：脚本第 448 行使用 const { name, version } = GM_info.script，但 @grant 未声明 GM_info。

### AC-baidu-重定向优化百度搜狗谷歌必应搜索_favicon_双列（`27.20` → `27.21`）

- `@resource` `baiduLiteStyle`：`https://gitcode.net/-/snippets/1906/raw/master/LiteStyle.css?inline=false` → `https://ibaidu.tujidu.com/newcss/baiduLiteStyle.less?t=27.20`。原地址实测 HTTP 404（GitCode 资源下线/迁移）。替代地址为作者自有服务器上同命名规律的等效资源：实测 HTTP 200、60226 字节、文件头标注 Title: baidu-lite、含 #wrapper/.c-container/.result 等百度页面选择器，与另外 22 个 @resource 同域名同版本参数。
- 补声明 `@grant GM_info`：脚本第 405 行使用 GM_info.script.version，但 @grant 未声明 GM_info；在严格实现的管理器中该 API 不可用，会抛 TypeError。

### 未改动（大型脚本）

- LinkSwift（571 KB）：超过 200 KiB 阈值，按约定完全不动。
- Bilibili Evolved（1429 KB）：超过 200 KiB 阈值，按约定完全不动。

### 仓库侧优化

- 精简 `meta/*.meta.js`：剔除 data URI 图标、`@resource`、`@note` 等与版本判断无关的字段，14 个 meta 合计降至 41.0 KB（原约 100 KB）。不影响篡改猴的版本判断。
- 新增 `tools/optimizations.json`：声明式补丁表，`build_from_export.py` 重建时自动重放，重新导出也不会丢失优化。
- README 新增「依赖与元数据健康检查」「脚本共存与冲突排查」两章。


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
