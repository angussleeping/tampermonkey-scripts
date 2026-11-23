// ==UserScript==
// @name         微博：按时间排序 + 屏蔽荐读并补齐空位
// @namespace    https://workbuddy.cn/userscripts
// @version      1.0.1
// @description  自动切到「最新微博」按实际时间排序；隐藏信息流中的「荐读」卡片，并让下方微博自动上移、补齐空位
// @author       WorkBuddy
// @match        https://weibo.com/*
// @match        https://www.weibo.com/*
// @match        http://weibo.com/*
// @match        http://www.weibo.com/*
// @icon         https://weibo.com/favicon.ico
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/Weibo-Chronological.meta.js
// @downloadURL  https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/Weibo-Chronological.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: (无，本站原创/本地脚本)
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==

(function () {
    'use strict';

    // v1.0.1：切换与隐藏统一由 MutationObserver 事件驱动（400ms 节流），
    //         仅保留 15s 低频兜底；SPA 导航后立即重试切换，去除 1s / 4s 双高频轮询。

    /* ==================== 可调配置 ==================== */
    const CONFIG = {
        // 需要屏蔽的信息流标签文案（精确匹配，长度不超过 6 个字）
        // 默认只屏蔽「荐读」。若连「推荐」「广告」一起屏蔽，改为 ['荐读', '推荐', '广告']
        hideTags: ['荐读'],

        // 荐读徽标图标的 class 片段。微博改版后此值可能失效，但文字识别仍然有效。
        recommendIconClass: '_cross_1v5ao_',

        // 低频兜底扫描间隔（毫秒）。日常切换与隐藏均由 MutationObserver 事件驱动，
        // 此定时器仅用于整页替换 / 前端重绘等观察者未覆盖的场景（原为 1s + 4s 双轮询）。
        rescanInterval: 15000,

        // 两次自动点击之间的最小间隔，避免反复点击打回顶部
        clickCooldown: 5000,

        // 长时间找不到「最新微博」按钮时的兜底地址（微博的「最新微博」分组页）。
        // 留空字符串即可禁用该兜底。
        fallbackUrl: '/mygroups',
        fallbackAfter: 12000,
    };

    /* ==========================================================
     * 功能一：按实际时间排序（自动切到「最新微博」）
     * 参考 1.txt（新版：点击 div[title="最新微博"]）
     * ========================================================== */

    const startedAt = Date.now();

    function isHomePage() {
        const p = window.location.pathname;
        return p === '/' || p === '/home';
    }

    function findLatestButton() {
        // 优先按 title / aria-label 精确定位
        const byAttr = document.querySelector('[title="最新微博"], [aria-label="最新微博"]');
        if (byAttr && byAttr.offsetParent !== null) return byAttr;

        // 兜底：文本恰好是「最新微博」的最小可见元素
        const nodes = document.querySelectorAll('div, span, a, li, button');
        for (const el of nodes) {
            if ((el.textContent || '').trim() !== '最新微博') continue;
            if (el.offsetParent === null) continue; // 不可见
            return el;
        }
        return null;
    }

    let switchedFor = '';
    let lastClickAt = 0;
    let fallbackDone = false;

    // 「最新微博」切换由 DOM 变化事件驱动（见下方 MutationObserver），
    // 以 400ms 节流合并，取代原来每 1s 一次的 setInterval 高频轮询。
    let switchTimer = null;
    function scheduleSwitch() {
        if (switchTimer !== null) return;
        switchTimer = window.setTimeout(function () {
            switchTimer = null;
            trySwitchToLatest();
        }, 400);
    }

    function trySwitchToLatest() {
        if (!isHomePage()) return;

        const now = Date.now();
        if (switchedFor === window.location.href) return;
        if (now - lastClickAt >= CONFIG.clickCooldown) {
            const btn = findLatestButton();
            if (btn) {
                lastClickAt = now;
                switchedFor = window.location.href;
                try {
                    btn.click();
                } catch (err) {
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                return;
            }
        }

        // 兜底：长时间停留在首页且始终找不到按钮，直接跳到「最新微博」分组页
        if (!fallbackDone && CONFIG.fallbackUrl &&
            now - startedAt >= CONFIG.fallbackAfter) {
            fallbackDone = true;
            window.location.href = CONFIG.fallbackUrl;
        }
    }

    // SPA 导航后重置状态，保证再次回到首页时仍会自动切换
    function resetSwitchState() {
        switchedFor = '';
        scheduleSwitch();
    }
    window.addEventListener('popstate', resetSwitchState);
    const rawPushState = history.pushState;
    const rawReplaceState = history.replaceState;
    history.pushState = function () { resetSwitchState(); return rawPushState.apply(this, arguments); };
    history.replaceState = function () { resetSwitchState(); return rawReplaceState.apply(this, arguments); };

    /* ==========================================================
     * 功能二：隐藏「荐读」卡片，并让下方内容上移补齐空位
     * 参考 greasyfork 上两个屏蔽脚本的容器/标签选择器
     * ========================================================== */

    const HIDE_ATTR = 'data-wb-hide-recommend';

    // 用样式表隐藏：即使前端重绘时改写了元素的 style 属性也不会被覆盖；
    // display:none 会让该卡片退出文档流，下方微博自然上移、补齐空位。
    const hideStyle = document.createElement('style');
    hideStyle.textContent = '[' + HIDE_ATTR + '="1"]{display:none !important;}';
    (document.head || document.documentElement).appendChild(hideStyle);

    const handled = new WeakSet();

    function isSignal(el) {
        if (!el || el.nodeType !== 1) return false;
        const cls = typeof el.className === 'string' ? el.className : '';
        if (cls && cls.indexOf(CONFIG.recommendIconClass) !== -1) return true;
        const txt = (el.textContent || '').trim();
        return txt.length > 0 && txt.length <= 6 && CONFIG.hideTags.indexOf(txt) !== -1;
    }

    function findFeedItem(el) {
        let cur = el;
        for (let i = 0; i < 10 && cur && cur !== document.body; i++, cur = cur.parentElement) {
            const cls = typeof cur.className === 'string' ? cur.className : '';
            if (/Feed_item|feed-item|Feed_wrap|Card_wrap|card-wrap/i.test(cls)) return cur;
            const parent = cur.parentElement;
            const parentCls = parent && typeof parent.className === 'string' ? parent.className : '';
            if (parent && (parent.id === 'scroller' || /feed_list|feed-list/i.test(parentCls))) {
                return cur; // 信息流容器的直接子元素即为一整条卡片
            }
        }
        return null;
    }

    function hideCard(card) {
        if (!card || card === document.body || handled.has(card)) return;
        handled.add(card);
        card.setAttribute(HIDE_ATTR, '1');
    }

    function scan(root) {
        if (!root || root.nodeType !== 1) return;

        const signals = [];
        if (isSignal(root)) signals.push(root);
        const candidates = root.querySelectorAll('div, span, em, i, a, button, [class*="_cross_"]');
        for (const el of candidates) {
            if (isSignal(el)) signals.push(el);
        }

        for (const sig of signals) {
            const card = sig.closest('article') || findFeedItem(sig);
            hideCard(card);
        }
    }

    // 增量扫描：只处理新插入的节点，60ms 合并，避免频繁遍历
    let pending = [];
    let scanTimer = null;
    function scheduleScan(node) {
        pending.push(node);
        if (scanTimer !== null) return;
        scanTimer = window.setTimeout(function () {
            scanTimer = null;
            const roots = pending;
            pending = [];
            for (const r of roots) scan(r);
        }, 60);
    }

    const observer = new MutationObserver(function (mutations) {
        let hasNewNodes = false;
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    scheduleScan(node);
                    hasNewNodes = true;
                }
            }
        }
        // 「最新微博」按钮的出现同样是 DOM 变化，复用同一观察者，取代 1s 定时轮询
        if (hasNewNodes) scheduleSwitch();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 立即执行一次；此后由 MutationObserver 处理新增节点，仅保留一个 15s 低频兜底，
    // 去除原 1s / 4s 双定时器的持续开销。
    scan(document.body);
    trySwitchToLatest();
    window.setInterval(function () {
        trySwitchToLatest();
        scan(document.body);
    }, CONFIG.rescanInterval);

})();
