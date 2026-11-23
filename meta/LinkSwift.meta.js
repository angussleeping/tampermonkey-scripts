// ==UserScript==
// @name              LinkSwift
// @namespace         github.com/hmjz100
// @version           1.1.3
// @author            Hmjz100、油小猴
// @icon              data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdvbGRHcmFkaWVudCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkY1OUQ7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6I0ZGRDcwMDtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I0ZCQzAyRDtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDYuNCwgLTIpIHNjYWxlKDAuOSkiPjxwYXRoIGQ9Ik0xMDMuNiAxMDcuNGMzLjUtMi4yIDguOS02LjEgMTMuOC0xMi41czcuMy0xMi41IDguNS0xNi41Yy41LTEuNyAyLjItNy41IDIuMi0xNC43IDAtMTAuMS0zLjMtMjUuMS0xNS40LTM2LjgtMTQuNS0xNC0zMi4xLTE0LjMtMzUuNy0xNC4zLTggMC0xNS43IDEuOS0yMi42IDUuMkM0NCAyMyAzNS43IDMxLjQgMzAuOCA0MS43Yy0xLjMgMi44LTQgNC43LTcuMSA1LTQgLjMtNy41IDQuNC04LjkgOS42LS41IDEuOS0xLjYgMy41LTMuMSA0LjdDNC40IDY2LjggMCA3NS43IDAgODVjMCA2LjggMi4zIDEzLjEgNi4xIDE4LjIgNS41IDcuNCAxNC4yIDEyLjIgMjQgMTIuMmg0Ny4xYzQuNCAwIDExLS41IDE4LjMtMy41IDMuMi0xLjQgNS45LTMgOC4xLTQuNXoiIGZpbGw9IiNBMDk5RjAiLz48cGF0aCBkPSJNMTE5LjggNjQuM2MuMS0xNy4xLTEwLjQtMjgtMTIuNS0zMC4xQzk1IDIyLjEgNzkuOSAyMS44IDc2LjkgMjEuOGMtMTcuNiAwLTMzLjMgMTAuNS0zOS45IDI2LjctLjYgMS4zLTEuOCAyLjMtMy40IDIuM2gtLjRjLTUuOCAwLTEwLjYgNC44LTEwLjYgMTAuN3YuNWMwIDEuNC0uOCAyLjYtMS45IDMuM0MxMy40IDY5IDguOCA3Ni44IDguOCA4NWMwIDEyLjIgOS45IDIyLjMgMjIuMiAyMi4zaDQ1LjJjMy42LS4xIDE3LjYtLjkgMjkuNi0xMiAyLjktMi44IDEzLjktMTMuNyAxNC0zMXoiIGZpbGw9IiM1NzRBQjgiLz48cGF0aCBkPSJNMTEwLjggNTcuNGwuMiAzLjNjMCAxLjMtMS4xIDIuNC0yLjMgMi40LTEuMyAwLTIuMy0xLjEtMi4zLTIuNGwtLjEtMi44di0uM2MwLTEuMi45LTIuMiAyLjEtMi4zaC4zYy43IDAgMS4zLjMgMS43LjctLjIuMS4zLjUuNCAxLjR6bS0zLjMtMTAuM2MwIDEuMi0xIDIuMy0yLjIgMi4zaC0uMWMtLjggMC0xLjYtLjUtMi0xLjItNC42LTguMy0xMy4zLTEzLjUtMjIuOC0xMy41LTEuMiAwLTIuMy0xLTIuMy0yLjJ2LS4xYzAtMS4yIDEtMi4zIDIuMi0yLjNoLjFhMzAuMzcgMzAuMzcgMCAwIDEgMTUuOCA0LjRjNC42IDIuOCA4LjQgNi44IDExLjEgMTEuNS4xLjMuMi43LjIgMS4xek04OC4zIDczLjhMNzMuNSA5My4yYy0xLjUgMS45LTMuNSAzLjEtNS43IDMuNWgtLjJjLS40LjEtLjguMS0xLjIuMS0uNiAwLTEuMS0uMS0xLjYtLjItMi4yLS40LTQuMi0xLjctNS42LTMuNUw0NC4zIDczLjljLTItMi42LTIuNS01LjQtMS40LTcuNy4xLS4xLjEtLjIuMi0uMiAxLjItMiAzLjUtMy4yIDYuNC0zLjJoNi42di01LjdjMC02LjggNC43LTEyIDEwLjktMTIgNC44IDAgOC41IDIuNiAxMC4zIDcuMi41IDEuMy0uMiAyLjctMS41IDMuMnMtMi44LS4xLTMuMy0xLjRjLTEuMS0yLjctMi45LTQtNS41LTQtMy41IDAtNiAzLTYgN3Y4LjFjMCAuNS0uMiAxLS42IDEuNC0uNi43LTEuNyAxLjEtMi42IDEuMWgtOC40Yy0xLjMgMC0yIC40LTIuMS43LS4yLjQgMCAxLjMuOSAyLjRMNjMuMSA5MGMuOSAxLjIgMi4xIDEuOCAzLjMgMS44czIuMy0uNiAzLjEtMS43bDE0LjgtMTkuM2MuOS0xLjEgMS4xLTIgLjktMi40LS4yLS4zLS45LS43LTIuMS0uN2gtNy42Yy0uOSAwLTEuNy0uNS0yLjEtMS4yLS4zLS40LS40LS44LS40LTEuMyAwLTEuNCAxLjEtMi41IDIuNS0yLjVoNy42YzMuMSAwIDUuNSAxLjMgNi42IDMuNWwuMy43Yy43IDIuMS4xIDQuNi0xLjcgNi45eiIgZmlsbD0iI2ZmZiIvPjwvZz48Zz48cGF0aCBkPSJNMCAxMDAgUTY0IDExNSAxMjggMTAwIEwxMjggMTI4IEwwIDEyOCBaIiBmaWxsPSIjRDMyRjJGIi8+PHBhdGggZD0iTTAgMTAwIFE2NCAxMTUgMTI4IDEwMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI2dvbGRHcmFkaWVudCkiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjY0IiB5PSIxMjEiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI5MDAiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9InVybCgjZ29sZEdyYWRpZW50KSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgc3R5bGU9InRleHQtc2hhZG93OiAwcHggMXB4IDJweCByZ2JhKDAsMCwwLDAuMyk7Ij7liIYg5LiNIOi1t+OAgOe6ryDpnaAg54ixPC90ZXh0PjwvZz48L3N2Zz4=
// @description       (｡>ᴗ•)✧《也许同类型中最好用？》系列 - 一个基于 JavaScript 的网盘文件下载地址获取工具✨，基于【网盘直链下载助手】修改 | 支持 百度网盘 / 阿里云盘 / 中国移动云盘 / 天翼云盘 / 迅雷云盘 / 夸克网盘 / UC网盘 / 123云盘 八大网盘 | 开源・自用・去广 | 改界面・添功能・修Bug | 既超越原版，亦是同类中最好用版本！👋
// @description:zh-CN (｡>ᴗ•)✧《也许同类型中最好用？》系列 - 一个基于 JavaScript 的网盘文件下载地址获取工具✨，基于【网盘直链下载助手】修改 | 支持 百度网盘 / 阿里云盘 / 中国移动云盘 / 天翼云盘 / 迅雷云盘 / 夸克网盘 / UC网盘 / 123云盘 八大网盘 | 开源・自用・去广 | 改界面・添功能・修Bug | 既超越原版，亦是同类中最好用版本！👋
// @description:zh-TW (｡>ᴗ•)✧《也許同類型中最好用？》系列 - 一個基於 JavaScript 的網盤檔案下載地址獲取工具✨，基於【網盤直鏈下載助手】改編 | 支援 百度網盤 / 阿里雲盤 / 中國移動雲盤 / 天翼雲盤 / 迅雷雲盤 / 夸克網盤 / UC網盤 / 123雲盤 八大平台 | 開源・自用・除廣 | 改介面・擴功能・修Bug | 既超越原版，亦是同類中最好用版本！👋
// @description:zh-HK (｡>ᴗ•)✧《也許同類型中最好用？》系列 - 一個基於 JavaScript 的網盤檔案下載地址獲取工具✨，基於【網盤直鏈下載助手】改編 | 支援 百度網盤 / 阿里雲盤 / 中國移動雲盤 / 天翼雲盤 / 迅雷雲盤 / 夸克網盤 / UC網盤 / 123雲盤 八大平台 | 開源・自用・除廣 | 改介面・擴功能・修Bug | 既超越原版，亦是同類中最好用版本！👋
// @copyright         © 2022 hmjz100
// @license           AGPL-3.0-or-later
// @source            https://github.com/hmjz100/LinkSwift/
// @website           https://github.com/hmjz100/LinkSwift/
// @homepageURL       https://github.com/hmjz100/LinkSwift/
// @homepage          https://github.com/hmjz100/LinkSwift/
// @support           https://github.com/hmjz100/LinkSwift/issues
// @supportURL        https://github.com/hmjz100/LinkSwift/issues
// @require           https://unpkg.com/jquery@3.6.0/dist/jquery.min.js
// @require           https://unpkg.com/sweetalert2@11.4.8/dist/sweetalert2.min.js
// @resource SwalLigt https://unpkg.com/sweetalert2@11.4.8/dist/sweetalert2.min.css
// @resource SwalDark https://unpkg.com/@sweetalert2/theme-dark@5.0.26/dark.min.css
// @require           https://unpkg.com/js-md5@0.7.3/build/md5.min.js
// @require           https://unpkg.com/js-sha256@0.11.1/src/sha256.js
// @run-at            document-start
// @early-start
// @match             *://pan.baidu.com/disk/home*
// @match             *://yun.baidu.com/disk/home*
// @match             *://pan.baidu.com/disk/timeline*
// @match             *://yun.baidu.com/disk/timeline*
// @match             *://pan.baidu.com/disk/main*
// @match             *://yun.baidu.com/disk/main*
// @match             *://pan.baidu.com/youth/pan/main*
// @match             *://yun.baidu.com/youth/pan/main*
// @match             *://pan.baidu.com/disk/base*
// @match             *://yun.baidu.com/disk/base*
// @match             *://pan.baidu.com/disk/timeline*
// @match             *://yun.baidu.com/disk/timeline*
// @match             *://pan.baidu.com/pfile/*
// @match             *://yun.baidu.com/pfile/*
// @match             *://pan.baidu.com/s/*
// @match             *://pan.baidu.com/aipan/*
// @match             *://yun.baidu.com/s/*
// @match             *://yun.baidu.com/aipan/*
// @match             *://pan.baidu.com/share/*
// @match             *://yun.baidu.com/share/*
// @match             *://pan.baidu.com/embed/*
// @match             *://yun.baidu.com/embed/*
// @match             *://openapi.baidu.com/*
// @match             *://www.aliyundrive.com/s/*
// @match             *://www.aliyundrive.com/drive*
// @match             *://www.alipan.com/s/*
// @match             *://www.alipan.com/drive*
// @match             *://yun.139.com/*
// @match             *://caiyun.139.com/*
// @match             *://cloud.189.cn/web/*
// @match             *://pan.xunlei.com/*
// @match             *://pan.quark.cn/*
// @match             *://drive.uc.cn/*
// @match             *://*.123pan.com/*
// @match             *://*.123pan.cn/*
// @match             *://*.123684.com/*
// @match             *://*.123865.com/*
// @match             *://*.123952.com/*
// @match             *://*.123912.com/*
// @connect           *
// @connect           localhost
// @connect           baidu.com
// @connect           baidupcs.com
// @connect           aliyundrive.com
// @connect           aliyundrive.net
// @connect           alipan.com
// @connect           alicloudccp.com
// @connect           aliyundrive.cloud
// @connect           139.com
// @connect           cmecloud.cn
// @connect           189.cn
// @connect           xunlei.com
// @connect           quark.cn
// @connect           uc.cn
// @connect           123pan.com
// @connect           123pan.cn
// @connect           123684.com
// @connect           123865.com
// @connect           123952.com
// @connect           123912.com
// @connect           cjjd19.com
// @grant             unsafeWindow
// @grant             window.close
// @grant             GM_xmlhttpRequest
// @grant             GM_setClipboard
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_deleteValue
// @grant             GM_openInTab
// @grant             GM_registerMenuCommand
// @grant             GM_getResourceText
// @compatible	      Chrome
// @compatible	      Edge
// @compatible	      Firefox
// @compatible	      Safari
// @compatible	      Opera
// @updateURL    https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/LinkSwift.meta.js
// @downloadURL  https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/LinkSwift.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://scriptcat.org/scripts/code/1604/LinkSwift.user.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==
