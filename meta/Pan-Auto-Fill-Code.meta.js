// ==UserScript==
// @name            网盘自动填写访问码【威力加强版】
// @description	    智能融合网盘密码到网址中，打开网盘链接时不再需要手动复制密码，并自动提交密码，一路畅通无阻。同时记录网盘信息，当你再次打开该分享文件时，不再需要去找提取码，同时可追溯网盘地址的来源。
// @author          极品小猫
// @namespace       https://greasyfork.org/zh-CN/users/3128
// @version         3.25.41.3
//
// @include         http://*
// @include         https://*
//
// @exclude         https://*.12315.cn
// @exclude         http*://*.pcs.baidu.com/*
// @exclude         http*://*.baidupcs.com/*
// @exclude         http*://*:8666/file/*
// @exclude         http*://*.baidu.com/file/*
// @exclude         http*://index.baidu.com/*
//
// @exclude         http*://*.gov/*
// @exclude         http*://*.gov.cn/*
// @exclude         http*://*.taobao.com/*
// @exclude         http*://*.tmall.com/*
// @exclude         http*://*.alimama.com/*
// @exclude         http*://*.jd.com/*
// @exclude         http*://*.zol.com.cn/*
// @exclude         http*://*.ctrip.com/*
// @exclude         http*://*.evernote.com/*
// @exclude         http*://*.yinxiang.com/*
// @exclude         https://*.91huayi.com/*
// @exclude         http*://mail.*
// @exclude         http*://ping.*
// @exclude         http*://whois.*
// @exclude         http*://inbox.google.com/*
// @exclude         https://www.12377.cn/*
// @exclude         /^https?://(localhost|10\.|192\.|127\.)/
// @exclude         /https?://www.baidu.com/(?:s|baidu)\?/
// @exclude         http*://www.zhihu.com/question/*/answers/created
// @exclude         https://caiyun.feixin.10086.cn/portal/index.jsp#myfile*
// @require         https://bowercdn.net/c/jquery-2.1.4/dist/jquery.min.js
// @supportURL      https://scriptcat.org/script-show-page/373/issue
// @homepage         https://scriptcat.org/users/46868
// @icon            https://nd-static.bdstatic.com/m-static/wp-brand/favicon.ico

// @connect         agefans.tv
// @grant           unsafeWindow
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM_listValues
// @grant           GM_addStyle
// @grant           GM_xmlhttpRequest
// @grant           GM_notification
// @grant           GM_registerMenuCommand
// @grant           GM_info
// @noframes
// @encoding         utf-8
// @run-at          document-idle
// @license          GPL-3.0 License
// @updateURL    https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/Pan-Auto-Fill-Code.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/Pan-Auto-Fill-Code.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://update.greasyfork.org/scripts/29762/%E7%BD%91%E7%9B%98%E8%87%AA%E5%8A%A8%E5%A1%AB%E5%86%99%E8%AE%BF%E9%97%AE%E7%A0%81%E3%80%90%E5%A8%81%E5%8A%9B%E5%8A%A0%E5%BC%BA%E7%89%88%E3%80%91.meta.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
