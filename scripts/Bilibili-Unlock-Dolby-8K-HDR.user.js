// ==UserScript==
// @name               Bilibili 解鎖杜比全景聲 & 8K & 開啟 HDR & 直播畫質PRO
// @name:zh-CN         Bilibili 解锁杜比全景声 & 8K & 开启 HDR & 直播画质PRO
// @version            2.7.1.1.14
// @description        為 B站 Windows 平台 解鎖杜比全景聲 & 8K &開啟 HDR &直播畫質PRO
// @description:zh-CN  为 B站 Windows 平台 解锁杜比全景声 & 8K &开启 HDR &直播画质PRO
// @author             AlexLI(tkp206093)
// @namespace          https://greasyfork.org/zh-TW/users/150638-tkp206093
// @homepageURL        https://greasyfork.org/zh-TW/scripts/441403
// @supportURL         https://greasyfork.org/zh-TW/scripts/441403/feedback
// @match              *://www.bilibili.com/blackboard/html5playerhelp*
// @match              *://www.bilibili.com/video*
// @match              *://www.bilibili.com/list*
// @match              *://www.bilibili.com/blackboard*
// @match              *://www.bilibili.com/watchlater*
// @match              *://www.bilibili.com/bangumi*
// @match              *://www.bilibili.com/watchroom*
// @match              *://www.bilibili.com/medialist*
// @match              *://www.bilibili.com/festival*
// @match              *://bangumi.bilibili.com*
// @match              *://live.bilibili.com/*
// @icon               https://www.bilibili.com/favicon.ico
// @license            MIT
// @run-at             document-start
// @grant              none
// @updateURL          https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/Bilibili-Unlock-Dolby-8K-HDR.meta.js
// @downloadURL        https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/Bilibili-Unlock-Dolby-8K-HDR.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://update.greasyfork.org/scripts/441403/Bilibili%20%E8%A7%A3%E9%8E%96%E6%9D%9C%E6%AF%94%E5%85%A8%E6%99%AF%E8%81%B2%20%208K%20%20%E9%96%8B%E5%95%9F%20HDR%20%20%E7%9B%B4%E6%92%AD%E7%95%AB%E8%B3%AAPRO.meta.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
(function () {
    'use strict';

    // B站播放器内置强制开关（等价于在设置里手动开启杜比全景声 / HDR）
    try {
        localStorage['bilibili_player_force_DolbyAtmos&8K&HDR'] = 1;
        localStorage.bilibili_player_force_hdr = 1;
    } catch (e) {
        // 隐私模式或站点数据被禁用时 localStorage 写入会抛异常，忽略即可
    }

    // 部分视频解码失败后，B站会写入 enableHEVCError 并全局回退、禁用所有 HEVC 内容；
    // 这里拦截该标记的读取来跳过回退逻辑，并带标记避免重复包装。
    try {
        var rawGetItem = sessionStorage.getItem;
        if (!rawGetItem.__hevcHook) {
            var hookedGetItem = function (key) {
                if (key === 'enableHEVCError') {
                    return undefined;
                }
                return rawGetItem.apply(this, arguments);
            };
            hookedGetItem.__hevcHook = true;
            sessionStorage.getItem = hookedGetItem;
        }
    } catch (e) {
        // sessionStorage 不可用时跳过
    }

    // 把 UA 伪装成 macOS Safari，让 B站网页播放器下发杜比 / 8K 等桌面端受限档位。
    // configurable 必须为 true：否则页面或其它脚本再次定义 navigator.userAgent 时会抛 TypeError。
    try {
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_8_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15'
        });
    } catch (e) {
        // 个别环境不允许重定义 navigator 属性，忽略
    }
})();
