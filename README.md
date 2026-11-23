# Tampermonkey Scripts（常用用户脚本仓库）

> 集中保存我在篡改猴（Tampermonkey）中使用的全部用户脚本，统一托管更新地址，并由每周自动任务检查上游版本、分析与优化后回写本仓库。

- **仓库**：[angussleeping/tampermonkey-scripts](https://github.com/angussleeping/tampermonkey-scripts)
- **脚本数量**：14 个（12 个第三方 / 2 个自有）
- **最近同步**：2026-11-23（首次每周闭环）

---

## 一、一次性配置（只做一次）

仓库里的脚本已经把 `@updateURL` / `@downloadURL` 指向本仓库的 raw 地址。**要让篡改猴改用这个地址，需要你操作一次**：

1. 打开篡改猴管理面板 → 「实用工具」→「导入」，选择本仓库 `scripts/` 下的 `.user.js`（或直接把 raw 链接粘进浏览器地址栏安装）；
2. 覆盖安装同名脚本即可。**`@namespace` 与 `@name` 均保持原样**，篡改猴会识别为同一个脚本，你原有的菜单设置与 `GM_setValue` 数据不会丢失；
3. 之后每周任务提交新版本时，篡改猴会自动检测到版本号变化并更新（也可在管理面板点「检查更新」手动触发）。

> 每个脚本有两个地址：`@updateURL` 指向 `meta/` 下轻量的 `.meta.js`（只含元数据，用于检查版本），`@downloadURL` 指向 `scripts/` 下完整的 `.user.js`。
> 如果 `raw.githubusercontent.com` 在你的网络下不可用，可把这两个地址整体替换为 jsDelivr 镜像：
> `https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/<文件名>.meta.js` 与 `https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/<文件名>.user.js`

## 二、每周自动更新机制

```
每周定时触发
  ├─ 1. 读取 scripts-manifest.json，按 upstream_meta / upstream_download 检查各脚本作者是否发布新版本
  ├─ 2. 上游有更新 → 拉取新版、做语法校验与差异对比
  ├─ 3. 分析与优化：自有脚本做实质优化；第三方脚本只做非破坏性检查（依赖地址可用性、@match/@grant 冗余、已知冲突）
  ├─ 4. 识别篡改猴中新增的脚本（读取最新导出文件或扩展存储），纳入本仓库
  ├─ 5. 提升版本号、更新 README / CHANGELOG / manifest，提交到 GitHub
  └─ 6. 篡改猴通过 @updateURL 检测到新版本 → 自动更新到本地
```

**关于「优化」的边界（重要）**：第三方大型脚本（如 Bilibili Evolved、LinkSwift、CSDNGreener）是作者长期维护的成熟项目，
随意改动其逻辑极易破坏功能，因此本仓库对它们**保持代码主体零改动**，优化集中在「同步上游最新版 + 元数据与依赖层面的非破坏性检查」，
且每次改动都会记入 CHANGELOG。实质性优化只作用于自有脚本。

## 三、脚本总览

| # | 脚本 | 作者 | 版本 | 分类 | 来源 |
|---|------|------|------|------|------|
| 1 | [GitHub Plus](#s1) | PRO-2684 | `0.7.1` | GitHub 增强 | 第三方 |
| 2 | [AC-baidu-重定向优化百度搜狗谷歌必应搜索_favicon_双列](#s2) | AC | `27.20` | 搜索与跳转 | 第三方 |
| 3 | [网盘自动填写访问码【威力加强版】](#s3) | 极品小猫 | `3.25.41.2` | 下载工具 | 第三方 |
| 4 | [Github Enhancement - High Speed Download](#s4) | X.I.U | `2.6.41` | GitHub 增强 | 第三方 |
| 5 | [AutoPager](#s5) | X.I.U | `6.6.75` | 通用浏览增强 | 第三方 |
| 6 | [LinkSwift](#s6) | Hmjz100、油小猴 | `1.1.3` | 下载工具 | 第三方 |
| 7 | [Bilibili Evolved](#s7) | Grant Howard, Coulomb-G | `2.12.0` | 站点增强 · 哔哩哔哩 | 第三方 |
| 8 | [GitHub 中文化（最全翻译版）](#s8) | Yujan | `2.18.2` | GitHub 增强 | 第三方 |
| 9 | [⭐网页瞬间加载/跳过进度条直接加载网页（附重定向链接优化）⭐](#s9) | fenda | `1.0.15` | 搜索与跳转 | 第三方 |
| 10 | [【最强无套路脚本】你能看见多少我能下载多少&下载公开免费的PPT、PDF、DOC、TXT等文件](#s10) | Mr.Fang | `7.8` | 下载工具 | 第三方 |
| 11 | [「CSDNGreener」🍃CSDN广告完全过滤\|免登录\|个性化排版\|最强老牌脚本\|持续更新](#s11) | Adler | `5.0.5` | 站点增强 · CSDN | 第三方 |
| 12 | [骚扰拦截](#s12) | airbash | `1.5.9` | 通用浏览增强 | 第三方 |
| 13 | [微博：按时间排序 + 屏蔽荐读并补齐空位](#s13) | WorkBuddy | `1.0.1` | 站点增强 · 微博 | 自有 |
| 14 | [知乎去广告 + 沉浸模式（精简优化版）](#s14) | shawn (原作) / 精简优化 | `2.1.1` | 站点增强 · 知乎 | 自有 |

---

## 四、逐脚本注释

<a id="s1"></a>

### 1. GitHub Plus

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/GitHub-Plus.user.js`](scripts/GitHub-Plus.user.js) |
| 作者 | PRO-2684 |
| 版本 | `0.7.1` |
| 许可证 | gpl-3.0 |
| 分类 | GitHub 增强 |
| 匹配规则 | 2 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：为 GitHub 增加额外功能，增强页面交互与信息展示。

**上游地址**：[项目/主页](https://greasyfork.org/scripts/510742) · [上游 meta](https://update.greasyfork.org/scripts/510742/GitHub%20Plus.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/GitHub-Plus.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/GitHub-Plus.user.js
```

<a id="s2"></a>

### 2. AC-baidu-重定向优化百度搜狗谷歌必应搜索_favicon_双列

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/AC-baidu-Redirect.user.js`](scripts/AC-baidu-Redirect.user.js) |
| 作者 | AC |
| 版本 | `27.20` |
| 许可证 | GPL-3.0-only |
| 分类 | 搜索与跳转 |
| 匹配规则 | 16 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：绕过百度 / 搜狗 / 谷歌 / 必应搜索结果的跳转链接，直达原始网页；附带 favicon 显示与双列布局。

**上游地址**：[项目/主页](https://greasyfork.org/zh-TW/scripts/14178) · [上游 meta](https://update.greasyfork.org/scripts/14178/AC-baidu-%E9%87%8D%E5%AE%9A%E5%90%91%E4%BC%98%E5%8C%96%E7%99%BE%E5%BA%A6%E6%90%9C%E7%8B%97%E8%B0%B7%E6%AD%8C%E5%BF%85%E5%BA%94%E6%90%9C%E7%B4%A2_favicon_%E5%8F%8C%E5%88%97.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/AC-baidu-Redirect.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/AC-baidu-Redirect.user.js
```

<a id="s3"></a>

### 3. 网盘自动填写访问码【威力加强版】

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Pan-Auto-Fill-Code.user.js`](scripts/Pan-Auto-Fill-Code.user.js) |
| 作者 | 极品小猫 |
| 版本 | `3.25.41.2` |
| 许可证 | GPL-3.0 License |
| 分类 | 下载工具 |
| 匹配规则 | 2 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：自动提取并填写网盘分享链接中的访问码，打开即自动提交，免去手动复制；并会记录已访问过的网盘信息。

**上游地址**：[项目/主页](https://greasyfork.org/scripts/29762) · [上游 meta](https://update.greasyfork.org/scripts/29762/%E7%BD%91%E7%9B%98%E8%87%AA%E5%8A%A8%E5%A1%AB%E5%86%99%E8%AE%BF%E9%97%AE%E7%A0%81%E3%80%90%E5%A8%81%E5%8A%9B%E5%8A%A0%E5%BC%BA%E7%89%88%E3%80%91.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Pan-Auto-Fill-Code.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Pan-Auto-Fill-Code.user.js
```

<a id="s4"></a>

### 4. Github Enhancement - High Speed Download

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Github-Enhancement-High-Speed-Download.user.js`](scripts/Github-Enhancement-High-Speed-Download.user.js) |
| 作者 | X.I.U |
| 版本 | `2.6.41` |
| 许可证 | GPL-3.0 License |
| 分类 | GitHub 增强 |
| 匹配规则 | 2 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：GitHub 高速下载：为 Git Clone/SSH、Release、Raw、Code(ZIP) 等提供加速与便捷入口。

**上游地址**：[项目/主页](https://github.com/XIU2/UserScript) · [上游 meta](https://update.greasyfork.org/scripts/412245/Github%20%E5%A2%9E%E5%BC%BA%20-%20%E9%AB%98%E9%80%9F%E4%B8%8B%E8%BD%BD.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Github-Enhancement-High-Speed-Download.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Github-Enhancement-High-Speed-Download.user.js
```

<a id="s5"></a>

### 5. AutoPager

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/AutoPager.user.js`](scripts/AutoPager.user.js) |
| 作者 | X.I.U |
| 版本 | `6.6.75` |
| 许可证 | GPL-3.0 License |
| 分类 | 通用浏览增强 |
| 匹配规则 | 1 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：自动无缝翻页，把下一页内容追加到当前页底部（瀑布流式浏览）。

**上游地址**：[项目/主页](https://github.com/XIU2/UserScript) · [上游 meta](https://update.greasyfork.org/scripts/419215/%E8%87%AA%E5%8A%A8%E6%97%A0%E7%BC%9D%E7%BF%BB%E9%A1%B5.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/AutoPager.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/AutoPager.user.js
```

<a id="s6"></a>

### 6. LinkSwift

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/LinkSwift.user.js`](scripts/LinkSwift.user.js) |
| 作者 | Hmjz100、油小猴 |
| 版本 | `1.1.3` |
| 许可证 | AGPL-3.0-or-later |
| 分类 | 下载工具 |
| 匹配规则 | 39 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：网盘文件下载地址获取工具，基于「网盘直链下载助手」修改，支持多种网盘。

**上游地址**：[项目/主页](https://github.com/hmjz100/LinkSwift/) · [上游代码](https://scriptcat.org/scripts/code/1604/LinkSwift.user.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/LinkSwift.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/LinkSwift.user.js
```

<a id="s7"></a>

### 7. Bilibili Evolved

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Bilibili-Evolved.user.js`](scripts/Bilibili-Evolved.user.js) |
| 作者 | Grant Howard, Coulomb-G |
| 版本 | `2.12.0` |
| 许可证 | MIT |
| 分类 | 站点增强 · 哔哩哔哩 |
| 匹配规则 | 1 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：功能全面的哔哩哔哩增强脚本，提供大量可配置的界面与功能改进。

**上游地址**：[项目/主页](https://github.com/the1812/Bilibili-Evolved) · [上游 meta](https://raw.githubusercontent.com/the1812/Bilibili-Evolved/master/dist/bilibili-evolved.user.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Bilibili-Evolved.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Bilibili-Evolved.user.js
```

<a id="s8"></a>

### 8. GitHub 中文化（最全翻译版）

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/GitHub-Zh-CN.user.js`](scripts/GitHub-Zh-CN.user.js) |
| 作者 | Yujan |
| 版本 | `2.18.2` |
| 许可证 | GPL-3.0 |
| 分类 | GitHub 增强 |
| 匹配规则 | 5 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：像「沉浸式翻译」那样把 GitHub 界面与内容译成简体中文，覆盖导航、弹窗、README、Issue、PR 等。

**上游地址**：[项目/主页](https://greasyfork.org/scripts/602755) · [上游 meta](https://update.greasyfork.org/scripts/602755/GitHub%20%E4%B8%AD%E6%96%87%E5%8C%96%EF%BC%88%E6%9C%80%E5%85%A8%E7%BF%BB%E8%AF%91%E7%89%88%EF%BC%89.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/GitHub-Zh-CN.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/GitHub-Zh-CN.user.js
```

<a id="s9"></a>

### 9. ⭐网页瞬间加载/跳过进度条直接加载网页（附重定向链接优化）⭐

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Skip-Progress-Bar.user.js`](scripts/Skip-Progress-Bar.user.js) |
| 作者 | fenda |
| 版本 | `1.0.15` |
| 许可证 | MPL-2.0 |
| 分类 | 搜索与跳转 |
| 匹配规则 | 1 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：跳过各类跳转进度条直接加载目标网页，并优化 / 移除重定向链接；参数可高度自定义。

**上游地址**：[项目/主页](https://greasyfork.org/scripts/493851) · [上游 meta](https://update.greasyfork.org/scripts/493851/%E2%AD%90%E7%BD%91%E9%A1%B5%E7%9E%AC%E9%97%B4%E5%8A%A0%E8%BD%BD%E8%B7%B3%E8%BF%87%E8%BF%9B%E5%BA%A6%E6%9D%A1%E7%9B%B4%E6%8E%A5%E5%8A%A0%E8%BD%BD%E7%BD%91%E9%A1%B5%EF%BC%88%E9%99%84%E9%87%8D%E5%AE%9A%E5%90%91%E9%93%BE%E6%8E%A5%E4%BC%98%E5%8C%96%EF%BC%89%E2%AD%90.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Skip-Progress-Bar.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Skip-Progress-Bar.user.js
```

<a id="s10"></a>

### 10. 【最强无套路脚本】你能看见多少我能下载多少&下载公开免费的PPT、PDF、DOC、TXT等文件

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Universal-Downloader.user.js`](scripts/Universal-Downloader.user.js) |
| 作者 | Mr.Fang |
| 版本 | `7.8` |
| 许可证 | Apache-2.0 |
| 分类 | 下载工具 |
| 匹配规则 | 47 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：批量下载公开免费的 PPT、PDF、DOC、TXT 等文库文档，覆盖众多文库站点。

**上游地址**：[项目/主页](https://greasyfork.org/scripts/486211) · [上游 meta](https://update.greasyfork.org/scripts/486211/%E3%80%90%E6%9C%80%E5%BC%BA%E6%97%A0%E5%A5%97%E8%B7%AF%E8%84%9A%E6%9C%AC%E3%80%91%E4%BD%A0%E8%83%BD%E7%9C%8B%E8%A7%81%E5%A4%9A%E5%B0%91%E6%88%91%E8%83%BD%E4%B8%8B%E8%BD%BD%E5%A4%9A%E5%B0%91%E4%B8%8B%E8%BD%BD%E5%85%AC%E5%BC%80%E5%85%8D%E8%B4%B9%E7%9A%84PPT%E3%80%81PDF%E3%80%81DOC%E3%80%81TXT%E7%AD%89%E6%96%87%E4%BB%B6.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Universal-Downloader.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Universal-Downloader.user.js
```

<a id="s11"></a>

### 11. 「CSDNGreener」🍃CSDN广告完全过滤|免登录|个性化排版|最强老牌脚本|持续更新

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/CSDNGreener.user.js`](scripts/CSDNGreener.user.js) |
| 作者 | Adler |
| 版本 | `5.0.5` |
| 许可证 | AGPL-3.0-or-later |
| 分类 | 站点增强 · CSDN |
| 匹配规则 | 1 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：CSDN 广告完全过滤、免登录复制、个性化排版；5.0 起为模块化重构版本。

**上游地址**：[项目/主页](https://greasyfork.org/scripts/378351) · [上游 meta](https://update.greasyfork.org/scripts/378351/%E3%80%8CCSDNGreener%E3%80%8D%F0%9F%8D%83CSDN%E5%B9%BF%E5%91%8A%E5%AE%8C%E5%85%A8%E8%BF%87%E6%BB%A4%7C%E5%85%8D%E7%99%BB%E5%BD%95%7C%E4%B8%AA%E6%80%A7%E5%8C%96%E6%8E%92%E7%89%88%7C%E6%9C%80%E5%BC%BA%E8%80%81%E7%89%8C%E8%84%9A%E6%9C%AC%7C%E6%8C%81%E7%BB%AD%E6%9B%B4%E6%96%B0.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/CSDNGreener.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/CSDNGreener.user.js
```

<a id="s12"></a>

### 12. 骚扰拦截

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Annoyances-Interception.user.js`](scripts/Annoyances-Interception.user.js) |
| 作者 | airbash |
| 版本 | `1.5.9` |
| 许可证 | GPL-3.0 |
| 分类 | 通用浏览增强 |
| 匹配规则 | 67 条 `@match` / `@include` |
| 来源 | 第三方 |

**作用**：自动拦截或删除下载弹窗、悬浮按钮等干扰元素，覆盖 CSDN、简书、知乎、百度等大量站点。

**上游地址**：[项目/主页](https://github.com/AirBashX/UserScript) · [上游 meta](https://update.greasyfork.org/scripts/440871/%E9%AA%9A%E6%89%B0%E6%8B%A6%E6%88%AA.meta.js)

**本仓库处理**：代码主体原样归档，仅注入本仓库更新地址；后续由每周任务同步作者更新。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Annoyances-Interception.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Annoyances-Interception.user.js
```

<a id="s13"></a>

### 13. 微博：按时间排序 + 屏蔽荐读并补齐空位

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Weibo-Chronological.user.js`](scripts/Weibo-Chronological.user.js) |
| 作者 | WorkBuddy |
| 版本 | `1.0.1` |
| 许可证 | 未标注（版权归原作者） |
| 分类 | 站点增强 · 微博 |
| 匹配规则 | 4 条 `@match` / `@include` |
| 来源 | 自有脚本 |

**作用**：自动切到「最新微博」按实际时间排序；隐藏信息流中的「荐读」卡片并让下方微博上移补齐空位。

**本仓库处理**：自有脚本，可直接做实质性优化与迭代。v1.0.1 起去除 1s / 4s 高频轮询，切换与隐藏改由 MutationObserver 事件驱动，仅保留 15s 低频兜底。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Weibo-Chronological.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Weibo-Chronological.user.js
```

<a id="s14"></a>

### 14. 知乎去广告 + 沉浸模式（精简优化版）

| 项 | 内容 |
|----|------|
| 文件 | [`scripts/Zhihu-AdClean-Focus.user.js`](scripts/Zhihu-AdClean-Focus.user.js) |
| 作者 | shawn (原作) / 精简优化 |
| 版本 | `2.1.1`（由 `2.1 (2026-11-23)` 规范化） |
| 许可证 | 未标注（版权归原作者） |
| 分类 | 站点增强 · 知乎 |
| 匹配规则 | 1 条 `@match` / `@include` |
| 来源 | 自有脚本 |

**作用**：去掉知乎广告并提供沉浸模式（隐藏侧栏、主栏加宽）；与「知乎增强」脚本共存、功能互补。

**本仓库处理**：自有脚本，可直接做实质性优化与迭代。v2.1.1 起样式注入改为幂等、菜单注册增加 API 存在性校验。

**本仓库更新地址**：

```
检查更新 (@updateURL)   : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Zhihu-AdClean-Focus.meta.js
下载代码 (@downloadURL) : https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Zhihu-AdClean-Focus.user.js
```

---

## 五、更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 六、致谢

本仓库只是托管与整理，**所有第三方脚本的著作权、许可与功劳完全归原作者所有**。
衷心感谢以下作者（按脚本顺序）：

| 脚本 | 作者 | 上游 |
|------|------|------|
| GitHub Plus | **PRO-2684** | [链接](https://greasyfork.org/scripts/510742) |
| AC-baidu-重定向优化百度搜狗谷歌必应搜索_favicon_双列 | **AC** | [链接](https://greasyfork.org/zh-TW/scripts/14178) |
| 网盘自动填写访问码【威力加强版】 | **极品小猫** | [链接](https://greasyfork.org/scripts/29762) |
| Github Enhancement - High Speed Download | **X.I.U** | [链接](https://github.com/XIU2/UserScript) |
| AutoPager | **X.I.U** | [链接](https://github.com/XIU2/UserScript) |
| LinkSwift | **Hmjz100、油小猴** | [链接](https://github.com/hmjz100/LinkSwift/) |
| Bilibili Evolved | **Grant Howard, Coulomb-G** | [链接](https://github.com/the1812/Bilibili-Evolved) |
| GitHub 中文化（最全翻译版） | **Yujan** | [链接](https://greasyfork.org/scripts/602755) |
| ⭐网页瞬间加载/跳过进度条直接加载网页（附重定向链接优化）⭐ | **fenda** | [链接](https://greasyfork.org/scripts/493851) |
| 【最强无套路脚本】你能看见多少我能下载多少&下载公开免费的PPT、PDF、DOC、TXT等文件 | **Mr.Fang** | [链接](https://greasyfork.org/scripts/486211) |
| 「CSDNGreener」🍃CSDN广告完全过滤\|免登录\|个性化排版\|最强老牌脚本\|持续更新 | **Adler** | [链接](https://greasyfork.org/scripts/378351) |
| 骚扰拦截 | **airbash** | [链接](https://github.com/AirBashX/UserScript) |

**作者名单（去重）**：**PRO-2684**、**AC**、**极品小猫**、**X.I.U**、**Hmjz100、油小猴**、**Grant Howard, Coulomb-G**、**Yujan**、**fenda**、**Mr.Fang**、**Adler**、**airbash**。

另有 2 个脚本由 WorkBuddy 辅助生成 / 优化（微博：按时间排序 + 屏蔽荐读并补齐空位、知乎去广告 + 沉浸模式（精简优化版）），基于 shawn 等原作者的开源作品二次改进。

同时感谢 GreasyFork、ScriptCat、GitHub 等平台，以及 Tampermonkey / Violentmonkey 脚本管理器。

---

> 若发现某个脚本失效、误伤或需要新增规则，欢迎提 Issue；仓库每周会自动检查上游更新。
