// ==UserScript==
// @name         GitHub 中文化（最全翻译版）
// @name:en      GitHub Chinese Translator
// @namespace    https://greasyfork.org/zh-CN/scripts/602755
// @version      2.18.6
// @description  像「沉浸式翻译」那样，把 GitHub 界面与内容全部译成简体中文：导航、下拉菜单、弹窗、工具提示、占位符、README、Issue、PR 等，动态出现的内容也会即时翻译。界面术语用本地词表精确翻译（零请求），长文本用多翻译源兜底。
// @description:en  Automatically translate GitHub UI and content into Simplified Chinese: precise local dictionary for UI terms, with online translation fallback for paragraphs, README and issues.
// @author       Yujan
// @match        https://github.com/*
// @match        https://gist.github.com/*
// @match        https://githubstatus.com/*
// @match        https://www.githubstatus.com/*
// @match        https://*.githubstatus.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      edge.microsoft.com
// @connect      api.cognitive.microsofttranslator.com
// @connect      translate.googleapis.com
// @connect      fanyi.youdao.com
// @connect      transmart.qq.com
// @connect      api.mymemory.translated.net
// @connect      fanyi-api.baidu.com
// @connect      tmt.tencentcloudapi.com
// @connect      api.siliconflow.cn
// @connect      open.bigmodel.cn
// @run-at       document-idle
// @license      GPL-3.0
// @updateURL    https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/GitHub-Zh-CN.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/GitHub-Zh-CN.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://update.greasyfork.org/scripts/602755/GitHub%20%E4%B8%AD%E6%96%87%E5%8C%96%EF%BC%88%E6%9C%80%E5%85%A8%E7%BF%BB%E8%AF%91%E7%89%88%EF%BC%89.meta.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
