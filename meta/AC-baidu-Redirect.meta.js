// ==UserScript==
// @name    AC-baidu-重定向优化百度搜狗谷歌必应搜索_favicon_双列
// @name:en    AC-baidu-google_sogou_bing_RedirectRemove_favicon_adaway_TwoLine
// @name:zh    AC-baidu-重定向优化百度搜狗谷歌必应搜索_favicon_双列
// @name:ja    AC-baidu-重定向最適化Baiduの搜狗のGoogleのBing検索結果のリダイレクト除去+favicon
// @description  1.繞過百度、搜狗、谷歌、好搜搜索結果中的自己的跳轉鏈接，直接訪問原始網頁-反正都能看懂 2.新增自定义网站拦截功能 3添加Favicon显示 4.页面CSS 5.添加计数 6.开关选择以上功能 7.自动翻页功能
// @description:en  1.bypass the redirect link at baidu\sogou\google\haosou; 2.remove ads at baidu; 3.add Favicon for each website; 4.render your own style; 5.counter; 6.Switch to handle all 7.Auto Pager
// @description:ja  1.迂回Baidu、Sogou、Google、Haosou検索検索結果の中の自分の遷移リンク; 2.Baiduの余分な広告を取り除く; 3.コメントを追加; 4.ページのカスタムCSP; 5.カウントを追加; 6.スイッチは以上の機能を選択します; 7.自動ページめくり.
// @icon    https://ae01.alicdn.com/kf/Hac1a58055c5047cdb91349e91aa208d5k.jpg
// @author     AC
// @license    GPL-3.0-only
// @create     2015-11-25
// @run-at     document-start
// @version    27.22
// @connect    baidu.com
// @connect    google.com
// @connect    google.com.hk
// @connect    google.com.jp
// @connect    bing.com
// @connect    duckduckgo.com
// @connect    dogedoge.com
// @connect    so.com
// @connect    localhost
// @connect    90dao.com
// @connect    *
// @include    *://ipv6.baidu.com/*
// @include    *://www.baidu.com/*
// @include    *://www1.baidu.com/*
// @include    *://m.baidu.com/*
// @include    *://xueshu.baidu.com/s*
// @include    *://www.so.com/s?*
// @include    *://*.bing.com/*
// @include    *://encrypted.google.*/search*
// @include    *://*.google*/search*
// @include    *://scholar.google.com/scholar*
// @include    *://*.google*/webhp*
// @include    *://*duckduckgo.com/*
// @include    *://*.dogedoge.com/*
// @include    *://*.90dao.com/*
// @include    *://*.tujidu.com/*
// @include    *://localhost*/*
// @exclude    *://*.google*/sorry*
// @exclude    https://zhidao.baidu.com/*
// @exclude    https://*.zhidao.baidu.com/*
// @exclude    https://www.baidu.com/img/*
// @exclude    https://lens.google.com/*
// @supportURL  https://joinqq.90dao.com
// @home-url   https://greasyfork.org/zh-TW/scripts/14178
// @home-url2  https://github.com/langren1353/GM_script
// @homepageURL  https://greasyfork.org/zh-TW/scripts/14178
// @copyright  2015-2026, AC
// @lastmodified  2026-06-18
// @feedback-url  https://github.com/langren1353/GM_script
// @require   https://registry.npmmirror.com/less_browser_fix/4.2.2/files/dist/less.min.js
// @require   https://registry.npmmirror.com/vue/3.5.26/files/dist/vue.runtime.global.prod.js
// @noframes
// @grant    GM_getValue
// @grant    GM.getValue
// @grant    GM_setValue
// @grant    GM.setValue
// @grant    GM_addStyle
// @grant    GM_getResourceURL
// @grant    GM_listValues
// @grant    GM.getResourceUrl
// @grant    GM_xmlhttpRequest
// @grant    GM_getResourceText
// @grant    GM_registerMenuCommand
// @grant    GM_addValueChangeListener
// @grant    unsafeWindow
// @grant    GM_info
// @namespace 1353464539@qq.com
// @updateURL    https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/meta/AC-baidu-Redirect.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/angussleeping/tampermonkey-scripts@master/scripts/AC-baidu-Redirect.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://update.greasyfork.org/scripts/14178/AC-baidu-%E9%87%8D%E5%AE%9A%E5%90%91%E4%BC%98%E5%8C%96%E7%99%BE%E5%BA%A6%E6%90%9C%E7%8B%97%E8%B0%B7%E6%AD%8C%E5%BF%85%E5%BA%94%E6%90%9C%E7%B4%A2_favicon_%E5%8F%8C%E5%88%97.meta.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
