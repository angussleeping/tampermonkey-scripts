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
// @version    27.20
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
// @note    2026.06-18-V27.20 修复百度错位的问题
// @note    2026.01-06-V27.19 修复百度、谷歌、必应的一些bug，增加页面加载动画，优化页面资源占用，避免大量的资源占用
// @note    2025.10-22-V27.18 修复谷歌、百度在不同缩放屏幕下导致的错位问题
// @note    2025.07-12-V27.17 修复谷歌单双列样式表问题、优化百度样式表；增加less.js资源，避免jsdelivr异常无法加载
// @note    2025.06-04-V27.15 修复谷歌单列、双列显示问题；修复谷歌使用百度Icon问题
// @note    2025.04-11-V27.14 修复百度灰度测试导致的重定向判定规则失效问题
// @note    2025.03-22-V27.13 修复google更新导致多列问题、修复百度翻页问题
// @note    2025.03-10-V27.12 修复duckduckGO 样式表问题；新增好搜页面双列支持
// @note    2025.03-07-V27.11 fix for less.js issue at high version browser, read html without head tag 
// @note    2025.03-04-V27.10 fix：谷歌百度模式显示效果；Less.js被Q的问题；谷歌第二页脚本问题；
// @note    2025.01-14-V27.09 fix：谷歌样式生效问题、谷歌显示字体问题、必应去广告失效导致的所有数据丢失问题
// @note    2024.11-17-V27.07 fix：谷歌排版问题、谷歌翻页后图片无效问题
// @note    2024.08-26-V27.06 fix：暗黑模式
// @note    2024.08-19-V27.05 fix：拦截功能、被拦截域名问题、和其他脚本兼容的CSS植入问题、优化域名检测逻辑；
// @note    2024.08-16-V27.04 修复：谷歌双列加载缓慢、双列效果优化、单列居中效果优化；bing页面bug修复；暗黑模式引入；编号、下划线功能修复；鸭鸭修复 & 勿忘国耻
// @note    2024.08-09-V27.03 增加字节跳动的Vue地址，避免部分地区打不开lib.baomitu.com导致的脚本无效
// @note    2024.08-06-V27.02 更换域名，解决SNI拦截问题；优化右侧栏显示逻辑-双列以上隐藏
// @note    2024.08-06-V27.01 重构-十周年优化版，优化项：1.重构设置功能，提供更强大的设置功能；2.极大优化页面加载动画效果；3.修复现有页面显示和效果（谷歌[主]、必应）单列、多列；4.兼容ViolentMonkey，兼容Firefox浏览器
// @note    2024.03-05-V26.10 fix: 谷歌白屏的问题；再次支持鸭鸭搜索引擎，鸭鸭三列支持；baidu\Google双列功能
// @note    2023.12-16-V26.07 日常维护；优化各页面加载卡顿的问题，优化搜索引擎显示效果
// @note    2023.06-19-V26.06 修复谷歌显示效果的错位问题等，修复谷歌异常白屏问题
// @note    2022.12-07-V26.04 修复必应错位问题；优化谷歌双列动画问题
// @note    2022.08-23-V26.03 修复因背景图引起的看不清字的问题;修复百度单列错位问题;修复google自定义按钮不可见
// @note    2022.08-23-V26.02 加快代码执行速度；减少动画撕裂；替换CDN的md5库
// @note    2022.08-22-V26.01 因甲癌手术和公司事务停更了2个月，目前补上，推荐更新。 1.修复百度加载缓慢的问题；2.修复谷歌样式加载顺序异常的问题；3.整体优化样式加载时间，更流畅了
// @note    2022.06-18-V25.09 修复可能出现的脚本参数读取失败导致的脚本不执行的异常 & 修复 拦截规则特殊参数的问题 & 更换CDN地址
// @note    2022.06-16-V25.06 优化重定向逻辑，部分网站只需要稍作处理，不用做接口请求了，感谢众多搜索引擎的版本迭代更新
// @note    2022.04-08-V25.05 主要修复Block功能；其次优化样式加载速度-减少撕裂感
// @note    2022.03-07-V25.04 修复谷歌、必应样式问题；修复并优化拦截功能
// @note    2022.01-29-V25.02 修复谷歌、百度、必应的部分样式错位的问题
// @note    2021.12-06-V25.01 修复百度样式偏左 & 修复谷歌样式显示
// @note    2021.10-31-V24.29 fixed Less requirement for faster Load
// @note    2021.10-29-V24.27 移除必应能选择的广告；增加自定义样式less的支持
// @note    2021.09-02-V24.26 修复必应多favicon，修复百度百科问题；修复谷歌一个小问题
// @note    2021.07-16-V24.25 修复一个bug；兼容百度下搜索股票tag；
// @note    2021.06-15-V24.24 更换cdn地址
// @note    2017.05.12 -> 2021.06-15 && V8.6 -> V24.24 各种各样的历史更新记录，从一个版本迭代到另一个版本
// @note    2017.05.12-V8.4 新增：默认屏蔽谷歌的安全搜索功能
// @note    2017.05.05-V8.3 修复include范围太小导致的百度知道的屏蔽问题
// @note    2017.05.04-V8.2 终于修复了百度知道图片替换了文字的这个大BUG; 顺便处理了superapi.zhidao.baidu.com; 新增谷歌搜索结果重定向去除
// @note    2017.05.04-V8.1 终于修复了百度知道图片替换了文字的这个大BUG，顺便处理了superapi.zhidao.baidu.com
// @note    2017.05.04-V8.0 终于修复了百度知道图片替换了文字的这个大BUG，待测试
// @note    2017.03.28-V7.6 修复在ViolentMonkey上的不支持的问题
// @note    2017.03.28-V7.5 尝试修复chrome上的问题
// @note    2017.03.21-V7.4 尝试处理Edge上不支持的问题，结果发现是Edge本身的TamperMonkey支持有问题
// @note    2017.03.19-V7.3 修复打开百度之后再次点击“百度一下”导致的无法更新重定向问题
// @note    2017.03.19-V7.2 未知原因chrome的MutationObserver无法使用了，继续回归以前的DOMNodeInserted
// @note    2017.02.17-V7.0 修复搜狗的搜索结果重定向问题+改个名字
// @note    2017.02.17-V6.9 修复搜狗的搜索结果重定向问题
// @note    2016.10.27-V6.7 修复了以前的重复请求，现在的请求数应该小了很多，网络也就不卡了，感觉萌萌哒
// @note    2016.04.24-V6.6 恢复以前的版本，因为兼容性问题
// @note    2015.12.01-V5.0 加入搜狗的支持，但是支持不是很好
// @note    2015.11.25-V2.0 优化，已经是真实地址的不再尝试获取
// @note    2015.11.25-V1.0 完成去掉百度重定向的功能
// @resource  baiduCommonStyle   https://ibaidu.tujidu.com/newcss/baiduCommonStyle.less?t=27.20
// @resource  baiduOnePageStyle  https://ibaidu.tujidu.com/newcss/baiduOnePageStyle.less?t=27.20
// @resource  baiduTwoPageStyle  https://ibaidu.tujidu.com/newcss/baiduTwoPageStyle.less?t=27.20
// @resource  googleCommonStyle  https://ibaidu.tujidu.com/newcss/googleCommonStyle.less?t=27.20
// @resource  googleOnePageStyle https://ibaidu.tujidu.com/newcss/googleOnePageStyle.less?t=27.20
// @resource  googleTwoPageStyle https://ibaidu.tujidu.com/newcss/googleTwoPageStyle.less?t=27.20
// @resource  bingCommonStyle    https://ibaidu.tujidu.com/newcss/bingCommonStyle.less?t=27.20
// @resource  bingOnePageStyle   https://ibaidu.tujidu.com/newcss/bingOnePageStyle.less?t=27.20
// @resource  bingTwoPageStyle   https://ibaidu.tujidu.com/newcss/bingTwoPageStyle.less?t=27.20
// @resource  duckCommonStyle    https://ibaidu.tujidu.com/newcss/duckCommonStyle.less?t=27.20
// @resource  duckOnePageStyle   https://ibaidu.tujidu.com/newcss/duckOnePageStyle.less?t=27.20
// @resource  duckTwoPageStyle   https://ibaidu.tujidu.com/newcss/duckTwoPageStyle.less?t=27.20
// @resource  dogeCommonStyle    https://ibaidu.tujidu.com/newcss/dogeCommonStyle.less?t=27.20
// @resource  dogeOnePageStyle   https://ibaidu.tujidu.com/newcss/dogeOnePageStyle.less?t=27.20
// @resource  dogeTwoPageStyle   https://ibaidu.tujidu.com/newcss/dogeTwoPageStyle.less?t=27.20
// @resource  haosouCommonStyle    https://ibaidu.tujidu.com/newcss/haosouCommonStyle.less?t=27.20
// @resource  haosouOnePageStyle   https://ibaidu.tujidu.com/newcss/haosouOnePageStyle.less?t=27.20
// @resource  haosouTwoPageStyle   https://ibaidu.tujidu.com/newcss/haosouTwoPageStyle.less?t=27.20
// @resource  HuYanStyle         https://ibaidu.tujidu.com/newcss/HuYanStyle.less?t=27.20
// @resource  BgAutoFit          https://ibaidu.tujidu.com/newcss/BgAutoFit.less?t=27.20
// @resource  HuaHua-ACDrakMode  https://ibaidu.tujidu.com/newcss/HuaHua-ACDrakMode.less?t=27.20
// @resource  baiduLiteStyle     https://gitcode.net/-/snippets/1906/raw/master/LiteStyle.css?inline=false
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
// @namespace 1353464539@qq.com
// @updateURL    https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/AC-baidu-Redirect.meta.js
// @downloadURL  https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/AC-baidu-Redirect.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://update.greasyfork.org/scripts/14178/AC-baidu-%E9%87%8D%E5%AE%9A%E5%90%91%E4%BC%98%E5%8C%96%E7%99%BE%E5%BA%A6%E6%90%9C%E7%8B%97%E8%B0%B7%E6%AD%8C%E5%BF%85%E5%BA%94%E6%90%9C%E7%B4%A2_favicon_%E5%8F%8C%E5%88%97.meta.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
