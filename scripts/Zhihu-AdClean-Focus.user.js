// ==UserScript==
// @name         知乎去广告 + 沉浸模式（精简优化版）
// @namespace    http://tampermonkey.net/
// @version      2.1.2
// @description  基于 shawn 的 killZhihuAd 1.4 精简优化：只保留去广告与沉浸模式，去除 jQuery 依赖与高频定时器，改用 CSS 规则 + 语义选择器适配新版知乎。选择器已按登录态页面与知乎美化 1.5.24 校验。屏蔽文章/视频/站外直链由「知乎增强」负责，两者可共存。
// @author       shawn (原作) / 精简优化
// @icon         https://www.zhihu.com/static/favicon.ico
// @match        *://*.zhihu.com/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @updateURL    https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/Zhihu-AdClean-Focus.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/Zhihu-AdClean-Focus.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: (无，本站原创/本地脚本)
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==

/*
 * 精简说明（相对 killZhihuAd 1.4）
 * ---------------------------------------------------------------
 * 删除：
 *   - 「屏蔽文章」「屏蔽视频」两个菜单及 killArticleAndVedio()
 *     理由：知乎增强提供同类功能，且覆盖首页/搜索页/问题页/关注页、支持低赞联动，更完整。
 *     如需屏蔽文章/视频，请在「知乎增强」菜单的「屏蔽指定类别」中设置。
 *   - @require jQuery 3.4.1：改用原生 DOM + CSS，避免额外网络请求与全局 $ 污染。
 *   - 5 个 setInterval(500) 轮询：改用一次性注入的 CSS 规则，零轮询开销，且不惧 SPA 重渲染。
 *
 * 保留：
 *   - 去广告（信息流广告卡、顶部横幅、右栏广告、页脚信息）
 *   - 沉浸模式（隐藏侧栏 + 加宽主栏），开关键名沿用 focus_mode_on，兼容原有设置
 *   - link.zhihu.com 中间页直跳（该域名不在知乎增强的 @match 范围内，属独有功能）
 *
 * 优化：
 *   - 切换沉浸模式即时生效，不再 location.reload() 打断阅读
 *   - 沉浸模式由 html class 驱动，路由切换后依然有效
 *   - 增加 :has() 语义选择器与 RightSideBar 属性选择器，适配 2025 年后的知乎改版
 *   - 移除 updateURL/downloadURL，避免脚本管理器自动更新覆盖本地改动
 *
 * v2.1（登录态核验更新）
 *   - 广告选择器改用上游验证的复合写法 .Pc-card.Card（原 .Pc-card 过宽会误伤正常卡片）
 *   - 补齐首页活动广告 main.App-main > .Topstory > div:not(.Topstory-container)
 *   - 补齐各页侧栏隐藏规则：首页 .Topstory-mainColumn~div、问题页 .Question-mainColumn+div、
 *     搜索页 .SearchMain+div、收藏页、文章页；修复改为 CSS 后首页侧栏不隐藏的问题
 *   - 增加登录提示 .Question-mainColumnLogin 与文章页推荐 .Recommendations-Main 的屏蔽
 *   - 补窄屏自适应媒体查询，避免 960px 固定宽度在小屏溢出
 *
 * v2.1.1（每周维护）
 *   - 样式注入改为幂等：复用已存在的 #zhihu-adclean-style，避免重复执行时堆叠多份规则
 *   - 菜单注册前校验 GM 菜单 API 是否存在，兼容不支持菜单的脚本管理器
 */

(function () {
    'use strict';

    // ---- 1. 中间页直跳（原脚本独有，知乎增强不覆盖 link.zhihu.com） ----
    if (location.hostname === 'link.zhihu.com') {
        var m = location.search.match(/[?&]target=([^&]+)/);
        if (m) {
            try {
                location.replace(decodeURIComponent(m[1]));
            } catch (e) { /* 非法编码则保持原页，避免脚本中断 */ }
        }
        return;
    }

    // ---- 2. 样式注入 ----
    // 选择器来源：登录态实测 + 知乎美化 1.5.24（X.I.U，2026 仍在维护）的真实规则。
    // 注意：基础规则与 :has() 规则必须分开写。CSS 选择器列表中若有一条无效，
    // 整条规则会被丢弃；分开后即使浏览器不支持 :has()，基础规则仍然生效。
    var AD_BASIC_CSS = [
        '/* 信息流广告卡 */',
        '.TopstoryItem--advertCard,',
        '/* 回答页/首页广告卡（复合选择器，避免误伤普通 .Pc-card） */',
        '.Pc-card.Card,',
        '/* 顶部横幅广告 */',
        '.Pc-Business-Card-PcTopFeedBanner,',
        '/* 首页活动广告（Topstory 下非 container 的直接子层） */',
        'main.App-main > .Topstory > div:not(.Topstory-container),',
        '/* 登录提示（问题页中部） */',
        '.Question-mainColumnLogin,',
        '/* 文章页推荐 */',
        '.Recommendations-Main,',
        '/* 广告图片与页脚信息 */',
        '.AdvertImg,',
        '.Footer { display: none !important; }'
    ].join('\n');

    var AD_SEMANTIC_CSS = [
        '/* 右栏带广告标记的整体卡片（:has() 命中父卡，而非仅隐藏标记） */',
        '.Pc-card:has(.Banner-adTag),',
        '.TopstoryItem:has(.Banner-adTag),',
        '.TopstoryItem:has(.ecommerce-ad-box),',
        '.TopstoryItem:has(.RichText-Ecommerce) { display: none !important; }'
    ].join('\n');

    // 沉浸模式：按页面类型隐藏各自侧栏。选择器均为实测/上游维护版本中的真实写法。
    // 原脚本用 child[1].remove() 删首页侧栏，改为 CSS 后必须显式覆盖，否则首页侧栏不隐藏。
    var FOCUS_CSS = [
        '/* 首页：主列之后的侧栏 + 新版属性选择器 */',
        'html.zhihu-adclean-focus .Topstory-mainColumn~div,',
        'html.zhihu-adclean-focus [data-za-detail-view-path-module="RightSideBar"],',
        '/* 问题页：主列之后的侧栏 */',
        'html.zhihu-adclean-focus .Question-mainColumn+div,',
        'html.zhihu-adclean-focus .Question-sideColumn,',
        'html.zhihu-adclean-focus .GlobalSideBar,',
        '/* 搜索页 / 话题页 */',
        'html.zhihu-adclean-focus .SearchMain+div,',
        'html.zhihu-adclean-focus .SearchSideBar,',
        '/* 收藏页 */',
        'html.zhihu-adclean-focus .CollectionsDetailPage-mainColumn+div,',
        '/* 文章页右栏 */',
        'html.zhihu-adclean-focus .Post-Row-Content-right,',
        'html.zhihu-adclean-focus [data-za-module="RightSideBar"] { display: none !important; }',
        '/* 各页主列加宽并居中（宽 960，窄屏自适应） */',
        'html.zhihu-adclean-focus .Question-mainColumn,',
        'html.zhihu-adclean-focus .Topstory-mainColumn,',
        'html.zhihu-adclean-focus .SearchMain,',
        'html.zhihu-adclean-focus .QuestionWaiting-mainColumn,',
        'html.zhihu-adclean-focus .CollectionsDetailPage-mainColumn,',
        'html.zhihu-adclean-focus .Post-Row-Content-left {',
        '  width: 960px !important; max-width: 100% !important; margin: auto !important;',
        '}',
        'html.zhihu-adclean-focus .ContentItem-actions { width: 920px !important; max-width: 100% !important; }',
        '/* 容器兜底：确保主列容器不被旧宽度限制 */',
        'html.zhihu-adclean-focus .Topstory-container,',
        'html.zhihu-adclean-focus .Search-container { width: 960px !important; max-width: 100% !important; }',
        '@media only screen and (max-width: 1010px) {',
        '  html.zhihu-adclean-focus .Topstory-container,',
        '  html.zhihu-adclean-focus .Search-container,',
        '  html.zhihu-adclean-focus .Question-mainColumn,',
        '  html.zhihu-adclean-focus .Topstory-mainColumn,',
        '  html.zhihu-adclean-focus .SearchMain { width: 97% !important; }',
        '}'
    ].join('\n');

    // 幂等注入：脚本被重复执行 / SPA 场景下复用已有 <style>，避免堆叠多份 CSS 规则。
    var style = document.getElementById('zhihu-adclean-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'zhihu-adclean-style';
        (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = AD_BASIC_CSS + '\n' + AD_SEMANTIC_CSS + '\n' + FOCUS_CSS;

    // ---- 3. 沉浸模式开关 ----
    var FOCUS_KEY = 'focus_mode_on';
    var focusOn = GM_getValue(FOCUS_KEY, false) === true;
    var menuId = null;

    function applyFocus() {
        document.documentElement.classList.toggle('zhihu-adclean-focus', focusOn);
    }

    function renderMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return; // 管理器不支持菜单 API 时静默跳过
        if (menuId !== null && typeof GM_unregisterMenuCommand === 'function') {
            try { GM_unregisterMenuCommand(menuId); } catch (e) { /* 忽略注销失败 */ }
            menuId = null;
        }
        menuId = GM_registerMenuCommand(
            (focusOn ? '☑' : '☐') + ' 沉浸模式',
            function () {
                focusOn = !focusOn;
                GM_setValue(FOCUS_KEY, focusOn);
                applyFocus();
                renderMenu();
            }
        );
    }

    applyFocus();
    renderMenu();
})();
