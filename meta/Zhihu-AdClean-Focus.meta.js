// ==UserScript==
// @name         知乎去广告 + 沉浸模式（精简优化版）
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  基于 shawn 的 killZhihuAd 1.4 精简优化：只保留去广告与沉浸模式，去除 jQuery 依赖与高频定时器，改用 CSS 规则 + 语义选择器适配新版知乎。选择器已按登录态页面与知乎美化 1.5.24 校验。屏蔽文章/视频/站外直链由「知乎增强」负责，两者可共存。
// @author       shawn (原作) / 精简优化
// @icon         https://www.zhihu.com/static/favicon.ico
// @match        *://*.zhihu.com/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @updateURL    https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Zhihu-AdClean-Focus.meta.js
// @downloadURL  https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Zhihu-AdClean-Focus.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: (无，本站原创/本地脚本)
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
