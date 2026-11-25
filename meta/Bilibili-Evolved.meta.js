// ==UserScript==
// @name            Bilibili Evolved
// @description     强大的哔哩哔哩增强脚本
// @version         2.12.2
// @author          Grant Howard, Coulomb-G
// @copyright       2026, Grant Howard (https://github.com/the1812) & Coulomb-G (https://github.com/Coulomb-G)
// @license         MIT
// @match           *://*.bilibili.com/*
// @exclude         *://api.bilibili.com/*
// @exclude         *://api.*.bilibili.com/*
// @exclude         *://*.bilibili.com/api/*
// @exclude         *://member.bilibili.com/studio/bs-editor/*
// @exclude         *://t.bilibili.com/h5/dynamic/specification
// @exclude         *://bbq.bilibili.com/*
// @exclude         *://message.bilibili.com/pages/nav/header_sync
// @exclude         *://s1.hdslb.com/bfs/seed/jinkela/short/cols/iframe.html
// @exclude         *://b.bilibili.com/*
// @exclude         *://e.bilibili.com/*
// @exclude         *://ir.bilibili.com/*
// @exclude         *://jobs.bilibili.com/*
// @exclude         *://mcn.bilibili.com/*
// @exclude         *://open.bilibili.com/*
// @exclude         *://open-live.bilibili.com/*
// @exclude         *://play-live.bilibili.com/*
// @exclude         *://security.bilibili.com/*
// @run-at          document-start
// @grant           unsafeWindow
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_deleteValue
// @grant           GM_info
// @grant           GM_xmlhttpRequest
// @grant           GM_registerMenuCommand
// @grant           GM_unregisterMenuCommand
// @connect         raw.githubusercontent.com
// @connect         github.com
// @connect         cn.bing.com
// @connect         www.bing.com
// @connect         translate.google.cn
// @connect         translate.google.com
// @connect         localhost
// @connect         *
// @require         https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js#sha256=a9705dfc47c0763380d851ab1801be6f76019f6b67e40e9b873f8b4a0603f7a9
// @icon            https://cdn.jsdelivr.net/gh/the1812/Bilibili-Evolved@preview/images/logo-small.png
// @icon64          https://cdn.jsdelivr.net/gh/the1812/Bilibili-Evolved@preview/images/logo.png
// @updateURL    https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/Bilibili-Evolved.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/Bilibili-Evolved.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://raw.githubusercontent.com/the1812/Bilibili-Evolved/master/dist/bilibili-evolved.user.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
