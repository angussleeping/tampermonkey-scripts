// ==UserScript==
// @name         GitHub 中文化（最全翻译版）
// @name:en      GitHub Chinese Translator
// @namespace    https://greasyfork.org/zh-CN/scripts/602755
// @version      2.18.2
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
// @updateURL    https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/meta/GitHub-Zh-CN.meta.js
// @downloadURL  https://raw.githubusercontent.com/angussleeping/tampermonkey-scripts/master/scripts/GitHub-Zh-CN.user.js
// ---------- 本副本由 angussleeping/tampermonkey-scripts 托管 ----------
// 上游原地址: https://update.greasyfork.org/scripts/602755/GitHub%20%E4%B8%AD%E6%96%87%E5%8C%96%EF%BC%88%E6%9C%80%E5%85%A8%E7%BF%BB%E8%AF%91%E7%89%88%EF%BC%89.meta.js
// 托管仓库:   https://github.com/angussleeping/tampermonkey-scripts
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
   * 配置区（想改行为改这里）
   * ============================================================ */
  const CFG = {
    online: true,     // 在线翻译总开关；关掉后只做「本地词表」翻译（状态会记忆）
    translateAttributes: true, // 是否翻译占位符/标题/工具提示等属性文字
    providers: ['ai', 'baidu', 'tencentcloud', 'tencent', 'bing', 'youdao', 'google', 'mymemory'], // 翻译源优先级（已配置的付费/AI 源优先，未配置的自动跳过）
    batchItems: 16,   // 单次在线请求最多合并多少条
    batchChars: 1600, // 单次在线请求最多多少字符
    apiDelay: 120,    // 批次间隔(ms)，防限流
    maxRetry: 2,      // 单条文本最多失败重试次数
    fullRescanMs: 8000, // 兜底全量扫描间隔(ms)
    translateRepoDesc: false, // 是否翻译「关于」里的仓库描述（页面按钮控制，默认关）
    translateReadme: false,   // 是否翻译 README 正文（页面按钮控制，默认关）
    translateIssue: false,    // 是否翻译 Issue/PR 正文与评论（页面按钮控制，默认关）
    skipSelectors: [
      'pre', 'code', 'kbd', 'samp', 'var',
      'script', 'style', 'noscript', 'textarea',
      'svg', 'canvas', 'math', 'iframe', 'object',
      '.blob-code', '.highlight', '.react-code-text', '.react-blob-print-hide',
      '.markdown-body pre', '.markdown-body code',
      '[contenteditable="true"]',
      '.styled-input-container', '[role="combobox"]', 'input',
      // 搜索输入框：输入内容/正在输入不翻译（只保护输入控件本身）
      'input[type="search"]', '[data-testid="search-input"]', '[data-testid="top-search-input"]',
      'input[name="q"]', '.search-input', '#search-input',
      '[role="searchbox"]', '[role="textbox"]',
      // 仓库文件列表 / 文件树：文件夹与文件名不翻译
      '[aria-labelledby="files"]', '[aria-labelledby="folders-and-files"]', '[aria-label="Files"]',
      '[data-testid="directory-content"]', '[data-testid="tree-view"]', '[data-testid="directory-file-list"]',
      '.OverviewTable', '.react-directory-row', '.react-directory-filename-column',
      '.js-navigation-container', '.js-navigation-item', '[role="tree"]',
      '[data-zh-skip]', '[data-zh-toggle]',
    ].join(','),
  };

  // 在线翻译总开关：持久化到本地，刷新后保持
  const ONLINE_KEY = '{{SECRET_9k2m7q4z}}';
  (function () {
    var raw = '';
    try { if (typeof GM_getValue === 'function') raw = GM_getValue(ONLINE_KEY, '') || ''; } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(ONLINE_KEY) || ''; } catch (e) {} }
    if (raw === '0') CFG.online = false;
    else if (raw === '1') CFG.online = true;
  })();
  function saveOnline() {
    var v = CFG.online ? '1' : '0';
    try { if (typeof GM_setValue === 'function') GM_setValue(ONLINE_KEY, v); } catch (e) {}
    try { localStorage.setItem(ONLINE_KEY, v); } catch (e) {}
  }

  // 开关持久化：按仓库隔离，切换项目恢复默认关闭
  const FLAGS_BASE = '{{SECRET_6c4s9x2w}}';
  function repoKey() {
    try {
      const p = location.pathname.split('/').filter(Boolean);
      if (p.length >= 2 && /^(issues|pull|pulls|tree|blob|actions|releases|wiki|discussions)$/.test(p[2] || '')) return p[0] + '/' + p[1];
      if (p.length >= 2) return p[0] + '/' + p[1];
    } catch (e) {}
    return '';
  }
  function flagsKey() { const r = repoKey(); return r ? FLAGS_BASE + ':' + r : FLAGS_BASE; }
  const FLAGS_KEY = flagsKey();
  // 每次打开页面都恢复默认关闭（不跨会话记忆），并清掉历史残留
  (function () {
    try {
      const all = [];
      for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i));
      all.filter((k) => k && k.indexOf(FLAGS_BASE) === 0).forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  })();
  // 页面内状态：存 sessionStorage（刷新保留、关闭标签或换项目即恢复默认关闭）
  const SS_PREFIX = 'ghzh_toggle:';
  function ssKey(kind) { return SS_PREFIX + repoKey() + ':' + kind; }
  function ssGet(kind) { try { return sessionStorage.getItem(ssKey(kind)) === '1'; } catch (e) { return false; } }
  function ssSet(kind, on) { try { if (on) sessionStorage.setItem(ssKey(kind), '1'); else sessionStorage.removeItem(ssKey(kind)); } catch (e) {} }
  const pageState = { readme: false, about: false, issue: false };
  function refreshPageState() {
    pageState.readme = ssGet('readme');
    pageState.about = ssGet('about');
    pageState.issue = ssGet('issue');
  }
  function saveFlags() {
    // 仅用于当前页面内的即时状态，不持久化
    CFG.translateRepoDesc = CFG.translateRepoDesc;
  }

  // 需要翻译的属性：占位符、原生 tooltip、无障碍标签、图片替代文本
  const TRANSLATE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  // 额外：input 的值（按钮文字）
  const VALUE_ATTR_HOSTS = /^(submit|button|reset)$/i;

  /* ============================================================
   * 一、本地词表：GitHub 界面高频术语（含下拉菜单 / 弹窗）
   * 采用官方中文译法，优先精确命中，避免「fork→叉子」这类误译
   * ============================================================ */
  const RAW_DICT = {
    // 顶部导航 / 全局
    'Code': '代码', 'Issues': '议题', 'Pull requests': '拉取请求', 'Discussions': '讨论',
    'Actions': '操作', 'Projects': '项目', 'Wiki': '维基', 'Security': '安全',
    'Insights': '洞察', 'Settings': '设置', 'Pulse': '动态', 'Graphs': '图表',
    'Network': '网络', 'Forks': '复刻', 'Stars': '星标', 'Watchers': '关注者',
    'Releases': '发行版', 'Packages': '软件包', 'Environments': '环境',
    'Deployments': '部署', 'Codespaces': '代码空间', 'Sponsors': '赞助者',
    'Marketplace': '市场', 'Explore': '探索', 'Notifications': '通知',
    'Dashboard': '仪表盘', 'Trending': '趋势', 'Topics': '话题', 'Collections': '收藏',
    'Events': '事件', 'Blog': '博客', 'About': '关于', 'Pricing': '定价',
    'Support': '支持', 'Community': '社区', 'Documentation': '文档', 'Terms': '条款',
    'Privacy': '隐私', 'Status': '状态', 'Contact': '联系', 'Search': '搜索',
    'Sign in': '登录', 'Sign up': '注册', 'Sign out': '退出登录',
    'Sign up for GitHub': '注册 GitHub', 'Sign in to GitHub': '登录 GitHub',
    'Upgrade': '升级', 'Feature preview': '功能预览', 'Help': '帮助', 'Feedback': '反馈',
    'Your profile': '你的个人资料', 'Your repositories': '你的仓库', 'Your stars': '你的星标',
    'Your gists': '你的代码片段', 'Your projects': '你的项目', 'Your organizations': '你的组织',
    'Your enterprises': '你的企业', 'Your sponsors': '你的赞助', 'Set status': '设置状态',
    'Manage account': '管理账户', 'Switch theme': '切换主题', 'Appearance': '外观',
    'Light': '浅色', 'Dark': '深色', 'System': '跟随系统', 'Light default': '浅色（默认）',
    'Light high contrast': '浅色（高对比度）', 'Dark default': '深色（默认）',
    'Dark high contrast': '深色（高对比度）', 'Dark dimmed': '深色（柔和）',
    'Copy link': '复制链接', 'Open in new tab': '在新标签页打开',

    // 新建 / 全局下拉菜单
    'New repository': '新建仓库', 'Import repository': '导入仓库', 'New codespace': '新建代码空间',
    'New gist': '新建代码片段', 'New organization': '新建组织', 'New project': '新建项目',
    'Create new': '新建', 'Open user menu': '打开用户菜单',

    // 仓库页
    'Watch': '关注', 'Unwatch': '取消关注', 'Star': '星标', 'Unstar': '取消星标',
    'Fork': '复刻', 'Pin': '置顶', 'Unpin': '取消置顶', 'Edit Pins': '编辑置顶',
    'Branches': '分支', 'Tags': '标签', 'Go to file': '转到文件', 'Add file': '添加文件',
    'Create new file': '新建文件', 'Upload files': '上传文件', 'Find file': '查找文件',
    'Clone': '克隆', 'Download ZIP': '下载 ZIP', 'Open with GitHub Desktop': '用 GitHub Desktop 打开',
    'Open with Visual Studio': '用 Visual Studio 打开', 'Open with Visual Studio Code': '用 Visual Studio Code 打开',
    'Local': '本地', 'Latest commit': '最新提交', 'History': '历史',
    'Commit history': '提交历史', 'Contributors': '贡献者', 'Languages': '语言',
    'About': '关于', 'Readme': 'README', 'License': '许可证', 'Activity': '活动',
    'Custom properties': '自定义属性', 'Used by': '使用者', 'Report repository': '举报仓库',
    'Starred': '已星标', 'Public': '公开', 'Private': '私有', 'Internal': '内部',
    'Archived': '已归档', 'Template': '模板', 'Default': '默认',
    'View all branches': '查看全部分支', 'View all tags': '查看全部标签',
    'View all files': '查看全部文件', 'Manage topics': '管理话题', 'Edit repository details': '编辑仓库详情',

    // 文件查看页
    'Raw': '原始', 'Blame': '追溯', 'Copy raw content': '复制原始内容',
    'Download raw file': '下载原始文件', 'Edit this file': '编辑此文件',
    'Delete this file': '删除此文件', 'Open in github.dev': '在 github.dev 中打开',
    'Preview': '预览', 'Edit': '编辑', 'Split': '分屏', 'Unified': '统一',
    'Hide whitespace': '隐藏空白', 'Show whitespace': '显示空白',

    // Issue / PR
    'New issue': '新建议题', 'New pull request': '新建拉取请求', 'Open': '打开',
    'Closed': '已关闭', 'All': '全部', 'Author': '作者', 'Label': '标签',
    'Milestone': '里程碑', 'Assignee': '指派给', 'Sort': '排序', 'Comments': '评论',
    'Comment': '评论', 'Review required': '需要评审', 'Approved': '已批准',
    'Changes requested': '请求更改', 'Draft': '草稿', 'Ready for review': '可供评审',
    'Merge pull request': '合并拉取请求', 'Squash and merge': '压缩并合并',
    'Rebase and merge': '变基并合并', 'Create a merge commit': '创建合并提交',
    'Confirm merge': '确认合并', 'Confirm squash and merge': '确认压缩并合并',
    'Confirm rebase and merge': '确认变基并合并', 'Create merge commit': '创建合并提交',
    'Delete branch': '删除分支', 'Restore branch': '恢复分支', 'Reopen': '重新打开',
    'Close': '关闭', 'Close issue': '关闭议题', 'Close with comment': '评论并关闭',
    'Close as': '关闭为', 'Close as completed': '关闭为已完成',
    'Close as not planned': '关闭为不计划', 'Close as duplicate': '关闭为重复',
    'Add a comment': '添加评论', 'Write': '编写', 'Subscribe': '订阅',
    'Unsubscribe': '取消订阅', 'Participants': '参与者',
    'Linked pull requests': '关联的拉取请求', 'Development': '开发',
    'No description provided.': '未提供描述。', 'Files changed': '文件变更',
    'Commits': '提交', 'Checks': '检查', 'Conversation': '对话', 'Merge': '合并',
    'Merged': '已合并', 'Reviewers': '评审者', 'Assignees': '指派给', 'Labels': '标签',
    'Linked issues': '关联议题', 'This branch is up to date': '此分支已是最新',
    'Compare': '比较', 'Contribute': '贡献', 'Sync fork': '同步复刻',
    'Open pull request': '打开拉取请求', 'Pull request': '拉取请求', 'Issue': '议题',
    'Commit': '提交', 'Review': '评审', 'Approve': '批准', 'Approve and run': '批准并运行',
    'Request changes': '请求更改', 'Add review comment': '添加评审批注',
    'Submit review': '提交评审', 'Finish your review': '完成评审',
    'Leave a comment': '留下评论', 'Add your comment here...': '在此添加你的评论…',
    'Reference in new issue': '在新议题中引用', 'Quote reply': '引用回复',
    'Edit comment': '编辑评论', 'Delete comment': '删除评论', 'Copy link to comment': '复制评论链接',
    'Mark as read': '标记为已读', 'Mark as unread': '标记为未读', 'Mark as done': '标记为完成',
    'Mark all as read': '全部标记为已读', 'Mark as spam': '标记为垃圾信息',
    'Hide comment': '隐藏评论', 'Report content': '举报内容',
    'Inbox': '收件箱', 'Saved': '已保存', 'Done': '完成', 'Filter notifications': '筛选通知',

    // 筛选 / 排序下拉
    'Sort by': '排序方式', 'Newest': '最新', 'Oldest': '最早',
    'Recently updated': '最近更新', 'Least recently updated': '最久未更新',
    'Most commented': '评论最多', 'Most comments': '评论最多', 'Fewest comments': '评论最少',
    'Best match': '最佳匹配', 'Most stars': '星标最多', 'Most forks': '复刻最多',
    'Recently indexed': '最近收录', 'Recently created': '最近创建',
    'Filter by': '筛选条件', 'Clear filter': '清除筛选', 'Clear filters': '清除筛选',
    'Show only': '仅显示', 'Everything': '全部', 'Not starred': '未星标',
    'Open issues': '打开的议题', 'Closed issues': '已关闭的议题', 'Your issues': '你的议题',
    'Open pull requests': '打开的拉取请求', 'Closed pull requests': '已关闭的拉取请求',
    'Your pull requests': '你的拉取请求', 'Everything assigned to you': '指派给你的全部内容',
    'Everything mentioned': '提及你的全部内容', 'Everything you’re involved in': '你参与的全部内容',
    'Last 24 hours': '最近 24 小时', 'Last 7 days': '最近 7 天', 'Last 30 days': '最近 30 天',
    'Last 3 months': '最近 3 个月', 'Last year': '去年', 'All time': '全部时间',
    'Filter': '筛选', 'Filters': '筛选', 'Clear': '清除', 'Apply': '应用',

    // Watch 下拉
    'Participating and @mentions': '参与及 @提及', 'All Activity': '所有活动',
    'Ignore': '忽略', 'Custom': '自定义', 'Stop ignoring': '停止忽略',
    'Notifications': '通知', 'Not watching': '未关注', 'Watching': '关注中',

    // 通用动词 / 按钮 / 菜单项
    'Save': '保存', 'Save changes': '保存更改', 'Commit changes': '提交更改',
    'Cancel': '取消', 'Delete': '删除', 'Remove': '移除', 'Add': '添加',
    'Create': '创建', 'Update': '更新', 'Copy': '复制', 'Copied!': '已复制！',
    'Download': '下载', 'Upload': '上传', 'Submit': '提交', 'Confirm': '确认',
    'Continue': '继续', 'Back': '返回', 'Next': '下一步', 'Previous': '上一步',
    'Finish': '完成', 'Done': '完成', 'Retry': '重试', 'Refresh': '刷新',
    'Reset': '重置', 'Select': '选择', 'Select all': '全选', 'Deselect': '取消选择',
    'Show': '显示', 'Hide': '隐藏', 'Expand': '展开', 'Collapse': '折叠',
    'More': '更多', 'Less': '更少', 'Show more': '显示更多', 'Load more': '加载更多',
    'Read more': '阅读更多', 'Learn more': '了解更多', 'Get started': '开始使用',
    'Try again': '重试', 'Go back': '返回', 'Return to': '返回', 'View': '查看',
    'View all': '查看全部', 'See all': '查看全部', 'Show all': '显示全部',
    'Manage': '管理', 'Configure': '配置', 'Install': '安装', 'Uninstall': '卸载',
    'Enable': '启用', 'Disable': '禁用', 'Enabled': '已启用', 'Disabled': '已禁用',
    'Rename': '重命名', 'Duplicate': '复制副本', 'Archive': '归档', 'Unarchive': '取消归档',
    'Transfer': '转移', 'Share': '分享', 'Print': '打印', 'Mute': '静音', 'Unmute': '取消静音',
    'Block': '屏蔽', 'Unblock': '取消屏蔽', 'Report': '举报', 'Delete permanently': '永久删除',
    'Restore': '恢复', 'Discard': '放弃', 'Undo': '撤销', 'Redo': '重做',
    'Edit': '编辑', 'Preview': '预览', 'Submit': '提交', 'Cancel changes': '取消更改',
    'Ask Copilot': '询问 Copilot', 'Add to list': '添加到列表', 'Remove from list': '从列表移除',

    // Markdown 编辑器
    'Bold': '粗体', 'Italic': '斜体', 'Quote': '引用', 'Link': '链接',
    'Numbered list': '有序列表', 'Bulleted list': '无序列表', 'Task list': '任务列表',
    'Attach files': '附加文件', 'Mention': '提及', 'Reference': '引用',
    'Add heading text': '添加标题文本', 'Add bold text': '添加粗体文本',
    'Add italic text': '添加斜体文本', 'Insert a quote': '插入引用',
    'Insert code': '插入代码', 'Insert a link': '插入链接',

    // 时间 / 状态
    'Updated': '更新于', 'Created': '创建于', 'Yesterday': '昨天',
    'Last week': '上周', 'Last month': '上个月',
  };

  // 设置页 / 用户菜单 / 表单
  Object.assign(RAW_DICT, {
    // 用户菜单
    'Profile': '个人资料', 'Repositories': '仓库', 'Gists': '代码片段',
    'Organizations': '组织', 'Enterprises': '企业', 'Sponsors': '赞助者',
    'Copilot settings': 'Copilot 设置', 'Accessibility': '无障碍',
    'Starred repositories': '已星标仓库', 'Your Copilot': '你的 Copilot',

    // 设置页左侧导航
    'Public profile': '公开资料', 'Account': '账户', 'Appearance': '外观',
    'Emails': '电子邮件', 'Sessions': '会话', 'Credentials': '凭据',
    'Password and authentication': '密码和身份验证', 'SSH and GPG keys': 'SSH 和 GPG 密钥',
    'Billing and plans': '计费和账单', 'Billing and licensing': '计费与许可',
    'Moderation': '审核', 'Access': '访问',
    'Code, planning, and automation': '代码、规划与自动化',
    'Codespaces': '代码空间', 'Packages': '软件包', 'Copilot': 'Copilot',
    'Pages': '页面', 'Saved replies': '已保存的回复', 'Security': '安全',
    'Code security': '代码安全', 'Integrations': '集成', 'Applications': '应用',
    'Scheduled reminders': '预定提醒', 'Archive': '档案', 'Security log': '安全日志',
    'Sponsor log': '赞助日志', 'Secrets and variables': '机密与变量',
    'Actions': '操作', 'Webhooks': 'Webhooks', 'Environments': '环境',
    'Deploy keys': '部署密钥', 'GitHub Apps': 'GitHub Apps', 'OAuth Apps': 'OAuth 应用',
    'Two-factor authentication': '双重身份验证', 'Notifications': '通知',

    // 表单标签 / 选项 / 占位符
    'Name': '名称', 'Public email': '公开的邮箱', 'Bio': '个人简介',
    'Pronouns': '代词', 'Website': '网站', 'Social accounts': '社交账号',
    'Company': '公司', 'Location': '地点', 'Show current local time': '显示当前本地时间',
    'Profile picture': '个人资料图片', 'ORCID iD': 'ORCID iD',
    'Connect your ORCID iD': '连接您的 ORCID iD',
    'Select a verified email to display': '选择要显示的已验证电子邮件',
    "Don't specify": '不指定', 'Tell us a little bit about yourself': '简单介绍一下你自己',
    'Link to social profile': '社交资料链接',

    // 其它常见
    'Copy link': '复制链接', 'Open in new tab': '在新标签页打开',
    'Endorse': '推荐',
  });

  // 整站 UI 大词表（首页 / 资料页 / 仓库 / 议题 / 设置 / 页脚 / Copilot 面板）
  Object.assign(RAW_DICT, {
    // 全局导航 / 头部
    'Home': '首页', 'Feed': '动态', 'Dashboard': '仪表盘', 'Explore': '探索',
    'Trending': '趋势', 'Topics': '话题', 'Collections': '收藏', 'Events': '事件',
    'Marketplace': '市场', 'Notifications': '通知', 'Settings': '设置',
    'Sign in': '登录', 'Sign up': '注册', 'Sign out': '退出登录', 'Search': '搜索',
    'Type / to search': '输入 / 以搜索', 'Type to search': '输入以搜索',
    'Search or jump to…': '搜索或跳转到…', 'Search or jump to...': '搜索或跳转到…',

    // 仪表盘 / 首页
    'Top repositories': '热门仓库', 'Popular repositories': '热门仓库',
    'Customize your pins': '自定义置顶', 'Pin a repository': '置顶仓库',
    'Show less': '收起',
    'Edit profile': '编辑资料', 'View profile': '查看资料',
    'Contribution activity': '贡献活动', 'Contribution settings': '贡献设置',
    'Learn how we count contributions': '了解我们如何统计贡献',
    'Latest from our changelog': '变更日志最新动态', 'View changelog': '查看变更日志',
    'Good morning': '早上好', 'Good afternoon': '下午好', 'Good evening': '晚上好',
    'Ask anything or type @ to add context': '输入任意内容，或键入 @ 添加上下文',
    'Optimized for': '优化目标', 'Optimize for': '优化目标', 'Balance': '平衡',
    'Auto': '自动', 'Agent': '智能体', 'Debug': '调试',
    'Create issue': '创建议题', 'Write code': '编写代码',
    'All repositories': '所有仓库', 'Ask': '询问', 'Ask Copilot': '询问 Copilot',
    'No pull requests found, try a different filter.': '未找到拉取请求，请尝试其它筛选条件。',
    'No issues found': '未找到议题', 'No pull requests found': '未找到拉取请求',
    'No repositories found': '未找到仓库', 'No results found': '未找到结果',
    'Welcome to issues!': '欢迎使用议题！',
    'Issues are used to track todos, bugs, feature requests, and more.': '议题用于跟踪待办、缺陷、功能请求等。',

    // 个人资料页
    'Overview': '概览', 'Repositories': '仓库', 'Projects': '项目', 'Packages': '软件包',
    'Stars': '星标', 'Followers': '关注者', 'Following': '正在关注',
    'Achievements': '成就', 'Highlights': '亮点', 'Pinned': '置顶', 'Share': '分享',
    'Block or report': '屏蔽或举报', 'Block user': '屏蔽用户', 'Report user': '举报用户',
    'Sponsor': '赞助', 'contributions in the last year': '过去一年的贡献',
    'Less': '更少', 'More': '更多',

    // 仓库页
    'Files': '文件', 'Readme': 'README', 'Activity': '活动',
    'Custom properties': '自定义属性', 'Used by': '使用者', 'Report repository': '举报仓库',
    'No releases published': '暂无发布版本', 'No packages published': '暂无已发布软件包',
    'Create a new release': '创建新发布',
    'No description, website, or topics provided.': '未提供描述、网站或话题。',
    'Edit repository details': '编辑仓库详情', 'Add topics': '添加话题', 'Manage topics': '管理话题',
    'View all branches': '查看全部分支', 'View all tags': '查看全部标签',
    'Go to file': '转到文件', 'Add file': '添加文件', 'Find file': '查找文件',

    // 议题 / 拉取请求列表
    'New issue': '新建议题', 'New pull request': '新建拉取请求', 'Filters': '筛选',
    'Sort': '排序', 'Author': '作者', 'Labels': '标签', 'Milestones': '里程碑',
    'Assignee': '指派给', 'Reviews': '评审', 'Reviewers': '评审者', 'Draft': '草稿',
    'Linked pull requests': '关联的拉取请求',
    'Successfully merging a pull request may close this issue.': '成功合并拉取请求可能会关闭此议题。',
    'Opened by': '由', 'Updated on': '更新于', 'created': '创建于',

    // 设置页
    'Account': '账户', 'Appearance': '外观', 'Accessibility': '无障碍', 'Emails': '电子邮件',
    'Sessions': '会话', 'Credentials': '凭据', 'Enterprises': '企业', 'Applications': '应用',
    'Pages': '页面', 'Billing and plans': '计费和账单', 'Billing and licensing': '计费与许可',
    'Password and authentication': '密码和身份验证', 'SSH and GPG keys': 'SSH 和 GPG 密钥',
    'Moderation': '审核', 'Access': '访问', 'Code, planning, and automation': '代码、规划与自动化',
    'Code security': '代码安全', 'Integrations': '集成', 'Scheduled reminders': '预定提醒',
    'Archive': '档案', 'Security log': '安全日志', 'Sponsor log': '赞助日志',
    'Saved replies': '已保存的回复', 'Public profile': '公开资料', 'Secrets and variables': '机密与变量',
    'Deploy keys': '部署密钥', 'Webhooks': 'Webhooks', 'Copilot settings': 'Copilot 设置',
    'Two-factor authentication': '双重身份验证', 'Security': '安全', 'Codespaces': '代码空间',

    // 页脚
    'Docs': '文档', 'Contact': '联系', 'Pricing': '定价', 'Training': '培训',
    'Blog': '博客', 'Terms': '条款', 'Privacy': '隐私', 'Status': '状态',
    'Community': '社区', 'Manage cookies': '管理 Cookie',
    'Do not share my personal information': '不要分享我的个人信息',
    'Do not sell or share my personal information': '不要出售或分享我的个人信息',

    // 通用按钮 / 编辑器
    'Save': '保存', 'Cancel': '取消', 'Update': '更新', 'Delete': '删除', 'Add': '添加',
    'Remove': '移除', 'Create': '创建', 'Edit': '编辑', 'Done': '完成', 'Close': '关闭',
    'Continue': '继续', 'Back': '返回', 'Next': '下一步', 'Submit': '提交', 'Apply': '应用',
    'Reset': '重置', 'Filter': '筛选', 'Clear': '清除', 'Save changes': '保存更改',
    'Discard changes': '放弃更改', 'Preview': '预览', 'Write': '编写',
    'Bold': '粗体', 'Italic': '斜体', 'Quote': '引用', 'Link': '链接',
  });

  // 公开页面通用界面文案
  Object.assign(RAW_DICT, {
    'Filter by author': '按作者筛选', 'Filter by label': '按标签筛选',
    'Skip to content': '跳到内容', 'Navigation Menu': '导航菜单',
    'Appearance settings': '外观设置', 'Footer navigation': '页脚导航', 'Site-wide Links': '全站链接',
    'Repository navigation': '仓库导航', 'Security and quality': '安全与质量',
    'Folders and files': '文件夹与文件', 'Last commit message': '最近提交信息',
    'Last commit date': '最近提交日期', 'Open commit details': '打开提交详情',
    'Open more actions menu': '打开更多操作菜单', 'Related Projects': '相关项目',
    'MIT license': 'MIT 许可证', 'Security policy': '安全策略', 'Code of conduct': '行为准则',
    'Report abuse': '举报滥用', 'Dismiss alert': '关闭提示',
    'Enter your email': '输入你的邮箱', 'Built with GitHub': '使用 GitHub 构建',
    'This recommendation was created by GitHub staff': '此推荐由 GitHub 工作人员创建',
    'Trending repository': '热门仓库', 'Trending repos': '热门仓库', 'Trending developers': '热门开发者',
    'See more trending developers': '查看更多热门开发者', 'Popular topic': '热门话题',
    'Featured repositories': '精选仓库', 'Collection recommended by GitHub': 'GitHub 推荐的合集',
    'Customer Stories': '客户案例', 'Customer stories': '客户案例', 'Read customer story': '阅读客户案例',
    'See all industries': '查看所有行业', 'All Features': '所有功能', 'Why GitHub': '为什么选择 GitHub',
    'GitHub Sponsors': 'GitHub Sponsors', 'GitHub Status': 'GitHub 状态', 'Community Forum': '社区论坛',
    'Premium Support': '高级支持', 'Trust Center': '信任中心', 'Resource center': '资源中心',
    'Events & webinars': '活动与网络研讨会', 'Customer support': '客户支持', 'Learn & Connect': '学习与交流',
    'Build & Ship': '构建与交付', 'By Stage': '按阶段', 'By Industry': '按行业',
    'Financial services': '金融服务', 'Evaluate GitHub': '评估 GitHub', 'Business insights': '商业洞察',
    'Open Source Fridays': '开源星期五', 'Game Bytes': '游戏快讯', 'Made in Brazil': '巴西制造',
    'See plans and pricing': '查看方案与定价', 'Start Enterprise free trial': '开始企业版免费试用',
    'What our customers say': '客户怎么说', 'Previous testimonial': '上一条', 'Next testimonial': '下一条',
    'Product walkthrough': '产品演示', 'Previous chapter': '上一章', 'Next chapter': '下一章',
    'Review changes': '审查更改', 'Approve and merge': '批准并合并',
    'Download GitHub Copilot app': '下载 GitHub Copilot 应用',
    'Copilot reviews proposed code changes.': 'Copilot 会审查建议的代码更改。',
    'Compare GitHub': '比较 GitHub', 'Developer API': '开发者 API', 'GitHub CLI': 'GitHub CLI',
    'GitHub Desktop': 'GitHub Desktop', 'GitHub Mobile': 'GitHub Mobile', 'MCP Registry': 'MCP 注册表',
    'Professional Services': '专业服务', 'Contact GitHub': '联系 GitHub', 'Social Impact': '社会影响',
    'What is Git?': '什么是 Git？', 'The developer newsletter': '开发者通讯',
    'You can’t perform that action at this time.': '目前无法执行此操作。',
    'You signed in with another tab or window.': '你在另一个标签页或窗口中登录了。',
    'You signed out in another tab or window.': '你在另一个标签页或窗口中退出了登录。',
    'You switched accounts on another tab or window.': '你在另一个标签页或窗口中切换了账号。',
    'to refresh your session.': '以刷新你的会话。',
    'repo forked': '仓库已复刻', 'repo starred': '仓库已星标', 'branch merged': '分支已合并',
    'No description provided.': '未提供描述。',
    'Assigned to me': '指派给我', 'Created by me': '由我创建', 'Recent activity': '最近活动',
    'Collapse sidebar': '收起侧边栏', 'Search issues': '搜索议题',
    'More Issue list controls': '更多议题列表控件', 'Comfortable display density': '舒适显示密度',
    'Compact display density': '紧凑显示密度', 'Repository files navigation': '仓库文件导航',
    'Change the type filter': '更改类型筛选', 'type filter': '类型筛选',
    'Clear current search query, filters, and sorts': '清除当前搜索、筛选与排序',
    'Types': '类型', 'Views': '视图',
    'Products': '产品', 'Developers': '开发者', 'Businesses': '企业', 'Resources': '资源',
  });

  // 设置 / 计费 / 外观 / 无障碍 / 通知页
  Object.assign(RAW_DICT, {
    'Usage': '使用量', 'AI usage': '人工智能的使用', 'Budgets and alerts': '预算和警报',
    'Licensing': '许可', 'Payment information': '付款信息', 'Payment history': '付款记录',
    'Additional billing details': '额外的账单详细信息', 'Education benefits': '教育福利',
    'Current metered usage': '当前计量使用量', 'Current included usage': '当前包含使用量',
    'More details': '更多详情', 'Next payment due': '下期应付款', 'Subscriptions': '订阅',
    'Manage subscriptions': '管理订阅', 'per month': '每月', 'Metered usage': '计量使用量',
    'Usage by products': '按产品使用量', 'Copilot usage': 'Copilot 使用量', 'View details': '查看详情',
    'Additional usage': '额外使用量', 'Not enabled': '未启用', 'No usage': '无使用量',
    'Get usage report': '获取使用报告', 'Search or filter usage': '搜索或筛选使用量',
    'Group by: None': '分组方式：无', 'Usage breakdown': '使用量明细', 'Date': '日期',
    'Gross amount': '总金额', 'Billed amount': '已计费金额', 'Billing': '计费',
    'New budget': '新建预算', 'Usage blocked': '使用已阻止', 'spent': '已花费', 'Scope': '范围',
    'Filter by scope, repository, product or SKU': '按范围、仓库、产品或 SKU 筛选',
    'Included usage alerts: On': '包含使用量警报：开启', 'Included usage alerts: Off': '包含使用量警报：关闭',
    'Active subscription': '有效订阅', 'Current GitHub base plan': '当前 GitHub 基础方案',
    'Compare base plans': '比较基础方案', 'Upgrade to GitHub Pro': '升级到 GitHub Pro',
    'Upgrade Individual Plan': '升级个人版', 'Upgrade Business': '升级企业版',
    'Your AI pair programmer': '你的 AI 结对程序员', 'The basics for all developers': '面向所有开发者的基础功能',
    'Unlimited public/private repos': '无限公有/私有仓库', 'Unlimited collaborators': '无限协作者',
    'Community support': '社区支持', 'Not included:': '未包含：',
    'Free Codespaces usage per organization': '每个组织的免费代码空间用量',
    'Protected branches on all repos': '所有仓库的受保护分支',
    'Increase Codespaces spend limits': '提高代码空间消费限额',
    'Multiple reviewers in pull requests': '拉取请求中的多名评审者',
    'Required status checks': '必需的状态检查', 'Code owners': '代码所有者',
    'Required reviewers': '必需评审者', 'Pages for static website hosting': '用于静态网站托管的 Pages',
    'Web-based support': '基于网络的支持', 'See all features and compare plans': '查看所有功能并比较方案',
    'Billing information': '账单信息', 'Add your information to show on every invoice': '添加显示在每张发票上的信息',
    'First name': '名字', 'Last name': '姓氏', 'Address (Street, P.O. box)': '地址（街道、邮政信箱）',
    'Address line 2 (Apartment, suite, unit)': '地址第 2 行（公寓、套房、单元）',
    'City': '城市', 'Country/Region': '国家/地区', 'Choose your country/region': '选择你的国家/地区',
    'State/Province': '州/省', 'Postal/Zip code (9-digit zip code for US)': '邮政编码（美国为 9 位邮编）',
    'Required for certain countries': '某些国家/地区必填', 'VAT/GST ID': '增值税/GST 税号',
    'Save billing information': '保存账单信息', 'Coupon': '优惠券', 'Redeem a coupon': '兑换优惠券',
    "You don't have an active coupon.": '你没有有效的优惠券。',
    'Additional information': '附加信息', 'Add information': '添加信息',
    'No additional information added to your receipts.': '你的收据中未添加附加信息。',
    'Start your first organization': '创建你的第一个组织', 'Create an organization': '创建组织',
    'Sponsorships': '赞助', 'Start sponsoring': '开始赞助',
    'Connect with the community that builds the tools you use': '与你所用工具的构建者社区建立联系',
    "You're currently not sponsoring anyone.": '你目前没有赞助任何人。',
    'Learn more about GitHub Sponsors': '了解有关 GitHub Sponsors 的更多信息',

    'Theme preferences': '主题偏好', 'Theme mode': '主题模式', 'Sync with system': '跟随系统同步',
    'GitHub theme will match your system active settings': 'GitHub 主题将匹配你的系统活动设置',
    'Light theme': '浅色主题', 'Dark theme': '深色主题', 'Active': '当前',
    'Contrast': '对比度', 'Increase contrast': '增强对比度', 'Light mode': '浅色模式',
    'Dark mode': '深色模式', 'Off': '关闭', 'On': '开启',
    'Emoji skin tone preference': '表情符号肤色偏好', 'Preferred default emoji skin tone': '首选默认表情符号肤色',
    'Tab size preference': '制表符宽度偏好', 'Keyboard shortcuts': '键盘快捷键', 'General': '通用',
    'Character keys': '字符键', 'Save keyboard shortcut preferences': '保存键盘快捷键偏好',
    'Motion': '动效', 'Autoplay animated images': '自动播放动态图片',
    'Select whether animated images should play automatically.': '选择动态图片是否应自动播放。',
    'Adopts your system preference for reduced motion': '采用系统的“减少动态效果”偏好',
    'Automatically plays animated images': '自动播放动态图片',
    'Prevents animated images from playing automatically': '阻止动态图片自动播放',
    'Save motion preferences': '保存动效偏好', 'Content': '内容', 'Link underlines': '链接下划线',
    'Toggle the visibility of underlines on links that are adjacent to text.': '切换与文本相邻链接的下划线可见性。',
    'Hide link underlines': '隐藏链接下划线', 'Show link underlines': '显示链接下划线',
    'Save content preferences': '保存内容偏好', 'Hovercards': '悬停卡片', 'Show hovercards': '显示悬停卡片',
    'Save hovercard preferences': '保存悬停卡片偏好',
    'Default notifications email': '默认通知邮箱', 'Custom routing': '自定义路由',
    'View watched repositories': '查看已关注的仓库', 'Notify me': '通知我',
    'Participating, @mentions and custom': '参与、@提及与自定义',
    'Customize email updates': '自定义邮件更新', 'Reviews, Pushes, Comments': '评审、推送、评论',
    'Ignored repositories': '已忽略的仓库', "You'll never be notified.": '你永远不会收到通知。',
    'View ignored repositories': '查看已忽略的仓库',
    'Dependabot alerts: New vulnerabilities': 'Dependabot 警报：新漏洞',
    'Dependabot alerts: Email digest': 'Dependabot 警报：邮件摘要',
  });

  // 设置页全量（账户/邮箱/会话/密钥/组织/企业/审核/仓库/代码空间/Pages/通知等）
  Object.assign(RAW_DICT, {
    'Advanced Security': '高级安全', 'Models': '模型', 'Days': '天', 'Hours': '小时',
    'Failed workflows only': '仅失败的工作流', 'on GitHub, Email': '通过 GitHub 邮件', 'Git LFS': 'Git LFS',
    // 账户
    'Account settings': '账户设置', 'Change password': '修改密码', 'Change username': '更改用户名',
    'Delete your account': '删除你的账户', 'Export account data': '导出账户数据', 'Danger zone': '危险区域',
    'Password': '密码', 'Current password': '当前密码', 'New password': '新密码', 'Confirm password': '确认密码',
    'Set new password': '设置新密码', 'Update password': '更新密码',
    // 邮箱
    'Primary email address': '主电子邮件地址', 'Backup email address': '备用电子邮件地址',
    'Keep my email addresses private': '对我的电子邮件地址保密', 'Email preferences': '电子邮件偏好',
    'Add email address': '添加电子邮件地址', 'Add email': '添加电子邮件',
    'Verified': '已验证', 'Unverified': '未验证', 'Primary': '主邮箱', 'Backup': '备用邮箱',
    // 会话
    'Web sessions': '网页会话', 'Current session': '当前会话', 'This device': '此设备', 'Last used': '上次使用',
    'Sign out of other sessions': '退出其他会话', 'Active sessions': '活动会话',
    'Sign out of all sessions': '退出所有会话',
    // SSH / GPG / 令牌
    'SSH keys': 'SSH 密钥', 'New SSH key': '新建 SSH 密钥', 'Add new SSH key': '添加新的 SSH 密钥',
    'GPG keys': 'GPG 密钥', 'New GPG key': '新建 GPG 密钥', 'Authentication keys': '身份验证密钥',
    'Signing keys': '签名密钥', 'Title': '标题', 'Key': '密钥', 'No SSH keys': '暂无 SSH 密钥',
    'Personal access tokens': '个人访问令牌', 'Fine-grained tokens': '细粒度令牌', 'Classic tokens': '经典令牌',
    'Generate new token': '生成新令牌', 'No tokens': '暂无令牌',
    // 组织 / 企业 / 审核
    'Organizations you belong to': '你所属的组织', 'You are not a member of any organizations.': '你不是任何组织的成员。',
    'Enterprises you belong to': '你所属的企业', 'You are not a member of any enterprises.': '你不是任何企业的成员。',
    'Moderation settings': '审核设置', 'Blocked users': '已屏蔽的用户', 'Interaction limits': '互动限制',
    'You have not blocked any users.': '你尚未屏蔽任何用户。', 'Content moderation': '内容审核',
    // 仓库 / 代码空间 / 软件包 / Pages
    'Repository default settings': '仓库默认设置', 'Default branch name': '默认分支名称', 'Default branch': '默认分支',
    'Repository visibility': '仓库可见性', 'Default repository visibility': '默认仓库可见性',
    'Disable repository discussions': '禁用仓库讨论', 'Repository policies': '仓库策略',
    'Codespaces settings': '代码空间设置', 'Default editor': '默认编辑器', 'Default region': '默认区域',
    'Trusted repositories': '受信任的仓库', 'Dotfiles': 'dotfiles', 'Codespaces secrets': '代码空间机密',
    'Package settings': '软件包设置', 'No packages': '暂无软件包',
    'Pages settings': 'Pages 设置', 'No sites': '暂无站点',
    // 已保存回复 / 安全 / 代码安全 / 集成 / 提醒 / 档案
    'Add saved reply': '添加已保存的回复', 'No saved replies': '暂无已保存的回复',
    'Security settings': '安全设置', 'Sudo mode': 'SUDO 模式',
    'Enable two-factor authentication': '启用双重身份验证',
    'Code security and analysis': '代码安全与分析', 'Private vulnerability reporting': '私有漏洞报告',
    'Dependabot alerts': 'Dependabot 警报', 'Dependabot security updates': 'Dependabot 安全更新',
    'Code scanning': '代码扫描', 'Secret scanning': '密钥扫描', 'Code scanning alerts': '代码扫描警报',
    'Installed GitHub Apps': '已安装的 GitHub Apps', 'Authorized OAuth Apps': '已授权的 OAuth 应用',
    'Authorized GitHub Apps': '已授权的 GitHub Apps', 'No installed apps': '暂无已安装应用',
    'No scheduled reminders': '暂无预定提醒', 'Add reminder': '添加提醒',
    'Archived repositories': '已归档仓库', 'No archived repositories': '暂无已归档仓库',
    // 通知
    'Watching': '关注中', 'Participating': '参与', 'Notification preferences': '通知偏好',
    'Email notification preferences': '电子邮件通知偏好', 'Web': '网页', 'Mobile': '移动端', 'Email': '电子邮件',
    // 资料/通用
    'Follow': '关注', 'Unfollow': '取消关注', 'Block': '屏蔽', 'Report': '举报', 'Sponsoring': '赞助中',
  });

  // 真实登录页巡检补全（通知/PR/探索/市场/资料/仓库/设置各页）
  Object.assign(RAW_DICT, {
    'You have unread notifications': '你有未读通知', 'Create view': '创建视图',
    // 通知
    'Manage notifications': '管理通知', 'Notification settings': '通知设置', 'Watched repositories': '关注的仓库',
    'Switch inbox': '切换收件箱', 'Assigned': '指派', 'Participating': '参与', 'Mentioned': '提及',
    'Team mentioned': '团队提及', 'Review requested': '请求评审', 'Add new filter': '添加新筛选',
    'Search notifications': '搜索通知', 'Sort by:': '排序方式：', 'Newest to oldest': '最新到最早',
    'Oldest to newest': '最早到最新', 'Group by:': '分组方式：', 'Clear out the clutter.': '清理杂乱。',
    'Clean up your inbox': '清理收件箱', 'Mark all read notifications as done': '将所有已读通知标记为完成',
    'Notifications by date': '按日期分组的通知', 'Single sign-on': '单点登录',
    // PR / 视图
    'Authored by me': '我创建的', 'Involves me': '与我相关', 'Review requests': '评审请求',
    'Select repositories': '选择仓库', 'Updated: Last month': '更新于：上个月', 'Customize your view': '自定义视图',
    'Dismiss tip': '关闭提示', 'Needs your review': '需要你评审', 'Needs your teams review': '需要你的团队评审',
    'Your drafts': '你的草稿', 'Waiting for review or checks': '等待评审或检查', 'Needs action': '需要操作',
    'Ready to merge': '可合并', 'Search pull requests': '搜索拉取请求', 'More items': '更多项目',
    'No pull requests matched your search': '没有匹配你搜索的拉取请求',
    'About the “Needs your review” section': '关于“需要你评审”部分',
    'About the “Needs your teams’ review” section': '关于“需要你的团队评审”部分',
    'About the “Your drafts” section': '关于“你的草稿”部分',
    'About the “Waiting for review or checks” section': '关于“等待评审或检查”部分',
    'About the “Needs action” section': '关于“需要操作”部分',
    'About the “Ready to merge” section': '关于“可合并”部分',
    // 探索 / 市场
    'Chrome extension': 'Chrome 扩展', 'Here’s what we found based on your interests...': '以下是根据你的兴趣找到的内容…',
    'Based on repositories you’ve starred': '基于你已星标的仓库', 'Based on topics you’ve starred': '基于你已星标的话题',
    'Based on topics you’re interested in': '基于你感兴趣的话题',
    'Based on your public repository contributions': '基于你的公开仓库贡献',
    'See more trending repositories': '查看更多热门仓库',
    'That’s everything we found for you, for now.': '这是我们目前为你找到的全部内容。', 'GitHub Blog': 'GitHub 博客',
    'Hack on open source with us': '与我们一起开发开源', 'Build a game this November': '今年十一月做一款游戏',
    'All apps': '所有应用', 'Agent apps': '智能体应用', 'AI Assisted': 'AI 辅助', 'API management': 'API 管理',
    'Backup Utilities': '备份工具', 'Code quality': '代码质量', 'Code review': '代码审查',
    'Code Scanning Ready': '代码扫描就绪', 'Code search': '代码搜索', 'Container CI': '容器 CI',
    'Continuous integration': '持续集成', 'Dependency management': '依赖管理', 'Deployment Protection Rules': '部署保护规则',
    'Desktop tools': '桌面工具', 'Mobile CI': '移动端 CI', 'Open Source management': '开源管理',
    'Project management': '项目管理', 'Recently added': '最近添加', 'Time tracking': '时间跟踪', 'All actions': '所有操作',
    'Game CI': '游戏 CI', 'Create extension': '创建扩展', 'Open Marketplace categories': '打开市场分类',
    'Enhance your workflow with extensions': '用扩展增强你的工作流', 'Search Marketplace': '搜索市场',
    'View recommended or recent marketplace listings navigation': '查看推荐或最近的市场列表导航',
    // 个人资料 / 贡献图
    'Contribution Graph': '贡献图', 'Day of Week': '星期几', 'No contributions.': '无贡献。',
    'Low contributions.': '较少贡献。', 'Medium-low contributions.': '中低贡献。', 'Medium-high contributions.': '中高贡献。',
    'High contributions.': '高贡献。', 'Created an issue in': '在以下仓库创建议题：', 'Show more activity': '显示更多活动',
    'Seeing something unexpected? Take a look at the': '看到意外内容？请查看', 'GitHub profile guide': 'GitHub 个人资料指南',
    // 仓库页
    'Drop to upload your files': '拖放以上传文件', 'Add a README': '添加 README',
    'Publish your first package': '发布你的第一个软件包', 'Suggested workflows': '建议的工作流',
    'Based on your tech stack': '基于你的技术栈', 'More workflows': '更多工作流',
    'Copy code to clipboard': '复制代码到剪贴板',
    // 外观
    'GitHub will use your selected theme': 'GitHub 将使用你选择的主题',
    'Light protanopia and deuteranopia': '浅色（红色盲与绿色盲）', 'Light tritanopia': '浅色（蓝色盲）',
    'Dark protanopia and deuteranopia': '深色（红色盲与绿色盲）', 'Dark tritanopia': '深色（蓝色盲）',
    'Soft dark': '柔和深色', 'Selected theme:': '已选主题：', 'Light Skin Tone': '浅肤色',
    'Medium-Light Skin Tone': '中浅肤色', 'Medium Skin Tone': '中等肤色', 'Medium-Dark Skin Tone': '中深肤色',
    'Dark Skin Tone': '深肤色', 'Markdown editor font preference': 'Markdown 编辑器字体偏好',
    'Use a fixed-width (monospace) font when editing Markdown': '编辑 Markdown 时使用等宽字体',
    // 无障碍
    'GitHub shortcuts': 'GitHub 快捷键', 'Editor settings': '编辑器设置', 'URL paste behavior': 'URL 粘贴行为',
    'Formatted link': '格式化链接', 'Plain text': '纯文本', 'Save editor settings': '保存编辑器设置',
    'Assistive technology hints': '辅助技术提示', 'Enable screen reader hint': '启用屏幕阅读器提示',
    'Disable screen reader hint': '禁用屏幕阅读器提示',
    'Save assistive technology hint preferences': '保存辅助技术提示偏好',
    // 通知设置
    'Notify me:': '通知我：', 'When you’re given access to': '当你获得访问权限时', "Don't send": '不发送',
    'Security campaign emails': '安全活动邮件', 'Agent sessions': '智能体会话',
    'Notifications for agent sessions that you started.': '关于你启动的智能体会话的通知。',
    "'Deploy key' alert email": '“部署密钥”警报邮件', 'In-product messages': '产品内消息',
    // 会话
    'Your current session': '你的当前会话', 'Last accessed on': '上次访问于',
    'GitHub Mobile sessions': 'GitHub Mobile 会话',
    'Learn more about authentication with GitHub Mobile.': '了解有关 GitHub Mobile 身份验证的更多信息。',
    // SSH/GPG
    'Check out our guide to': '查看我们的指南', 'connecting to GitHub using SSH keys': '使用 SSH 密钥连接 GitHub',
    'or troubleshoot': '或排查', 'common SSH problems': '常见 SSH 问题', 'Learn how to': '了解如何',
    'Vigilant mode': '警惕模式', 'Flag unsigned commits as unverified': '将未签名提交标记为未验证',
    'Learn about vigilant mode': '了解警惕模式',
    // Token
    'Developer Settings': '开发者设置', 'Tokens (classic)': '令牌（经典）',
    'Personal access tokens (classic)': '个人访问令牌（经典）', 'Fine-grained, repo-scoped': '细粒度、按仓库范围',
    'Generate new token (classic)': '生成新令牌（经典）', 'For general use': '用于一般用途',
    'I understand, delete this token': '我明白，删除此令牌', 'Last used within the last week': '最近一周内使用过',
    'Never used': '从未使用',
    // 组织/企业
    'Move to an organization': '转移到组织', 'Move work to an organization': '将工作转移到组织',
    "You don't have any enterprises": '你没有任何企业', 'Start free for 30 days': '免费试用 30 天',
    'Learn more about enterprises': '了解有关企业的更多信息',
    // 仓库设置
    'Repository default branch': '仓库默认分支', 'Learn more about default branches.': '了解有关默认分支的更多信息。',
    'Commit comments': '提交评论', 'Choose whether': '选择是否', 'Commit comments:': '提交评论：',
    'Enabled by default': '默认启用', 'Disabled by default': '默认禁用', 'Deleted repositories': '已删除的仓库',
    'create one': '创建一个',
    // 代码空间
    'Automatically install dotfiles': '自动安装 dotfiles', 'Codespace user secrets': '代码空间用户机密',
    'There are no Codespace secrets.': '没有代码空间机密。', 'New secret': '新建机密', 'GPG verification': 'GPG 验证',
    'GPG signing will be available in Codespaces': 'GPG 签名将在代码空间中可用', 'Settings Sync': '设置同步',
    'Selected repositories': '已选仓库', 'Select repository': '选择仓库', 'No matching repositories.': '没有匹配的仓库。',
    'Access and security': '访问与安全', 'All Codespaces can access other repositories I own': '所有代码空间都可以访问我拥有的其他仓库',
    'Editor preference': '编辑器偏好', 'Edit and preview changes straight from the browser.': '直接在浏览器中编辑和预览更改。',
    'Default idle timeout': '默认空闲超时', 'minutes (4 hours).': '分钟（4 小时）。',
    'Timeout must be 240 minutes or less.': '超时不得超过 240 分钟。', 'Timeout must be 5 minutes or more.': '超时不得少于 5 分钟。',
    'Default retention period': '默认保留期', 'Learn about retention setting': '了解保留期设置',
    'Retention period must be 30 days or less.': '保留期不得超过 30 天。', 'Host image version preference': '主机镜像版本偏好',
    'Learn more about host images': '了解有关主机镜像的更多信息', 'Always use the latest stable configuration.': '始终使用最新稳定配置。',
    'Set automatically': '自动设置', 'Set manually': '手动设置', 'Choose your default region': '选择你的默认区域',
    // 软件包/Pages/回复
    'Packages permissions': '软件包权限', 'Default Package Setting': '默认软件包设置',
    'Inherit access from source repository': '从源仓库继承访问权限', 'Deleted Packages': '已删除的软件包',
    'Verified domains': '已验证域名', 'Add a domain': '添加域名', 'There are no verified domains.': '没有已验证的域名。',
    'Learn more about working with saved replies': '了解有关使用已保存回复的更多信息',
    'No saved replies yet.': '还没有已保存的回复。', 'Add a saved reply': '添加已保存的回复',
    'Saved reply title': '已保存回复标题', 'Unordered list': '无序列表', 'Select a reply': '选择回复',
    'Create a new saved reply': '创建新的已保存回复', 'There was an error creating your SavedReply.': '创建已保存回复时出错。',
    'Add your saved reply': '添加你的已保存回复', 'We don’t support that file type.': '我们不支持该文件类型。',
    'Try again with a file that’s not empty.': '请用非空文件重试。', 'This file is hidden.': '此文件已隐藏。',
    'Try again with another file.': '请用其他文件重试。', 'Try again.': '重试。', 'is supported': '受支持',
    'Add files': '添加文件', 'Paste, drop, or click to add files': '粘贴、拖放或点击以添加文件', 'Nothing to preview': '无可预览内容',
    // 安全
    'Sign in methods': '登录方式', 'Old password': '旧密码', 'Confirm new password': '确认新密码',
    'Make sure it’s': '确保它', 'at least 15 characters': '至少 15 个字符', 'at least 8 characters': '至少 8 个字符',
    'including a number': '包含一个数字', 'and a lowercase letter': '以及一个小写字母', 'I forgot my password': '我忘记了我的密码',
    'Passwordless sign-in with biometrics or security keys': '使用生物识别或安全密钥进行无密码登录', 'Add passkey': '添加通行密钥',
    'Google sign in method dropdown': 'Google 登录方式下拉菜单', 'Add account': '添加账户',
    'Sign in with your Apple account': '使用你的 Apple 账户登录',
    'Two-factor authentication is not enabled yet.': '双重身份验证尚未启用。',
    // 安全日志
    'Filter audit logs': '筛选审计日志', 'Yesterday’s activity': '昨天的活动', 'Repository management': '仓库管理',
    'Billing updates': '计费更新', 'Copilot activity': 'Copilot 活动', 'Personal access token activity': '个人访问令牌活动',
    'View advanced search syntax': '查看高级搜索语法', 'Recent events': '最近事件', 'Filter by Member': '按成员筛选',
    'Filter by Action': '按操作筛选', 'Regenerated a token for': '为以下对象重新生成了令牌：', 'ending in': '结尾为',
    'Created a token for': '为以下对象创建了令牌：', 'Updated a token for': '为以下对象更新了令牌：',
    'Added the following repositories to the': '将以下仓库添加到', 'Created the repository': '创建了仓库',
    'View all events created yesterday': '查看昨天创建的所有事件',
    // Apps / 提醒
    'No GitHub Apps': '没有 GitHub Apps', 'New GitHub App': '新建 GitHub App', 'View documentation': '查看文档',
    'No reminders': '没有提醒',
    // 计费
    'Products selector navigation': '产品选择器导航', 'About Copilot AI credits': '关于 Copilot AI 额度',
    'Usage by repository': '按仓库使用量', 'Top repository this month': '本月使用最多的仓库',
    'Open repository usage options': '打开仓库使用量选项', 'Chart options': '图表选项', 'Customization settings': '自定义设置',
    'Line chart with 29 data points.': '折线图，含 29 个数据点。', 'View as data table, Chart': '以数据表查看，图表',
    'End of interactive chart.': '交互式图表结束。', 'Show Usage Breakdown': '显示使用量明细',
    'Included usage alerts:': '包含使用量警报：', 'Learn more.': '了解更多。',
    'Clear Filter by scope, repository, product or SKU': '清除按范围、仓库、产品或 SKU 筛选', 'All AI Credit SKUs': '所有 AI 额度 SKU',
    'Upgrade to Business': '升级到企业版', 'for more details.': '了解更多详情。', 'Increase Codespaces': '提高代码空间',
    'spend limits': '消费限额',
    'You have not added any billing information.': '你尚未添加任何账单信息。', '(Street, P.O. box)': '（街道、邮政信箱）',
    'Address line 2': '地址第 2 行', '(Apartment, suite, unit)': '（公寓、套房、单元）', 'Postal/Zip code': '邮政编码',
    '(9-digit zip code for US)': '（美国为 9 位邮编）', 'Payment method': '付款方式',
    'You have not added a payment method.': '你尚未添加付款方式。', 'Pay with': '使用以下方式付款',
    'Credit or debit card': '信用卡或借记卡', 'PayPal account': 'PayPal 账户', 'Loading payment information…': '正在加载付款信息…',
    'Extra billing information': '额外账单信息', 'This information will appear on all your receipts.': '此信息将显示在你的所有收据上。',
    'To update the information that appears on': '更新显示在', '(if enabled), visit the': '（如已启用），请访问',
    'billing information section': '账单信息部分', 'Full business name or address of record': '完整的公司名称或登记地址',
    'Save contact information': '保存联系信息',
  });

  // 直引号与 emoji 变体
  Object.assign(RAW_DICT, {
    "Based on topics you're interested in": '基于你感兴趣的话题',
    "Based on topics you've starred": '基于你已星标的话题',
    "Based on repositories you've starred": '基于你已星标的仓库',
    "Here's what we found based on your interests...": '以下是根据你的兴趣找到的内容…',
    "That's everything we found for you, for now.": '这是我们目前为你找到的全部内容。',
    "Needs your teams' review": '需要你的团队评审',
    'About the “Needs your teams\' review” section': '关于“需要你的团队评审”部分',
    '🎯 Assigned': '🎯 指派', '💬 Participating': '💬 参与', '✋ Mentioned': '✋ 提及',
    '🙌 Team mentioned': '🙌 团队提及', '👀 Review requested': '👀 请求评审',
  });

  // bsk 全站巡检补全（导航/仓库设置/Actions/筛选/资料标签等）
  Object.assign(RAW_DICT, {
    // 全局导航（多是 aria/tooltip）
    'Open menu': '打开菜单', 'Open user navigation menu': '打开用户导航菜单', 'Global navigation menu': '全局导航菜单',
    'Open quick search dialog, type / to search': '打开快速搜索对话框，输入 / 进行搜索', 'Open Copilot…': '打开 Copilot…',
    'Chat with Copilot': '与 Copilot 聊天', 'Create new...': '新建…', 'Create new…': '新建…',
    'All issues': '所有议题', 'All pull requests': '所有拉取请求', 'You have no unread notifications': '你没有未读通知',
    'to search': '进行搜索', 'User navigation': '用户导航', 'Products selector': '产品选择器',
    'Marketplace navigation': '市场导航', 'Marketplace categories': '市场分类', 'Explore navigation': '探索导航',
    'Releases and Tags': '发行版与标签', 'Repository files': '仓库文件', 'Repository files navigation': '仓库文件导航',
    'Switch repository': '切换仓库', 'Repository menu': '仓库菜单',
    // 外观
    'Single theme picker': '单一主题选择器', 'Active Mode': '活动模式', 'Light theme picker': '浅色主题选择器', 'Dark theme picker': '深色主题选择器',
    // 通知
    'Close dialog': '关闭对话框', 'Customize filters': '自定义筛选', 'Notification filters': '通知筛选',
    'Get started clearing your notifications': '开始清理你的通知', 'More options': '更多选项', 'Move to inbox': '移至收件箱',
    'Not available': '不可用', "to see what's new.": '以查看最新内容。',
    // PR 概览
    'Pull requests navigation': '拉取请求导航', 'Filter by age: Last month': '按时间筛选：上个月',
    'Expand Needs your review': '展开“需要你评审”', "Expand Needs your teams' review": '展开“需要你的团队评审”',
    'Expand Your drafts': '展开“你的草稿”', 'Expand Waiting for review or checks': '展开“等待评审或检查”',
    'Expand Needs action': '展开“需要操作”', 'Expand Ready to merge': '展开“可合并”',
    // 探索
    'This recommendation was generated by GitHub computers': '此推荐由 GitHub 计算机生成',
    'These results are generated by GitHub computers': '这些结果由 GitHub 计算机生成',
    'This is a recommendation by GitHub staff': '此推荐由 GitHub 工作人员提供',
    'iOS logo': 'iOS 标志', 'Chrome logo': 'Chrome 标志', 'Chrome extension logo': 'Chrome 扩展标志', 'YouTube video player': 'YouTube 播放器',
    // 市场
    'Search for apps and actions': '搜索应用与操作', 'View recommended or recent marketplace listings': '查看推荐或最近的市场列表',
    // 资料：仓库标签
    'Select type': '选择类型', 'Can be sponsored': '可被赞助', 'Select language': '选择语言', 'Last updated': '最近更新',
    'Select order': '选择排序', 'Find a repository…': '查找仓库…',
    'Apache License 2.0': 'Apache 许可证 2.0', 'BSD 2-Clause "Simplified" License': 'BSD 2 条款“简化”许可证',
    'GNU General Public License v2.0': 'GNU 通用公共许可证 v2.0',
    // 资料：Stars 标签
    'Name ascending (A-Z)': '名称升序（A-Z）', 'Name descending (Z-A)': '名称降序（Z-A）',
    'Create a list to organize your starred repositories.': '创建一个列表来整理你已星标的仓库。',
    'Show all lists...': '显示所有列表…', 'Type: All': '类型：全部', 'All languages': '所有语言',
    'Sort by: Recently starred': '排序方式：最近星标', 'Recently starred': '最近星标', 'Recently active': '最近活跃',
    'Showing results': '显示结果', 'Starred topics': '已星标话题', '⭐️ Name this list': '⭐️ 为此列表命名',
    'Search starred repositories': '搜索已星标仓库', 'Name .': '名称', 'Description .': '描述',
    // 资料：Packages 标签
    'Get started with GitHub Packages': '开始使用 GitHub Packages', 'Choose a registry': '选择注册表',
    'Apache Maven': 'Apache Maven', 'Learn more about Apache Maven': '了解有关 Apache Maven 的更多信息',
    'Learn more about NuGet': '了解有关 NuGet 的更多信息', 'Learn more about RubyGems': '了解有关 RubyGems 的更多信息',
    'Learn more about npm': '了解有关 npm 的更多信息', 'Learn more about Containers': '了解有关容器的更多信息',
    // 仓库主页
    'Edit repository metadata': '编辑仓库元数据', 'Go to Branches page': '前往分支页面', 'Go to Tags page': '前往标签页面',
    'View commit history for this file.': '查看此文件的提交历史。', 'This path skips through empty directories': '此路径跳过空目录',
    // 分支
    'New branch': '新建分支', 'Branches navigation': '分支导航', 'Check status': '检查状态', 'Action menu': '操作菜单',
    'Copy branch name to clipboard': '复制分支名到剪贴板', 'Branch menu': '分支菜单', 'Search branches...': '搜索分支…',
    // 发行版
    'There aren’t any releases here': '这里没有任何发行版', 'our docs': '我们的文档', 'Find a release': '查找发行版',
    // Actions
    'Get started with GitHub Actions': '开始使用 GitHub Actions', 'Skip this and': '跳过此步并',
    'set up a workflow yourself': '自行设置工作流', 'Suggested for this repository': '此仓库的建议',
    'deployment workflows': '部署工作流', 'continuous integration workflows': '持续集成工作流',
    'automation workflows': '自动化工作流', 'Pages workflows': 'Pages 工作流', 'Browse all categories': '浏览所有分类',
    'Learn more about GitHub Actions': '了解有关 GitHub Actions 的更多信息', 'Getting started and core concepts': '入门与核心概念',
    'Configuring and managing workflows': '配置与管理工作流', 'Language and framework guides': '语言与框架指南',
    'Guides for projects written in many programming languages.': '针对多种编程语言项目的指南。',
    'Search workflows': '搜索工作流', 'Any language': '任何语言',
    // 仓库设置
    'Policy insights': '策略洞察', 'Internet access': '互联网访问', 'MCP servers': 'MCP 服务器',
    'Agent suggestions for issues': '议题的智能体建议', 'Repository name': '仓库名称', 'Template repository': '模板仓库',
    'Learn more about template repositories': '了解有关模板仓库的更多信息', 'Rename branch': '重命名分支',
    'Rename this branch': '重命名此分支', 'Enable release immutability': '启用发行版不可变性',
    'Wikis host documentation for your repository.': 'Wiki 用于托管你仓库的文档。', 'Learn more about wikis': '了解有关 Wiki 的更多信息',
    'Issue permissions': '议题权限', 'Creation allowed by:': '允许创建者：', 'All users': '所有用户',
    'Anyone can create an issue': '任何人都可以创建议题', 'Collaborators only': '仅协作者',
    'Only collaborators can create issues': '只有协作者可以创建议题', 'Get organized with issue templates': '使用议题模板进行组织',
    'Set up templates': '设置模板', 'Display a "Sponsor" button': '显示“赞助”按钮', 'Set up sponsor button': '设置赞助按钮',
    'Get started with Discussions': '开始使用讨论', 'Pull request permissions': '拉取请求权限',
    'Anyone can create a pull request': '任何人都可以创建拉取请求', 'Only collaborators can create PRs': '只有协作者可以创建 PR',
    'You must select at least one option': '你必须至少选择一个选项', 'Allow merge commits': '允许合并提交',
    'Default commit message': '默认提交信息', 'Default message': '默认信息', 'Pull request title': '拉取请求标题',
    'Pull request title and description': '拉取请求标题与描述', 'Allow squash merging': '允许压缩合并',
    'Allow rebase merging': '允许变基合并', 'Always suggest updating pull request branches': '始终建议更新拉取请求分支',
    'Allow auto-merge': '允许自动合并', 'Why is this option disabled?': '为什么此选项被禁用？',
    'Automatically delete head branches': '自动删除头分支',
    'Require contributors to sign off on web-based commits': '要求贡献者对基于网页的提交签名确认',
    'Developer Certificate of Origin (DCO)': '开发者原创声明（DCO）', 'Learn more about signing off on commits': '了解有关提交签名确认的更多信息',
    'Allow comments on individual commits': '允许对单个提交评论', 'Include Git LFS objects in archives': '在归档中包含 Git LFS 对象',
    'Auto-close issues with merged linked pull requests': '合并关联的拉取请求时自动关闭议题', 'Change visibility': '更改可见性',
    'Change to public': '更改为公开', 'Change repository visibility': '更改仓库可见性',
    'This repository is currently private.': '此仓库当前为私有。', 'Disable branch protection rules': '禁用分支保护规则',
    'This action will disable:': '此操作将禁用：', 'Branch protection rule enforcement': '分支保护规则强制执行',
    'Branch protection rule APIs': '分支保护规则 API', 'will be disabled as part of this action': '将作为此操作的一部分被禁用',
    'Transfer ownership': '转移所有权', 'Archive this repository': '归档此仓库',
    'Mark this repository as archived and read-only.': '将此仓库标记为已归档且只读。', 'Archive repository': '归档仓库',
    'This repository will become read-only.': '此仓库将变为只读。', 'All scheduled workflows will stop running.': '所有计划工作流将停止运行。',
    'Before you archive, please consider:': '归档之前，请考虑：', 'Updating any repository settings': '更新任何仓库设置',
    'Closing all open issues and pull requests': '关闭所有打开的议题和拉取请求', 'Making a note in your README': '在 README 中注明',
    'Please type': '请输入', 'to confirm.': '以确认。',
    'I understand the consequences, archive this repository': '我了解相关后果，归档此仓库',
    'Delete this repository': '删除此仓库', 'I want to delete this repository': '我想要删除此仓库',
    'General settings': '常规设置', 'Effects of making this repository public': '将此仓库设为公开的影响',
    'Effects of deleting this repository': '删除此仓库的影响',
    // 仓库议题/PR 筛选
    'No results matched your search': '没有匹配你搜索的结果', 'Try a different search query.': '请尝试其他搜索查询。',
    'Learn more about searching and filtering': '了解有关搜索与筛选的更多信息', 'Issues sidebar navigation': '议题侧栏导航',
    'Issue filters': '议题筛选', 'Filter issues by state': '按状态筛选议题', 'Issue list controls': '议题列表控件',
    'Filter by labels': '按标签筛选', 'Filter by projects': '按项目筛选', 'Filter by milestones': '按里程碑筛选',
    'Filter by assignees': '按指派人筛选', 'Issues display density': '议题显示密度', 'Change the': '更改',
    'Pull request filters': '拉取请求筛选', 'Filter by reviews': '按评审筛选', 'Filter by assignee': '按指派人筛选',
    'Pull requests display density': '拉取请求显示密度',
    // Insights
    'Code frequency': '代码频率', 'Dependency graph': '依赖图', 'Actions usage metrics': 'Actions 使用指标',
    'Actions performance metrics': 'Actions 性能指标', 'Upgrade now': '立即升级', 'Dependency graph is disabled': '依赖图已禁用',
    'Enable the dependency graph': '启用依赖图', 'Learn more about how we use your data.': '了解我们如何使用你的数据。',
    'Dependency Insights menu': '依赖洞察菜单',
    // 计费/令牌等零散
    'Usage breakdown table (scrollable)': '使用量明细表（可滚动）', 'Budget table': '预算表', 'Loading budgets': '正在加载预算',
    'Loading audit log entries…': '正在加载审计日志条目…', 'Dismiss this message': '关闭此消息',
    'Add billing information': '添加账单信息', 'Add payment method': '添加付款方式', 'Credit Card Form': '信用卡表单',
    'Application settings': '应用设置', 'Confirm token deletion': '确认删除令牌', 'Full control of repository hooks': '完全控制仓库钩子',
    'Create gists': '创建代码片段', 'Full control of projects': '完全控制项目', 'Full control of private repositories': '完全控制私有仓库',
    'Update github action workflows': '更新 GitHub Actions 工作流',
    'Upload packages to github package registry': '上传软件包到 GitHub 软件包注册表', 'Search deleted packages': '搜索已删除的软件包',
    'Authenticate to the API over Basic Authentication': '通过基本身份验证向 API 认证',
    'Enable Vigilant mode': '启用警惕模式', 'Add a short title to your reply': '为你的回复添加简短标题',
    'Learn more about strong passwords': '了解有关强密码的更多信息', 'Learn more about two-factor authentication': '了解有关双重身份验证的更多信息',
    'GitHub status page': 'GitHub 状态页面', 'contact support': '联系支持',
  });

  // 收尾小批
  Object.assign(RAW_DICT, {
    'Completed task': '已完成任务', 'Incomplete task': '未完成任务',
  });

  // tooltip 专项补全
  Object.assign(RAW_DICT, {
    'Unsave': '取消保存', 'Heading': '标题', 'Closed as not planned': '关闭为不计划',
    'Repository': '仓库', 'Breadcrumbs': '面包屑', 'Suggestions': '建议', 'User': '用户',
    'Loading content...': '正在加载内容…', 'Pagination': '分页', 'The End': '结束',
    'Wikis': 'Wiki', 'main branch': '主分支', 'Outline': '大纲', 'Budgets': '预算',
  });

  // 深扫补全（Marketplace/Copilot/提交/文件树/比较/仓库安全与Actions设置/Issue·PR详情）
  Object.assign(RAW_DICT, {
    // Marketplace 通用
    'latest version': '最新版本', 'Choose a version': '选择版本',
    'About badges in GitHub Marketplace': '关于 GitHub Marketplace 中的徽章', "What's new": '最新变化',
    'Open an issue': '创建议题', 'View source code': '查看源代码', 'Start a discussion': '开始讨论',
    'Build and Test': '构建与测试', 'Recommended permissions': '建议的权限', 'Upload artifact': '上传工件',
    'Archive Artifacts:': '归档工件：', 'Upload Artifacts:': '上传工件：', 'Remove Archive:': '移除归档：',
    'Inputs': '输入', 'Usage': '用法', 'License': '许可证',
    // Copilot 面板
    'Explore what’s new in GitHub Copilot': '探索 GitHub Copilot 的新功能', 'Continue work across surfaces': '跨终端继续工作',
    'Bring your tools together': '整合你的工具', 'Automate recurring work': '自动化重复性工作',
    'Work smarter with Copilot Fusion': '用 Copilot Fusion 更智能地工作', 'See all announcements': '查看所有公告',
    'Close sidebar': '关闭侧边栏', 'Quick links': '快速链接', 'New chat': '新建对话', 'Condense sidebar': '收起侧边栏',
    'More download options': '更多下载选项', 'Copilot Chat': 'Copilot 对话', 'See what’s new': '查看新功能',
    'Close modal': '关闭弹窗', 'A list of Copilot connectors, some already connected': 'Copilot 连接器列表（部分已连接）',
    'GitHub homepage': 'GitHub 主页', 'Agents (opens a new page)': '智能体（在新页面打开）',
    'Download GitHub Copilot app (opens in new tab)': '下载 GitHub Copilot 应用（在新标签页打开）',
    'Close banner': '关闭横幅', 'Copilot uses AI. Check for mistakes.': 'Copilot 使用 AI，请核对错误。',
    // 资料标签
    'Search results': '搜索结果', 'Create your first GitHub project': '创建你的第一个 GitHub 项目',
    'You don’t have any followers yet.': '你还没有任何关注者。',
    // 提交 / 文件树 / 比较
    'Branch selector': '分支选择器', 'User selector': '用户选择器', 'View commit details': '查看提交详情',
    'Browse repository at this point': '浏览此处的仓库', 'More actions': '更多操作',
    'Collapse file tree': '折叠文件树', 'Search this repository': '搜索此仓库', 'forward slash': '正斜杠',
    'Return to the repository overview': '返回仓库概览', 'Draggable pane splitter': '可拖动的窗格分隔条',
    'File Tree Navigation': '文件树导航', 'Copy path': '复制路径', 'Directory actions': '目录操作',
    'parent directory': '上级目录', 'Parent directory': '上级目录',
    'Compare changes': '比较更改', 'compare across forks': '跨复刻比较', 'base repository:': '基础仓库：',
    'Choose a base ref': '选择基础引用', 'head repository:': '头仓库：', 'Choose a head ref': '选择头引用',
    'Learn about pull requests': '了解拉取请求', 'Compare and review just about anything': '比较并审查几乎任何内容',
    'Example comparisons': '比较示例', 'Find a branch': '查找分支',
    // 仓库安全
    'Checking code scanning status...': '正在检查代码扫描状态…', 'Set up a security policy': '设置安全策略',
    'Enable Dependabot alerts': '启用 Dependabot 警报',
    'Advanced Security is only available for Organizations': '高级安全仅适用于组织', 'Find out more': '了解更多',
    'Dependency Scanning': '依赖扫描', 'software supply chain': '软件供应链',
    "Identify and understand your project's dependencies.": '识别并了解你项目的依赖项。',
    'Enable Dependabot security updates': '启用 Dependabot 安全更新', 'Grouped security updates': '分组安全更新',
    'Dependabot version updates': 'Dependabot 版本更新',
    'Automatically open dependency update pull requests by': '自动打开依赖更新拉取请求，依据',
    'Optional runner information': '可选运行器信息', 'Runner type': '运行器类型', 'Standard GitHub runner': '标准 GitHub 运行器',
    'Edit runner type': '编辑运行器类型', 'Labeled runner': '带标签的运行器', 'Runner group name': '运行器组名称',
    'Runner label': '运行器标签', 'Save runner selection': '保存运行器选择', 'Existing name': '现有名称', 'Existing label': '现有标签',
    // 仓库 Actions 设置
    'Actions permissions': 'Actions 权限', 'Allow all actions and reusable workflows': '允许所有操作和可复用工作流',
    'Disable actions': '禁用 Actions', 'Allow actions created by GitHub': '允许 GitHub 创建的操作',
    'Allow actions by Marketplace verified creators': '允许 Marketplace 已验证创建者的操作',
    'Allow or block specified actions and reusable workflows': '允许或屏蔽指定的操作和可复用工作流',
    'Action examples:': '操作示例：', 'Reusable workflow examples:': '可复用工作流示例：',
    'Entire organization or repository examples:': '整个组织或仓库示例：',
    'Fork pull request workflows': '复刻拉取请求工作流', 'Run workflows from fork pull requests': '运行来自复刻拉取请求的工作流',
    'Require approval for fork pull request workflows.': '要求对复刻拉取请求工作流进行批准。',
    'Workflow permissions': '工作流权限', 'Read and write permissions': '读写权限',
    'Read repository contents and packages permissions': '读取仓库内容与软件包权限', 'Not accessible': '不可访问',
    'Save artifact and log retention setting': '保存工件与日志保留设置',
    'Save fork pull request workflows settings': '保存复刻拉取请求工作流设置',
    'Save workflow permissions settings': '保存工作流权限设置', 'Save access setting': '保存访问设置',
    // Issue / PR 详情
    'Issue body actions': '议题正文操作', 'Issue actions': '议题操作', 'Add artifact': '添加工件',
    'Reacted by': '回应者', 'added this to the': '将此添加到', 'This milestone has been deleted': '此里程碑已被删除',
    'related to': '关联到', 'this commit': '此提交', 'closed this': '关闭了此', 'mentioned this': '提及了此',
    'added a commit that references this issue': '添加了引用此议题的提交',
    'and limited conversation to collaborators': '并将对话限制为协作者',
    "Please follow this repository's": '请遵循此仓库的', 'contributing guidelines': '贡献指南',
    'No one assigned': '无人指派', 'No labels': '无标签', 'No type': '无类型', 'No projects': '无项目',
    'None yet': '暂无', 'No branches or pull requests': '无分支或拉取请求',
    "You're not receiving notifications from this thread.": '你未接收此会话的通知。',
    'Open in GitHub Copilot app': '在 GitHub Copilot 应用中打开',
    'This user is the author of this issue': '此用户是该议题的作者', 'reactions': '个回应',
    'Issues mentioned': '提及的议题', 'Show commit message body': '显示提交信息正文', 'Give feedback': '提供反馈',
    // PR / Actions 列表
    'Review required before merging': '合并前需要评审', 'Draft pull request': '草稿拉取请求',
    'Next Page': '下一页', 'All workflows': '所有工作流', 'Open Actions': '打开 Actions',
    'Showing runs from all workflows': '显示所有工作流中的运行', 'Filter workflow runs': '筛选工作流运行',
    'Workflow runs': '工作流运行', 'Auto-refresh: 30s': '自动刷新：30 秒', 'completed successfully:': '成功完成：',
    'currently running:': '当前运行中：', 'In progress': '进行中', 'Action required': '需要操作',
    'Actions workflows': 'Actions 工作流', 'Actions management': 'Actions 管理', 'Search runs': '搜索运行',
    'Workflow runs results': '工作流运行结果', 'requires action with the application:': '需要应用执行操作：',
    // 组织页
    'Organization navigation': '组织导航', 'View all repositories': '查看所有仓库', 'Top languages': '主要语言',
    'Most used topics': '最常用话题', 'GitHub Sponsor': 'GitHub 赞助者', 'Developer Program Member': '开发者计划成员',
    // Tokens
    'Fine-grained personal access tokens': '细粒度个人访问令牌', 'No fine-grained tokens created': '尚未创建细粒度令牌',
  });

  // 第三批（项目/安全/设置子页/搜索/话题/趋势/活动/Codespaces/新建仓库/组织）
  Object.assign(RAW_DICT, {
    // 项目
    'Open Issues sidebar navigation': '打开议题侧栏导航', 'Search projects': '搜索项目', 'Repository projects': '仓库项目',
    'Search by name…': '按名称搜索…', 'Filter projects by state': '按状态筛选项目', 'Loading projects': '正在加载项目',
    // 安全
    'Manage repository vulnerability settings': '管理仓库漏洞设置', 'Manage Dependabot rules': '管理 Dependabot 规则',
    'Manage account notification settings': '管理账户通知设置', 'Refresh Dependabot alerts': '刷新 Dependabot 警报',
    'Dependabot alerts are disabled.': 'Dependabot 警报已禁用。', "this repository's settings": '此仓库的设置',
    'Start setup': '开始设置',
    // 访问确认
    'Confirm access': '确认访问', 'Signed in as': '登录身份', 'Verify via email': '通过电子邮件验证',
    'You are entering': '你正在进入', 'Contact GitHub Support': '联系 GitHub 支持',
    // 分支/钩子/环境/运行器
    'Branch protection rules': '分支保护规则', 'Protect your branches with repository rulesets': '使用仓库规则集保护你的分支',
    'Classic branch protections': '经典分支保护', 'are also available but offer fewer capabilities.': '也可用，但功能较少。',
    'Add classic branch protection rule': '添加经典分支保护规则', 'Add branch ruleset': '添加分支规则集',
    'Add webhook': '添加 webhook', 'Webhooks Guide': 'Webhooks 指南',
    'New environment': '新建环境', 'I understand, delete this environment': '我明白，删除此环境', 'Delete environment': '删除环境',
    'New self-hosted runner': '新建自托管运行器', 'There are no runners configured': '未配置任何运行器',
    'to run actions on your own servers.': '以在你自己的服务器上运行 Actions。',
    // 搜索
    'More languages...': '更多语言…', 'Number of followers': '关注者数量', 'Number of forks': '复刻数量',
    'Number of stars': '星标数量', 'Date created': '创建日期', 'Date pushed': '推送日期', 'Advanced search': '高级搜索',
    'Public archive': '公开归档', 'External links': '外部链接', 'Filter by type': '按类型筛选', 'Open column options': '打开列选项',
    'Sponsor open source projects you depend on': '赞助你依赖的开源项目', 'Explore sponsorable projects': '探索可赞助的项目',
    'How can we improve search?': '我们如何改进搜索？',
    // 市场
    'Automate your workflow from idea to production': '从想法到生产自动化你的工作流', 'All creators': '所有创建者',
    // 话题
    'Browse popular topics on GitHub.': '浏览 GitHub 上的热门话题。', 'All featured topics': '所有精选话题', 'Popular topics': '热门话题',
    // 趋势
    'Spoken Language:': '口语语言：', 'Select a spoken language': '选择口语语言', 'This setting can be updated in your': '此设置可在你的',
    'profile settings.': '个人资料设置中更新。', 'Clear spoken language': '清除口语语言', 'Select a language': '选择语言',
    'Unknown languages': '未知语言', 'Date range:': '日期范围：', 'Adjust time span': '调整时间范围', 'This week': '本周',
    'This month': '本月', 'Built by': '构建者', 'Filter spoken languages': '筛选口语语言',
    'Type or choose a spoken language': '输入或选择口语语言', 'Filter languages': '筛选语言', 'Type or choose a language': '输入或选择语言',
    // 收藏
    'Create a collection': '创建收藏集', 'Load more…': '加载更多…',
    // 活动
    'In Person': '线下', 'On demand': '按需', 'Clear all': '全部清除',
    'Selecting a sort option will reload the page.': '选择排序选项将重新加载页面。', 'Date (soonest)': '日期（最近）',
    'Enter now': '立即参加', 'Explore more': '探索更多', 'Join now': '立即加入', 'Register now': '立即注册',
    'Close navigation menu': '关闭导航菜单', 'Toggle navigation': '切换导航',
    'Search or jump to, type / to search': '搜索或跳转，输入 / 进行搜索', 'Previous Page': '上一页', 'Previous page': '上一页',
    'Go to GitHub homepage': '前往 GitHub 首页', 'Legal and Resource Links': '法律与资源链接',
    "GitHub's Social Media Links": 'GitHub 社交媒体链接', 'English - Select language': '英语 - 选择语言',
    // Codespaces
    'Your instant dev environment': '你的即时开发环境', 'Go to docs': '前往文档', 'Explore quick start templates': '浏览快速开始模板',
    'By github': '由 github', 'Use this template': '使用此模板', 'Getting started with GitHub Codespaces': 'GitHub Codespaces 入门',
    'Learn core concepts': '学习核心概念', 'New to Codespaces?': '初次使用 Codespaces？', 'Start here': '从这里开始',
    'Configure and manage': '配置与管理', 'secret management': '机密管理', 'port forwarding': '端口转发',
    'Develop locally': '本地开发', 'Access codespaces from within': '在以下环境中访问代码空间', 'By repository': '按仓库',
    // 新建仓库
    'Create a new repository': '创建新仓库', "Repositories contain a project's files and version history.": '仓库包含项目的文件和版本历史。',
    'Have a project elsewhere?': '在别处有项目？', 'Import a repository': '导入仓库',
    'Required fields are marked with an asterisk (*).': '必填字段用星号（*）标记。', 'Repository owner and name': '仓库所有者和名称',
    'Choose visibility': '选择可见性', 'Add README': '添加 README', 'READMEs can be used as longer descriptions.': 'README 可用作更长的描述。',
    'About READMEs': '关于 README', 'Add .gitignore': '添加 .gitignore', '.gitignore tells git which files not to track.': '.gitignore 告诉 git 哪些文件不跟踪。',
    'About ignoring files': '关于忽略文件', 'No .gitignore': '不添加 .gitignore', 'Add license': '添加许可证',
    'Licenses explain how others can use your code.': '许可证说明他人如何使用你的代码。', 'About licenses': '关于许可证',
    'No license': '不添加许可证', 'Create repository': '创建仓库', 'Choose visibility: Public': '选择可见性：公开',
    // 组织
    'Contributed by me': '我贡献的', 'Admin access': '管理员权限', 'Open Repository filters': '打开仓库筛选',
    'Search repositories': '搜索仓库', 'Repositories list': '仓库列表', 'Last pushed': '最近推送',
    'Repository filters': '仓库筛选', 'Repository views': '仓库视图', 'Repositories list display density': '仓库列表显示密度',
    'Sort by Last pushed descending': '排序方式：最近推送优先', 'Organization permissions': '组织权限',
    'Find a member…': '查找成员…',
  });

  // 第四批（组织Projects/文件页/文件查找/搜索筛选/授权应用/Copilot Spaces/Apps说明）
  Object.assign(RAW_DICT, {
    // 组织 Projects
    'github projects': 'GitHub 项目', 'Search all projects': '搜索所有项目', 'Make a copy': '复制一份',
    'Issues and pull requests will not be copied.': '议题和拉取请求不会被复制。',
    'Draft issues will be copied if selected': '若选中，草稿议题将被复制',
    'Select an owner': '选择所有者', 'New project name': '新项目名称', 'Copy project': '复制项目',
    'On track': '进展正常', 'Projects views': '项目视图', 'More project options': '更多项目选项',
    // 代码评审限制
    'Limit to users explicitly granted': '仅限明确获授权的用户', 'or higher access': '或更高权限',
    // 网络/成员
    'switch to list view': '切换到列表视图', 'No one has forked this repository yet.': '还没有人复刻此仓库。',
    'forking a repository': '复刻仓库',
    // 文件页
    'More file actions': '更多文件操作', 'File metadata and controls': '文件元数据与控件', 'Add to space': '添加到空间',
    'Ask Copilot about this file': '就此文件询问 Copilot', 'Copy raw file': '复制原始文件',
    'More edit options': '更多编辑选项', 'Open symbols panel': '打开符号面板', 'Edit and raw actions': '编辑与原始操作',
    'File view': '文件视图',
    // 文件查找
    'You’ve activated the': '你已激活', 'file finder': '文件查找器', 'to navigate,': '以导航，',
    'to view files,': '以查看文件，', 'to exit.': '以退出。', 'No matching files found.': '未找到匹配的文件。',
    'The name of the file to navigate to.': '要导航到的文件名。', 'Hide this notice forever': '永久隐藏此提示',
    // 搜索结果筛选
    'Close reason': '关闭原因', 'Has linked pull request': '有链接的拉取请求', 'Mentioned user': '提及的用户',
    'Mentioned team': '提及的团队', 'Involved user': '参与的用户', 'Involves user': '涉及的用户',
    'Number of comments': '评论数量', 'Number of interactions': '互动数量', 'Issue origami icon': '议题图标',
    'CI status': 'CI 状态', 'Review status': '评审状态', 'Not merged': '未合并',
    // 授权应用
    'This will revoke access for': '这将撤销以下对象的访问权限', 'all third-party': '所有第三方',
    'OAuth applications. This action cannot be undone.': 'OAuth 应用。此操作无法撤销。',
    'Type your username to confirm.': '输入你的用户名以确认。',
    'I understand, revoke access for everything': '我明白，撤销所有访问权限', 'Recently used': '最近使用',
    'Least recently used': '最久未使用', 'Revoking will deny future access to your account': '撤销后将拒绝未来对你账户的访问',
    'Are you sure you want to revoke authorization?': '你确定要撤销授权吗？', 'I understand, revoke access': '我明白，撤销访问',
    'Read more about connecting with third-party applications at': '了解更多关于连接第三方应用的信息，请访问',
    // Copilot Spaces
    'Upgrade to Copilot Pro': '升级到 Copilot Pro', 'Copilot Spaces documentation': 'Copilot Spaces 文档',
    'Space options': '空间选项', 'Try Spaces in VS Code': '在 VS Code 中试用 Spaces', 'Dismiss banner': '关闭横幅',
    'Create space': '创建空间', 'Search spaces': '搜索空间', 'Shared with me': '与我共享',
    'Start your first space': '创建你的第一个空间', 'Need help? Read the docs': '需要帮助？阅读文档',
    'Generate code': '生成代码', "Produce code that follows your team's patterns.": '生成遵循你团队规范的代码。',
    'Share knowledge': '分享知识', 'Plan projects': '规划项目',
    'Create requirements and issues your team can ship.': '创建你团队可交付的需求和议题。', 'Filter spaces': '筛选空间',
    // 设置 Apps 说明
    'Want to build something that integrates with and extends GitHub?': '想要构建与 GitHub 集成并扩展其功能的东西吗？',
    'Register a new GitHub App to get started developing on the GitHub API.': '注册一个新的 GitHub App，开始基于 GitHub API 开发。',
    // 通知
    'When viewing a notification, press': '查看通知时，按', 'to mark it as Done.': '将其标记为完成。',
  });

  // 空状态/说明文案（OAuth/令牌/Apps）
  Object.assign(RAW_DICT, {
    'No OAuth apps': '没有 OAuth 应用',
    'OAuth apps are used to access the GitHub API. Read the docs to find out more.': 'OAuth 应用用于访问 GitHub API。阅读文档了解更多。',
    'New OAuth app': '新建 OAuth 应用',
    'Need an API token for scripts or testing? Generate a personal access token for quick access to the GitHub API.': '需要用于脚本或测试的 API 令牌？生成个人访问令牌以快速访问 GitHub API。',
    'Tokens you have generated that can be used to access the GitHub API.': '你已生成的、可用于访问 GitHub API 的令牌。',
    'Personal access tokens (classic) function like ordinary OAuth access tokens. They can be used instead of a password for Git over HTTPS, or can be used to': '个人访问令牌（经典）的作用类似于普通的 OAuth 访问令牌。它们可代替密码用于通过 HTTPS 进行 Git 操作，也可用于',
    'Expires on': '到期于',
  });

  // Copilot 下拉菜单
  Object.assign(RAW_DICT, {
    'Ask Copilot...': '询问 Copilot…', 'Ask Copilot…': '询问 Copilot…',
    'In immersive chat': '在沉浸式对话中', 'In a space': '在空间中',
    'Download for...': '下载…', 'Download for…': '下载…',
  });

  // 筛选 / 排序 / 视图 / 项目 / 里程碑 / 讨论 / 标签 菜单
  Object.assign(RAW_DICT, {
    // Dismiss
    'Dismiss': '关闭', 'Dismiss for this repository only': '仅为此仓库关闭', 'Dismiss for all repositories': '为所有仓库关闭',
    // 排序
    'Order': '排序方向', 'Created on': '创建时间', 'Total comments': '评论总数',
    'Furthest due date': '最晚到期日', 'Closest due date': '最近到期日', 'Least complete': '完成度最低', 'Most complete': '完成度最高',
    'Alphabetical': '按字母顺序', 'Reverse alphabetical': '按字母逆序', 'Most issues': '议题最多', 'Fewest issues': '议题最少',
    // 筛选项
    'Filter assignees': '筛选指派对象', 'No assignees': '无指派对象',
    'Filter by milestone': '按里程碑筛选', 'Filter milestones': '筛选里程碑', 'No milestone': '无里程碑',
    'Filter by project': '按项目筛选', 'Filter projects': '筛选项目', 'No projects were found': '未找到项目',
    'Please try a different search query.': '请尝试其他搜索查询。', 'Filter labels': '筛选标签', 'Filter authors': '筛选作者',
    'Something isn\'t working': '功能出现异常', 'Awaiting triage and prioritization': '等待分类与优先级排序',
    'New feature or request': '新功能或请求', 'Process capture and runtime observation': '进程捕获与运行时观察',
    'Native analysis and decompilation, including Ghidra, IDA, and Hopper analysis behavior': '原生分析与反编译，包括 Ghidra、IDA 与 Hopper 的分析行为',
    'Popular': '热门', 'P0: critical': 'P0：严重', 'Critical issue requiring immediate attention': '需要立即处理的严重议题',
    // 视图/项目/里程碑 空状态
    'No private views yet': '还没有私有视图', 'Shared': '共享', 'No shared views yet': '还没有共享视图',
    'No projects found': '未找到项目', 'There are no projects linked to this repository.': '此仓库未关联任何项目。',
    'You haven\'t created any Milestones.': '你还没有创建任何里程碑。',
    'Use Milestones to create collections of Issues and Pull Requests for a particular release or project.': '使用里程碑为特定发布或项目创建议题和拉取请求的集合。',
    // 标签页
    'Search all labels': '搜索所有标签', 'Current': '当前', 'Archived': '已归档',
    // 讨论
    'Categories': '分类', 'View all discussions': '查看所有讨论', 'Announcements': '公告', 'Ideas': '想法', 'Polls': '投票',
    'Q&A': '问答', 'Show and tell': '展示与分享', 'Most helpful': '最有帮助', 'last 30 days': '最近 30 天',
    'New discussion': '新建讨论', 'Latest activity': '最近活动', 'Unanswered': '未回答', 'Community guidelines': '社区准则',
    'started': '发起于', 'Filter: Open': '筛选：打开', 'Filter: Closed': '筛选：已关闭',
  });

  // 创建列表 / 列表选择弹窗
  Object.assign(RAW_DICT, {
    'Description': '描述', 'Lists': '列表', 'Create list': '创建列表',
    'Add to list': '添加到列表', 'Filter lists': '筛选列表', 'List name': '列表名称',
  });

  // 组织成员 / 仓库筛选 / 市场 / Copilot 设置
  Object.assign(RAW_DICT, {
    'People': '成员', 'Members': '成员',
    'Relevance': '相关性', 'Ascending': '升序', 'Descending': '降序',
    'Type': '类型', 'Sources': '来源', 'Mirror': '镜像', 'Mirrors': '镜像',
    'Deployable': '可部署', 'Deployed': '已部署', 'Language': '语言', 'Exclude': '排除',
    'Visibility': '可见性', 'Templates': '模板',
    'Featured': '精选', 'Apps': '应用', 'Listing type': '列表类型',
    'GitHub Copilot': 'GitHub Copilot', 'Visual Studio Code': 'Visual Studio Code', 'Free': '免费',
    'Getting started': '入门', 'Install Copilot in your editor': '在编辑器中安装 Copilot',
    'Ask about coding problems and get code completions while you work.': '工作时询问编码问题并获取代码补全。',
    'Chat with Copilot anywhere': '随处与 Copilot 聊天', 'Start building with Copilot': '开始用 Copilot 构建',
    'copilot': 'Copilot',
  });

  // 讨论区 / 状态页
  Object.assign(RAW_DICT, {
    'Homepage': '主页', 'Reload': '重新加载', 'Loading': '加载中', 'Use': '使用',
    'Locked': '已锁定', 'Unlocked': '未锁定', 'Answered': '已回答', 'items': '项',
    'Enterprise': '企业', 'Today': '今天', 'Normal': '正常', 'Incident': '事件',
    'Degradation': '降级', 'Related': '相关', 'Product': '产品', 'Features': '功能',
    'Webhooks': 'Webhooks',
  });

  // 账户设置：用户名 / Patreon / 导出 / 继任者
  Object.assign(RAW_DICT, {
    'Changing your username can have unintended side effects.': '更改用户名可能会产生意想不到的副作用。',
    'unintended side effects': '意想不到的副作用',
    'Looking to manage account security settings? You can find them in the': '想管理账户安全设置？你可以在',
    'Link Patreon account': '关联 Patreon 账户', 'Connect with Patreon': '使用 Patreon 连接',
    'Start export': '开始导出', 'Successor settings': '继任者设置',
    'Search by username, full name, or email address': '按用户名、全名或电子邮件地址搜索',
  });

  // 仓库筛选 / 分支切换 / Actions / 评审 / Compare / 应用 / 安全日志 / 赞助日志
  Object.assign(RAW_DICT, {
    'Advanced': '高级', 'Owner': '所有者', 'Size': '大小', 'Topic': '话题',
    'Switch branches/tags': '切换分支 / 标签', 'Find a branch...': '查找分支…',
    'Workflows': '工作流', 'Preview checks': '预览检查', 'Management': '管理',
    'Completed': '已完成', 'No sessions match your filters': '没有匹配筛选条件的会话',
    'Try adjusting your search or filters.': '请尝试调整搜索或筛选条件。',
    'No reviews': '无评审', 'Approved review': '已批准的评审',
    'Reviewed by you': '你已评审', 'Not reviewed by you': '你未评审',
    'Awaiting review from you': '等待你评审', 'Awaiting review from you or your team': '等待你或你的团队评审',
    'Stacks': '堆栈', 'Archives': '档案', 'Export': '导出', 'JSON': 'JSON', 'CSV': 'CSV',
    'All-time': '全部时间', 'New sponsorships, changes, and cancellations': '新的赞助、变更与取消',
    'No sponsorship activity in this time period': '此时间段内没有赞助活动',
    'This is where you can review activity from your sponsorships.': '你可以在此查看你的赞助活动。',
    'GitHub Apps augment and extend your workflows on GitHub with commercial, open source, and homegrown tools.': 'GitHub Apps 通过商业、开源和自研工具增强并扩展你在 GitHub 上的工作流。',
  });

  // 状态页历史 / PR·Issue 时间线 / 页脚
  Object.assign(RAW_DICT, {
    'Incidents': '事件', 'Uptime': '正常运行时间', 'Operational': '运行正常',
    'Show All': '显示全部', '+ Show All': '+ 显示全部',
    'Uh oh!': '出错了！', 'There was an error while loading.': '加载时出错。',
    'Please reload this page': '请重新加载此页面',
    'September': '九月', 'October': '十月', 'November': '十一月',
    'Sep': '9月', 'Oct': '10月', 'Nov': '11月',
    'Contributor': '贡献者', 'added': '添加', 'Committed': '已提交',
    'commented': '评论', 'removed': '移除', 'remaining': '剩余', 'opened': '创建',
    'Agents': '智能体',
    'Team': '团队', 'Roadmap': '路线图', 'Platform': '平台', 'Partners': '合作伙伴',
    'Education': '教育', 'Skills': '技能', 'Careers': '招聘', 'Newsroom': '新闻中心',
    'Inclusion': '多元包容', 'Shop': '商店', 'Footer': '页脚', 'GitHub footer': 'GitHub 页脚',
    'GitHub Status History - Atom Feed': 'GitHub 状态历史 - Atom 订阅',
    'GitHub Status History - RSS Feed': 'GitHub 状态历史 - RSS 订阅',
  });

  // 分支列表 / 反应菜单 / 标签筛选 / 新建议题弹窗
  Object.assign(RAW_DICT, {
    // 分支列表表头与提示
    'This branch is protected by branch protections': '此分支受分支保护规则保护',
    'Branch': '分支', 'Behind': '落后', 'Ahead': '领先',
    'Stale': '陈旧', 'Active branches': '活动分支', 'All branches': '全部分支',
    'Branches': '分支', 'Search branches...': '搜索分支…', 'Search branch...': '搜索分支…',
    // 反应菜单
    'Total reactions': '反应总数', 'Thumbs up': '赞', 'Thumbs down': '踩',
    'Laugh': '大笑', 'Hooray': '庆祝', 'Confused': '困惑', 'Rocket': '火箭', 'Eyes': '眼睛', 'Heart': '爱心',
    // 标签筛选
    'Filter by label': '按标签筛选', 'Filter labels': '筛选标签', 'Suggested': '建议',
    'No labels': '无标签', 'Merge candidate': '合并候选',
    // 新建议题弹窗
    'Create new issue': '新建议题', 'Bug Report': '缺陷报告', 'Feature request': '功能请求',
    'Blank issue': '空白议题', 'Submit a Bug Report': '提交缺陷报告',
    'Suggest an idea for this project': '为该项目提出建议',
    'Create a new issue from scratch': '从空白开始创建新议题',
    'Add a title': '添加标题', 'Create more': '继续创建',
  });

  // 通知筛选 / 通知状态 / 设置侧栏
  Object.assign(RAW_DICT, {
    // 通知筛选弹窗
    'Filter inbox by...': '按以下条件筛选收件箱…', 'Create new filter': '创建新筛选',
    'Filter inbox': '筛选收件箱', 'Name': '名称', 'Query': '查询',
    'Assigned': '已指派', 'Participating': '参与中', 'Mentioned': '被提及',
    'Team mention': '团队提及', 'Review request': '评审请求',
    // 通知页
    'Unread': '未读', 'Read': '已读', 'Saved': '已保存', 'Done': '已完成',
    'Search notifications': '搜索通知', 'Mark as read': '标记为已读',
    'Mark as done': '标记为完成', 'Subscribe': '订阅', 'Unsubscribe': '取消订阅',
    'Notification settings': '通知设置',
    // 通知列表里的原因
    'commented': '评论了', 'subscribed': '已订阅', 'author': '作者',
    'ci activity': 'CI 活动', 'mentioned': '被提及', 'review requested': '请求评审',
    'state change': '状态变更', 'assign': '指派', 'team mention': '团队提及',
    // 设置侧栏
    'Code review limits': '代码评审限制', 'Sponsorship log': '赞助日志',
    'Cloud': '云', 'Pages': '页面', 'Copilot': 'Copilot',
    'Moderation': '审核', 'Blocked users': '已屏蔽的用户',
    'Interaction limits': '互动限制', 'Organizations': '组织', 'Enterprises': '企业',
    'Packages': '软件包', 'Features': '功能',
    // 其他常见
    'Sort by: Most recent': '排序方式：最新到最早', 'Most recent': '最新',
    'Oldest': '最早', 'Recently updated': '最近更新', 'Best match': '最佳匹配',
  });


  // 设置 / 通知 / Actions / 依赖 / 社区页界面文案
  Object.assign(RAW_DICT, {
    'Close menu': '关闭菜单', 'Close user navigation menu': '关闭用户导航菜单',
    'Create new repository': '新建仓库', 'Your personal account': '你的个人账户',
    'Settings menu': '设置菜单', 'User settings': '用户设置',
    'Issue types': '议题类型', 'Issue fields': '议题字段',
    'Expand sidebar': '展开侧边栏', 'Collapse sidebar': '收起侧边栏',
    'Items will be filtered as you type': '输入时自动筛选',
    'Find code, projects, and people on GitHub:': '在 GitHub 上查找代码、项目和人员：',
    'Sorry, something went wrong.': '抱歉，出了点问题。',
    'Community standards': '社区准则', 'Community Standards': '社区准则',
    'Fork this repository and edit the file': '复刻此仓库并编辑该文件',
    'Update profile': '更新个人资料', 'Update preferences': '更新偏好设置',
    'Update preferences': '更新偏好设置',
    'Please upload a picture smaller than 1 MB.': '请上传小于 1 MB 的图片。',
    'We only support PNG, GIF, or JPG pictures.': '仅支持 PNG、GIF 或 JPG 格式的图片。',
    'File contents don’t match the file extension.': '文件内容与扩展名不匹配。',
    'Upload a photo…': '上传照片…', 'Remove photo': '移除照片',
    'Show Achievements on my profile': '在我的个人资料中显示成就',
    'Join the GitHub Developer Program': '加入 GitHub 开发者计划',
    'Save jobs profile': '保存求职资料', 'No Preference': '无偏好',
    'Select notification channels': '选择通知渠道', 'Select events': '选择事件',
    'Comments on Issues and Pull Requests': '议题与拉取请求的评论',
    'Only notify for failed workflows': '仅在工作流失败时通知',
    'Send weekly': '每周发送', 'Send daily': '每天发送',
    'No usage found': '未找到使用记录',
    'Manage Copilot policy': '管理 Copilot 策略',
    'Manage email preferences': '管理电子邮件偏好设置',
    'Resend verification email': '重新发送验证邮件',
    'Select email to become primary': '选择要设为主的邮箱',
    'Select email to become backup': '选择要设为备用的邮箱',
    'Only allow primary email': '仅允许主邮箱',
    'Disable two-factor authentication': '禁用双重身份验证',
    'Preferred 2FA method': '首选双重验证方式', 'Two-factor methods': '双重验证方式',
    'SMS/Text message': '短信', 'Security keys': '安全密钥',
    'Delete confirmation': '删除确认', 'Register new security key': '注册新的安全密钥',
    'This security key has already been registered.': '此安全密钥已被注册。',
    'Recovery options': '恢复选项', 'Recovery codes': '恢复代码',
    'Two-factor authentication options': '双重身份验证选项',
    'Edit Authenticator app': '编辑身份验证器应用',
    'Add SMS/Text message': '添加短信', 'Edit Security keys': '编辑安全密钥',
    'Add GitHub Mobile': '添加 GitHub Mobile', 'View Recovery codes': '查看恢复代码',
    'Hide Security keys': '隐藏安全密钥',
    'Enable JavaScript to use your security key.': '请启用 JavaScript 以使用安全密钥。',
    'Filter inbox by…': '按以下条件筛选收件箱…', 'Filter by…': '筛选条件…',
    'New filter': '新建筛选', 'Inbox name': '收件箱名称',
    'Issues navigation': '议题导航', 'Filter issues': '筛选议题',
    'Sort by Updated descending': '按更新时间降序排列',
    'Any time': '任何时间', 'All caught up': '全部处理完毕',
    'Failing checks': '失败的检查',
    'Pull requests that are waiting for your review': '等待你评审的拉取请求',
    'Your pull requests that are ready to merge': '可合并的你的拉取请求',
    'Frequently Asked Questions': '常见问题',
    'Quick Start': '快速开始', 'Install via Homebrew': '通过 Homebrew 安装',
    'Features in Detail': '功能详解', 'Custom Scan Paths': '自定义扫描路径',
    'Quick Launchers': '快速启动器', 'Workflow run filters': '工作流运行筛选',
    'Every 10 seconds': '每 10 秒', 'Every 30 seconds': '每 30 秒',
    'Every minute': '每分钟', 'Every 5 minutes': '每 5 分钟',
    'Filter by Workflow': '按工作流筛选', 'Filter by Event': '按事件筛选',
    'Filter by Status': '按状态筛选', 'Filter by Branch': '按分支筛选',
    'Filter by Actor': '按操作者筛选', 'Filter by user': '按用户筛选',
    'Filter by issue type': '按议题类型筛选',
    'Issues with no type': '无类型的议题', 'Filter types': '筛选类型',
    'View workflow file': '查看工作流文件', 'Sort…': '排序…',
    'Search all discussions': '搜索所有讨论',
    'No labels found. Sorry about that.': '未找到标签，抱歉。',
    'Community links': '社区链接',
    'Export SBOM': '导出 SBOM', 'Search all dependencies': '搜索所有依赖',
    'Filter by ecosystem': '按生态系统筛选',
    'No ecosystems found.': '未找到生态系统。',
    'Show dependency options': '显示依赖选项',
    'Show paths': '显示路径', 'View transitive paths': '查看传递路径',
    'Dependency files checked': '已检查的依赖文件',
    'Reporting a Vulnerability': '报告漏洞',
    'Response Expectations': '响应预期', 'Supported Versions': '支持的版本',
    'Security fixes are only guaranteed for:': '安全修复仅保证适用于：',
    'What We Consider a Security Issue': '我们认定的安全问题',
    'What Usually Does Not Qualify': '通常不属于安全问题的情形',
    'There aren\'t any published security advisories': '暂无已发布的安全公告',
    'View merged pull requests': '查看已合并的拉取请求',
    'View open pull requests': '查看打开的拉取请求',
    'View closed issues': '查看已关闭的议题',
    'View open issues': '查看打开的议题',
    'Top committers': '提交最多的贡献者', 'Interactive chart': '交互式图表',
    'Issue templates': '议题模板', 'Pull request template': '拉取请求模板',
    'Not added yet': '尚未添加', 'Create pull request': '创建拉取请求',
    'Close': '关闭', 'Open': '打开', 'Expand': '展开', 'Collapse': '收起',
  });


  // 设置页分区标题、通知、Actions、依赖、赞助、定价页
  Object.assign(RAW_DICT, {
    // 个人资料设置分区
    'Contributions & activity': '贡献与活动',
    'Make profile private and hide activity': '将个人资料设为私密并隐藏活动',
    'Include private contributions on my profile': '在个人资料中包含私有贡献',
    'Profile settings': '个人资料设置',
    'GitHub Developer Program': 'GitHub 开发者计划',
    'GitHub developer program': 'GitHub 开发者计划',
    'Jobs profile': '求职资料', 'Available for hire': '可接受聘用',
    'Trending settings': '趋势设置', 'Trending Repositories': '趋势仓库',
    'Display current local time': '显示当前本地时间', 'Time zone': '时区',
    'Social account': '社交账号',
    'Link to social profile 1': '链接到社交资料 1', 'Link to social profile 2': '链接到社交资料 2',
    'Link to social profile 3': '链接到社交资料 3', 'Link to social profile 4': '链接到社交资料 4',
    'Account switcher': '账户切换', 'Single theme': '单一主题',
    // 通知与邮件
    'Pull Request reviews': '拉取请求评审', 'Pull Request pushes': '拉取请求推送',
    'Includes your own updates': '包含你自己的更新',
    'GitHub Free': 'GitHub 免费版', 'Copilot Free': 'Copilot 免费版',
    'Connected to Google': '已连接 Google', 'Disconnect from Google': '断开 Google 连接',
    'set your email in Git': '在 Git 中设置你的邮箱',
    'Allow all verified emails': '允许所有已验证邮箱',
    'Less secure': '安全性较低', 'now required': '现在必需',
    '— Registered on': '— 注册于', '| Last used': '| 上次使用',
    // 安全密钥
    'Upgrade `macOS` to passkey': '将 `macOS` 升级为通行密钥',
    'Delete `macOS` security key': '删除 `macOS` 安全密钥',
    'Confirm delete of `macOS` security key': '确认删除 `macOS` 安全密钥',
    'Cancel `macOS` security key delete': '取消删除 `macOS` 安全密钥',
    'Confirm delete `macOS` security key': '确认删除 `macOS` 安全密钥',
    'Enter a nickname for this security key': '为此安全密钥输入昵称',
    'Chrome on macOS': 'macOS 上的 Chrome',
    'generate a GPG key and add it to your account': '生成 GPG 密钥并添加到你的账户',
    'Are you sure you want to delete this token?': '确定要删除此令牌吗？',
    'Last used within the last 2 weeks': '最近两周内使用过',
    // Pull requests 工作台
    'ProTip!': '小提示！', 'Mentioning me': '提及我的',
    'No saved views': '没有已保存的视图', 'View options': '视图选项',
    'Saved views': '已保存的视图', 'Set as default view': '设为默认视图',
    'Default to this view when visiting': '访问时默认使用此视图',
    'issues and pull requests': '议题和拉取请求',
    'Collapse Your drafts': '收起你的草稿',
    'Collapse Waiting for review or checks': '收起等待评审或检查',
    'Collapse Needs action': '收起需要处理',
    'Collapse Ready to merge': '收起可合并',
    'Collapse Merging': '收起合并中',
    'Customize sections': '自定义分区',
    'Collapse Needs your review': '收起需要你评审',
    'Collapse Needs your teams\' review': '收起需要你团队评审',
    'Add this repository to a list': '将此仓库添加到列表',
    'You don\'t have any lists yet.': '你还没有任何列表。',
    'Select lists': '选择列表', 'Create Issue Branch': '创建议题分支',
    // 探索与趋势
    'Language:': '语言：', 'Trending repositories': '趋势仓库',
    'CI/CD and automation': 'CI/CD 与自动化',
    'Quality analysis, fixes, and enforcement': '质量分析、修复与强制执行',
    'Cloud development environments': '云开发环境',
    'Vulnerability detection and remediation': '漏洞检测与修复',
    'Secret Protection': '密钥保护',
    'Secret scanning and leak prevention': '密钥扫描与泄漏防护',
    'Build with Copilot': '使用 Copilot 构建', 'Customize Copilot': '自定义 Copilot',
    'Developer articles': '开发者文章',
    'GitHub Advanced Security': 'GitHub 高级安全',
    'Enterprise-grade code security': '企业级代码安全',
    'Copilot for business': '企业版 Copilot',
    'Enterprise-grade AI features': '企业级 AI 功能',
    'Enterprise-grade 24/7 support': '企业级 7×24 支持',
    'GitHub Universe': 'GitHub Universe 大会',
    // 赞助
    'See your top dependencies': '查看你的主要依赖',
    'Get sponsored': '获得赞助',
    'Support the developers who power open source': '支持驱动开源生态的开发者',
    'Given back to our maintainers': '已回馈给我们的维护者',
    'Regions supported globally': '支持的国家和地区',
    'Organizations sponsoring': '赞助的组织',
    'Learn about invoiced billing': '了解发票结算',
    'Help open source thrive': '助力开源繁荣',
    'Invest in open source. It powers your world.': '投资开源，它支撑着你的世界。',
    'How do I sponsor a project?': '如何赞助一个项目？',
    'How do I get paid for my contributions?': '我的贡献如何获得报酬？',
    'GitHub on LinkedIn': 'GitHub 的 LinkedIn', 'GitHub on Instagram': 'GitHub 的 Instagram',
    'GitHub on YouTube': 'GitHub 的 YouTube', 'GitHub on X': 'GitHub 的 X',
    'GitHub on TikTok': 'GitHub 的 TikTok', 'GitHub on Twitch': 'GitHub 的 Twitch',
    '(opens in a new tab)': '（在新标签页中打开）',
    // 新建仓库 / 组织 / 定价
    '(required)': '（必填）', 'Choose an owner': '选择所有者', 'Search owner': '搜索所有者',
    'Choose a .gitignore template': '选择 .gitignore 模板',
    'Choose a license': '选择许可证', 'License filter': '许可证筛选',
    'Choose a plan': '选择方案', 'Pick a plan for your organization': '为你的组织选择方案',
    'per user/month': '每位用户/月',
    'Create a free organization': '创建免费组织',
    'Unlimited public/private repositories': '无限公有/私有仓库',
    'Dependabot security and version updates': 'Dependabot 安全与版本更新',
    'Free for public repositories': '公有仓库免费',
    'Issues & Projects': '议题与项目', 'Featured add-ons': '精选附加功能',
    'GitHub Codespaces Access': 'GitHub Codespaces 访问权限',
    'GitHub Codespaces': 'GitHub Codespaces',
    'Show features': '显示功能', 'Most popular': '最受欢迎',
    'Advanced collaboration for': '面向以下对象的高级协作：',
    'individuals and organizations': '个人与组织',
    'Continue with Team': '继续使用 Team',
    'Everything included in Free, plus...': '包含免费版全部功能，另有…',
    'Access to GitHub Codespaces': '可使用 GitHub Codespaces',
    'Repository rules': '仓库规则', 'Draft pull requests': '草稿拉取请求',
    'Pages and Wikis': '页面与 Wiki',
    'Environment deployment branches and secrets': '环境部署分支与密钥',
    'GitHub Secret Protection': 'GitHub 密钥保护',
    'GitHub Code Security': 'GitHub 代码安全',
    'Security, compliance,': '安全、合规，',
    'Starting at': '起价', 'Start a free trial': '开始免费试用',
    'Contact Sales': '联系销售', 'Contact our sales team': '联系我们的销售团队',
    'Everything included in Team, plus...': '包含 Team 版全部功能，另有…',
    'Data residency': '数据驻留', 'Start a free 30 day trial': '开始 30 天免费试用',
    'Enterprise Managed Users': '企业托管用户',
    'User provisioning through SCIM': '通过 SCIM 配置用户',
    'Environment protection rules': '环境保护规则',
    'Audit Log API': '审计日志 API', 'SAML single sign-on': 'SAML 单点登录',
    'Advanced auditing': '高级审计', 'GitHub Connect': 'GitHub Connect',
    'Exclusive add-on': '专属附加功能', 'Compare features': '比较功能',
    'Features on': '功能位于', 'Switch plans': '切换方案',
    'Select a plan to review its features': '选择方案以查看其功能',
    'How to get started': '如何开始', 'Join for free': '免费加入',
    'Start Enterprise trial': '开始 Enterprise 试用',
    'Code management': '代码管理', 'Public repositories': '公有仓库',
    'Private repositories': '私有仓库', 'Code workflow': '代码工作流',
    'With policies and controls': '含策略与管控',
    'Ability to increase spend limit': '可提高支出上限',
    'GitHub Packages': 'GitHub Packages',
    'GitHub sandbox (public preview)': 'GitHub 沙箱（公开预览）',
    'Code reviews': '代码评审',
    'Multiple pull request assignees': '拉取请求多指派人',
    'Assign more than one person to a pull request.': '为一个拉取请求指派多人。',
    'Repository insights': '仓库洞察',
    'Automatic code review assignment': '自动分配代码评审',
    'Collaborators for public repositories': '公有仓库协作者',
    'Collaborators for private repositories': '私有仓库协作者',
    'Organization and team management': '组织与团队管理',
    'Pages and wikis': '页面与 Wiki',
    'Multiple issue assignees': '议题多指派人',
    'Assign more than one person to an issue.': '为一个议题指派多人。',
    'Push protection': '推送保护', 'Provider patterns': '提供方模式',
    'Provider notification': '提供方通知', 'Validity checks': '有效性检查',
    'AI detection for alerts': '告警的 AI 检测',
    'AI detection for push protection': '推送保护的 AI 检测',
    'Generic patterns': '通用模式', 'Custom patterns': '自定义模式',
    'Push protection bypass controls': '推送保护绕过管控',
    'Insights in security overview': '安全概览中的洞察',
    'Scan history API': '扫描历史 API', 'Copilot Autofix': 'Copilot 自动修复',
    'Security campaigns': '安全活动', 'Dependency review action': '依赖审查操作',
    'Dependabot custom auto-triage rules': 'Dependabot 自定义自动分诊规则',
    'Platform security and compliance': '平台安全与合规',
    'Artifact attestations': '制品证明',
    'GitHub Security Advisories': 'GitHub 安全公告',
    'Role-based access control': '基于角色的访问控制',
    'Required 2FA': '强制双重验证', 'Audit log': '审计日志',
    'SAML single sign-on (SSO)': 'SAML 单点登录（SSO）',
    'IP allow list': 'IP 允许列表', 'Enterprise Cloud': '企业云',
    'Limit access to known allowed IP addresses.': '仅允许访问已知 IP 地址。',
    'Marketplace and integrations': '市场与集成',
    'Status checks': '状态检查', 'Pre-receive hooks': '接收前钩子',
    'Enterprise Server': '企业服务器',
    'Support and deployment': '支持与部署',
    'Standard Support': '标准支持',
    'Premium and Premium Plus Support': '高级与高级增强支持',
    'Invoice billing': '发票结算', 'Self-hosted deployment': '自托管部署',
    // Actions
    'Open Branch views': '打开分支视图',
    'Open Releases and tags navigation': '打开发布与标签导航',
    'Releases and tags navigation': '发布与标签导航',
    'Tags results': '标签结果', 'Update Contributors': '更新贡献者',
    'Usage metrics': '使用指标', 'Performance metrics': '性能指标',
    'Refresh now': '立即刷新',
    'Filter workflow options': '筛选工作流选项',
    'Filter event options': '筛选事件选项',
    'Filter status options': '筛选状态选项',
    'Filter branch options': '筛选分支选项',
    'Filter actor options': '筛选操作者选项',
    'User results': '用户结果', 'Milestone results': '里程碑结果',
    'Issue Type results': '议题类型结果',
    // 讨论 / 依赖 / 安全
    'Categories, most helpful, and community links': '分类、最有帮助与社区链接',
    'OK, got it': '知道了',
    '· Detected by': '· 检测方式',
    'Showing 1 path. Export SBOM to view all paths.': '显示 1 条路径。导出 SBOM 可查看全部路径。',
    'Filter ecosystems': '筛选生态系统',
    'Filter by ecosystem options': '筛选生态系统选项',
    'Email:': '电子邮箱：', 'Subject line:': '邮件主题：',
    'Include as much of the following as possible:': '请尽可能包含以下信息：',
    'There aren\'t any published security advisories': '暂无已发布的安全公告',
    'Period:': '时间范围：',
    'Active pull requests': '活跃的拉取请求', 'Active issues': '活跃的议题',
    'New issues': '新建议题', 'releases published': '个发布已上线',
    'pull requests merged': '个拉取请求已合并',
  });


  // 补充：定价、Actions 运行、查询提示
  Object.assign(RAW_DICT, {
    'privacy statement': '隐私声明',
    'Copy query for Needs your review to clipboard': '复制「需要你评审」的查询到剪贴板',
    'Open search for Needs your review': '打开「需要你评审」的搜索',
    'Open search for Needs your teams\' review': '打开「需要你团队评审」的搜索',
    'Copy query for Your drafts to clipboard': '复制「你的草稿」的查询到剪贴板',
    'Open search for Your drafts': '打开「你的草稿」的搜索',
    'Open search for Waiting for review or checks': '打开「等待评审或检查」的搜索',
    'Copy query for Changes requested to clipboard': '复制「请求更改」的查询到剪贴板',
    'Open search for Changes requested': '打开「请求更改」的搜索',
    'Copy query for Failing checks to clipboard': '复制「失败的检查」的查询到剪贴板',
    'Open search for Failing checks': '打开「失败的检查」的搜索',
    'Copy query for Ready to merge to clipboard': '复制「可合并」的查询到剪贴板',
    'Open search for Ready to merge': '打开「可合并」的搜索',
    'GitHub Sponsors allows the developer community': 'GitHub Sponsors 让开发者社区',
    'Sign in and start by navigating to': '登录后先前往',
    'your dependencies': '你的依赖',
    'explore tab': '探索标签页',
    'trending repositories': '趋势仓库',
    'GitHub’s organization on GitHub': 'GitHub 在 GitHub 上的组织',
    'Chart displaying months a total amount spent': '显示每月总支出金额的图表',
    'Use suggested repository name shiny-telegram': '使用建议的仓库名 shiny-telegram',
    'today or': '立即，或',
    'contact our sales team': '联系我们的销售团队',
    'Audit log API': '审计日志 API',
    'queued:': '排队中：', 'cancelled:': '已取消：', 'failed:': '失败：',
    'Build Windows Prerelease': '构建 Windows 预发布版',
    'Bundle Drift Audit': '包体偏移审计',
    'Copilot code review': 'Copilot 代码评审',
    'Dependabot Updates': 'Dependabot 更新',
    'Linux Release': 'Linux 发布',
    'Real Flatpak and Snap': '真实 Flatpak 与 Snap',
    'Windows CI': 'Windows 持续集成',
    'Jupyter Notebook': 'Jupyter Notebook',
    '2,000 CI/CD minutes/month': '每月 2,000 CI/CD 分钟',
    '3,000 CI/CD minutes/month': '每月 3,000 CI/CD 分钟',
    '50,000 CI/CD minutes/month': '每月 50,000 CI/CD 分钟',
    '2,000 minutes/month': '每月 2,000 分钟',
    '3,000 minutes/month': '每月 3,000 分钟',
    '50,000 minutes/month': '每月 50,000 分钟',
    '500MB of Packages storage': '500MB Packages 存储',
    '2GB of Packages storage': '2GB Packages 存储',
    '50GB of Packages storage': '50GB Packages 存储',
    '$0 spend limit': '0 美元支出上限',
    'GitHub Actions': 'GitHub Actions',
  });


  // 补充：账户 / 安全 / 外观 / Copilot 设置的短标签
  Object.assign(RAW_DICT, {
    'settings': '设置',
    'Email address': '电子邮箱地址',
    'Default notification email': '默认通知邮箱',
    'Remove section': '移除分区',
    'More editors': '更多编辑器',
    'Go to Copilot': '前往 Copilot',
    'Inline suggestions': '内联建议',
    'Included credits': '包含的额度',
    'Upgrade plan': '升级方案',
    'Copilot in the cloud': '云端 Copilot',
    'Coming soon': '即将推出',
    'Copilot Chat in GitHub.com': 'GitHub.com 上的 Copilot Chat',
    'Copilot CLI': 'Copilot CLI',
    'Copilot in GitHub Desktop': 'GitHub Desktop 中的 Copilot',
    'GitHub Copilot app': 'GitHub Copilot 应用',
    'Copilot can search the web': 'Copilot 可以搜索网络',
    'Microsoft Privacy Statement': 'Microsoft 隐私声明',
    'Dashboard Entry Point': '仪表盘入口',
    'MCP servers in Copilot': 'Copilot 中的 MCP 服务器',
    'Copilot-generated commit messages': 'Copilot 生成的提交信息',
    'Copilot Spaces': 'Copilot Spaces',
    'Suggestions matching public code': '匹配公开代码的建议',
    'Allow GitHub to use my data for AI model training': '允许 GitHub 使用我的数据训练 AI 模型',
    'Privacy Statement': '隐私声明',
    'Show Copilot': '显示 Copilot',
    'Get Copilot from an organization': '从组织获取 Copilot',
    'You do not belong to any organizations.': '你不属于任何组织。',
    'Copilot Auto model selection': 'Copilot 自动选择模型',
    'You will have access to the feature': '你将可以使用此功能',
    'You won\'t have access to the feature': '你将无法使用此功能',
    'Semantic indexing for Non-GitHub Repositories': '非 GitHub 仓库的语义索引',
    'Current plan': '当前方案',
    'Advanced tools for private repos': '私有仓库的高级工具',
    'Upgrade to Pro': '升级到 Pro',
    'Looking for GitHub Copilot Pro?': '在找 GitHub Copilot Pro？',
    'View Copilot plans': '查看 Copilot 方案',
    'Protected branches': '受保护的分支',
    'Compare plans': '比较方案',
    'All the basics': '所有基础功能',
    'Organization features': '组织功能',
    'Enterprise compliance features': '企业合规功能',
    'Enterprise support': '企业支持',
    'The basics for individuals': '面向个人的基础方案',
    'and organizations': '与组织',
    'Export a software bill of materials (SBOM) for your repository.': '为你的仓库导出软件物料清单（SBOM）。',
    'Ensure unfalsifiable provenance and integrity for your software.': '为你的软件提供不可篡改的来源与完整性保障。',
    'Define users\' level of access to your code, data and settings.': '定义用户对你代码、数据和设置的访问级别。',
    'Quickly review the actions performed by members of your organization.': '快速审查组织成员执行的操作。',
    'Assign multiple users or a team to review a pull request.': '指派多个用户或一个团队来评审拉取请求。',
    'Read more about viewing contributions on your profile': '详细了解如何在个人资料中查看贡献',
    'You can manage verified email addresses in your': '你可以在',
    'email settings': '电子邮件设置',
    'Other users will see the time difference from their local time.': '其他用户会看到与其本地时间的时差。',
    'Your achievements will be shown on your profile.': '你的成就将显示在个人资料中。',
    'GitHub\'s standard light theme with full color contrast and brightness.': 'GitHub 标准浅色主题，色彩对比与亮度完整。',
    'This theme will be active when your system is set to “light mode”': '当系统设为「浅色模式」时启用此主题',
    'This theme will be active when your system is set to “dark mode”': '当系统设为「深色模式」时启用此主题',
    'Choose the number of spaces a tab is equal to when rendering code': '选择渲染代码时一个制表符等于多少个空格',
    'Add or remove instructions for how to operate complex controls.': '添加或移除复杂控件的操作说明。',
    'Select if URLs should be formatted on paste. You can use': '选择粘贴时是否格式化 URL。你可以使用',
    'Pasting a URL while having text selected will replace the text': '选中文本时粘贴 URL 会替换该文本',
    'There are no SSH keys associated with your account.': '你的账户尚未关联任何 SSH 密钥。',
    'There are no GPG keys associated with your account.': '你的账户尚未关联任何 GPG 密钥。',
    'Note that this will include your existing unsigned commits.': '注意：这将包含你现有的未签名提交。',
    'You don’t have any repositories yet. Would you like to': '你还没有任何仓库。是否要',
    'Tokens you have generated that can be used to access the': '你生成的、可用于访问',
    'Verify domains to restrict who can publish GitHub Pages on them.': '验证域名以限制谁可以在其上发布 GitHub Pages。',
    'Are you sure you want to disable two-factor authentication?': '确定要禁用双重身份验证吗？',
    'This browser doesn\'t support security keys yet.': '此浏览器尚不支持安全密钥。',
    'Delete: At least one verified email is required.': '删除：至少需要一个已验证的邮箱。',
    'Something went really wrong and we can’t process that picture.': '出现严重错误，无法处理该图片。',
    'Please upload a picture smaller than 10,000x10,000.': '请上传小于 10,000×10,000 的图片。',
    'Building an application, service, or tool that integrates with GitHub?': '正在构建与 GitHub 集成的应用、服务或工具？',
  });

  // 建立「原文」与「小写」两张索引
  const DICT_EXACT = Object.create(null);
  const DICT_LOWER = Object.create(null);
  for (const k in RAW_DICT) {
    const v = RAW_DICT[k];
    DICT_EXACT[k] = v;
    if (!(k.toLowerCase() in DICT_LOWER)) DICT_LOWER[k.toLowerCase()] = v;
  }
  function dictLookup(text) {
    return DICT_EXACT[text] || DICT_LOWER[text.toLowerCase()] || '';
  }

  /* ---------- 动态短语规则（正则），处理带数字/时间的整句 ---------- */
  const MONTH_CN = {};
  [['january', 'jan', '1月'], ['february', 'feb', '2月'], ['march', 'mar', '3月'],
   ['april', 'apr', '4月'], ['may', 'may', '5月'], ['june', 'jun', '6月'],
   ['july', 'jul', '7月'], ['august', 'aug', '8月'], ['september', 'sep', '9月'],
   ['october', 'oct', '10月'], ['november', 'nov', '11月'], ['december', 'dec', '12月']]
    .forEach(([full, abbr, cn]) => { MONTH_CN[full] = cn; MONTH_CN[abbr] = cn; });
  const WEEK_CN = { mon: '周一', monday: '周一', tue: '周二', tuesday: '周二', wed: '周三', wednesday: '周三', thu: '周四', thursday: '周四', fri: '周五', friday: '周五', sat: '周六', saturday: '周六', sun: '周日', sunday: '周日' };
  const REL_UNIT = { second: '秒', minute: '分钟', hour: '小时', day: '天', week: '周', month: '个月', year: '年' };
  const UNIT_ABBR = { s: '秒', m: '分钟', h: '小时', d: '天', w: '周', mo: '个月', y: '年' };
  const VERB_TIME = { opened: '打开于 ', updated: '更新于 ', committed: '提交于 ', created: '创建于 ', closed: '关闭于 ', merged: '合并于 ', pushed: '推送于 ', reopened: '重新打开于 ' };
  const GREET = { morning: '早上好', afternoon: '下午好', evening: '晚上好', night: '夜深了' };
  const monthCn = (n) => MONTH_CN[(n || '').toLowerCase()] || '';
  // 把 "May 15" / "May 15, 2024" 这类日期短语转中文，其它原样返回
  function cnDate(phrase) {
    const t = (phrase || '').trim();
    const m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})?$/.exec(t);
    if (m) { const c = monthCn(m[1]); if (c) return `${m[3] ? m[3] + '年' : ''}${c}${m[2]}日`; }
    return t;
  }

  // 相对时间：3 weeks ago → 3 周前
  function relCn(num, unit) {
    const key = String(unit).toLowerCase().replace(/s$/, '');
    const u = REL_UNIT[key];
    if (!u) return '';
    return num + ' ' + u + '前';
  }
  function translateRelative(t) {
    const s2 = (t || '').trim();
    let m;
    if ((m = /^just now$/i.exec(s2))) return '刚刚';
    if ((m = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(s2))) return relCn(m[1], m[2]);
    if ((m = /^an?\s+(second|minute|hour|day|week|month|year)\s+ago$/i.exec(s2))) return relCn('1', m[1]);
    if ((m = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+from now$/i.exec(s2))) return relCn(m[1], m[2]).replace('前', '后');
    if ((m = /^(yesterday|today)$/i.exec(s2))) return /yesterday/i.test(m[1]) ? '昨天' : '今天';
    return '';
  }

  const PATTERN_RULES = [
    // 贡献 / 关注统计
    [/^(\d[\d,]*)\s+contributions? in the last year$/i, (m) => `${m[1]} 次贡献（过去一年）`],
    [/^(\d[\d,]*)\s+contributions?$/i, (m) => `${m[1]} 次贡献`],
    [/^(\d[\d,]*)\s+followers?\s*[·•]\s*(\d[\d,]*)\s+following$/i, (m) => `${m[1]} 位关注者 · 正在关注 ${m[2]} 人`],
    [/^(\d[\d,]*)\s+followers?$/i, (m) => `${m[1]} 位关注者`],
    [/^(\d[\d,]*)\s+following$/i, (m) => `正在关注 ${m[1]} 人`],
    [/^Created (\d[\d,]*)\s+commits? in (\d[\d,]*)\s+repositor(?:y|ies)$/i, (m) => `在 ${m[2]} 个仓库中创建了 ${m[1]} 个提交`],
    [/^Created (\d[\d,]*)\s+repositor(?:y|ies)$/i, (m) => `创建了 ${m[1]} 个仓库`],
    [/^Created (\d[\d,]*)\s+commits?$/i, (m) => `创建了 ${m[1]} 个提交`],
    [/^Created (\d[\d,]*)\s+branch(?:es)?$/i, (m) => `创建了 ${m[1]} 个分支`],
    [/^Created (\d[\d,]*)\s+issues?$/i, (m) => `创建了 ${m[1]} 个议题`],
    [/^Created (\d[\d,]*)\s+pull requests?$/i, (m) => `创建了 ${m[1]} 个拉取请求`],
    [/^Forked from (\S+)$/i, (m) => `复刻自 ${m[1]}`],
    [/^Opened by (.+)$/i, (m) => `由 ${m[1]} 打开`],
    [/^Updated (.+)$/i, (m) => { const r = translateRelative(m[1]); return r ? `更新于 ${r}` : ''; }],
    [/^(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)$/i, (m) => translateRelative(m[1])],
    [/^(an?\s+(?:second|minute|hour|day|week|month|year)\s+ago)$/i, (m) => translateRelative(m[1])],
    [/^(just now|yesterday|today)$/i, (m) => translateRelative(m[1])],
    [/^on ([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})?$/i, (m) => { const c = monthCn(m[1]); return c ? `于 ${m[3] ? m[3] + '年' : ''}${c}${m[2]}日` : ''; }],
    // 纯计数
    [/^(\d[\d,]*)\s+commits?$/i, (m) => `${m[1]} 个提交`],
    [/^(\d[\d,]*)\s+repositories$/i, (m) => `${m[1]} 个仓库`],
    [/^(\d[\d,]*)\s+stars?$/i, (m) => `${m[1]} 个星标`],
    [/^(\d[\d,]*)\s+forks?$/i, (m) => `${m[1]} 个复刻`],
    [/^(\d[\d,]*)\s+issues?$/i, (m) => `${m[1]} 个议题`],
    [/^(\d[\d,]*)\s+pull requests?$/i, (m) => `${m[1]} 个拉取请求`],
    [/^(\d[\d,]*)\s+comments?$/i, (m) => `${m[1]} 条评论`],
    // 相对时间
    [/^just now$/i, () => '刚刚'],
    [/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i, (m) => `${m[1]} ${REL_UNIT[m[2].toLowerCase()]}前`],
    [/^(a|an)\s+(second|minute|hour|day|week|month|year)\s+ago$/i, (m) => `1 ${REL_UNIT[m[2].toLowerCase()]}前`],
    // 日期
    [/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})$/i, (m) => { const c = monthCn(m[1]); return c ? `${m[3]}年${c}${m[2]}日` : ''; }],
    [/^([A-Za-z]+)\.?\s+(\d{1,2})$/i, (m) => { const c = monthCn(m[1]); return c ? `${c}${m[2]}日` : ''; }],
    [/^Updated on (.+)$/i, (m) => `更新于 ${cnDate(m[1])}`],
    // 星期
    [/^(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, (m) => WEEK_CN[m[1].toLowerCase()] || ''],
    // 问候
    [/^Good (morning|afternoon|evening|night)[,!]?\s*(.*?)[!.]?$/i, (m) => {
      const g = GREET[m[1].toLowerCase()] || '';
      const who = (m[2] || '').replace(/[!.,]+$/, '').trim();
      return g + (who ? `，${who}` : '') + '！';
    }],
    // 动态组合（星标趋势 / 贡献日历 / 合集）
    [/^(\d[\d,]*)\s+new stars? this week$/i, (m) => `本周新增 ${m[1]} 个星标`],
    [/^No contributions on (.+)$/i, (m) => `${cnDate(m[1])} 无贡献`],
    [/^See the (\d[\d,]*)\s+items? in this collection$/i, (m) => `查看此合集中的 ${m[1]} 项`],
    [/^(\d[\d,]*)\s+items? in this collection$/i, (m) => `此合集共 ${m[1]} 项`],
    [/^(opened|updated|committed|created|closed|merged|pushed|reopened)\s+(\d+)\s*(mo|s|m|h|d|w|y)\s+ago$/i, (m) => `${VERB_TIME[m[1].toLowerCase()] || ''}${m[2]}${UNIT_ABBR[m[3].toLowerCase()]}前`],
    [/^(\d+)\s*(mo|s|m|h|d|w|y)\s+ago$/i, (m) => `${m[1]}${UNIT_ABBR[m[2].toLowerCase()]}前`],
    [/^(\d[\d,]*)\s+budgets?$/i, (m) => `${m[1]} 个预算`],
    [/^(\d+)-(\d+) of (\d+)$/, (m) => `第 ${m[1]}-${m[2]} 条，共 ${m[3]} 条`],
    [/^\$([\d,.]+)\s*\/\s*\$([\d,.]+)\s+spent$/i, (m) => `$${m[1]} / $${m[2]} 已花费`],
    [/^Timeframe: (.+)$/i, (m) => { const map = { 'current month': '本月', 'last month': '上个月', 'last 30 days': '最近 30 天' }; return `时间范围：${map[m[1].trim().toLowerCase()] || m[1].trim()}`; }],
    [/^Group by: (.+)$/i, (m) => `分组方式：${m[1].trim() === 'None' ? '无' : m[1].trim()}`],
    [/^Scope: (.+)$/i, (m) => `范围：${m[1].trim()}`],
    [/^of (\d+)$/i, (m) => `共 ${m[1]} 条`],
    [/^View (.+) website$/i, (m) => `访问 ${m[1]} 网站`],
    [/^This contribution was made on (.+)$/i, (m) => `此贡献于 ${cnDate(m[1])}`],
    [/^Star (.+)$/i, (m) => `星标 ${m[1]}`],
    [/^Selected (\d+) repositories?\.$/i, (m) => `已选 ${m[1]} 个仓库。`],
    [/^Showing (\d+) to (\d+) of (\d+) budgets$/i, (m) => `显示第 ${m[1]} 至 ${m[2]} 个预算，共 ${m[3]} 个`],
    [/^Seen in (.+)$/i, (m) => `出现在 ${m[1]}`],
    [/^About the “(.+)” section$/i, (m) => `关于“${m[1]}”部分`],
    [/^Sponsor @(.+)$/i, (m) => `赞助 @${m[1]}`],
    [/^Starred, click to unstar this repository(?: \(\d[\d,]*\))?$/i, () => '已星标，点击取消星标此仓库'],
    [/^Repository menu: (.+)$/i, (m) => `仓库菜单：${m[1]}`],
    [/^Topic: (.+)$/i, (m) => `话题：${m[1]}`],
    [/^Commit ([0-9a-f]{6,})$/i, (m) => `提交 ${m[1]}`],
    [/^commits by (.+)$/i, (m) => `由 ${m[1]} 提交`],
    [/^Releases: (.+)$/i, (m) => `发行版：${m[1]}`],
    [/^Learn more about (.+)$/i, (m) => `了解有关 ${m[1]} 的更多信息`],
    [/^Filter by age: (.+)$/i, (m) => `按时间筛选：${m[1]}`],
    [/^Sort by (.+)$/i, (m) => { const map = { 'newest descending': '最新优先', 'newest ascending': '最早优先', 'recently starred': '最近星标', 'recently active': '最近活跃', 'best match': '最佳匹配', 'most stars': '星标最多', 'last updated': '最近更新' }; const v = map[m[1].trim().toLowerCase()]; return v ? `排序方式：${v}` : ''; }],
    [/^No recoverable packages were found for (.+)\.$/i, (m) => `未找到 ${m[1]} 的可恢复软件包。`],
    [/^Unstar (.+)$/i, (m) => `取消星标 ${m[1]}`],
    [/^Permalink: (.+)$/i, (m) => `永久链接：${m[1]}`],
    [/^Copy full SHA for (.+)$/i, (m) => `复制 ${m[1]} 的完整 SHA`],
    [/^Show description for (.+)$/i, (m) => `显示 ${m[1]} 的描述`],
    [/^More actions for workflow run (\d+)$/i, (m) => `工作流运行 ${m[1]} 的更多操作`],
    [/^Follow (.+)$/i, (m) => `关注 ${m[1]}`],
    [/^Unfollow (.+)$/i, (m) => `取消关注 ${m[1]}`],
    [/^Filter by author (.+)$/i, (m) => `按作者筛选：${m[1]}`],
    [/^Filter by review: (.+)$/i, (m) => `按评审筛选：${m[1]}`],
    [/^Filter by assignee (.+)$/i, (m) => `按指派人筛选：${m[1]}`],
    [/^Milestone: (.+)$/i, (m) => `里程碑：${m[1]}`],
    [/^Page (\d+)$/i, (m) => `第 ${m[1]} 页`],
    [/^Page (\d+)\.\.\.$/i, (m) => `第 ${m[1]} 页…`],
    [/^Showing (\d+) of (\d+) repositories$/i, (m) => `显示 ${m[1]}/${m[2]} 个仓库`],
    [/^React with (.+)$/i, (m) => `用 ${m[1]} 回应`],
    [/^Label: (.+)$/i, (m) => { const map = { 'verified': '已验证', 'public': '公开', 'github sponsor': 'GitHub 赞助者' }; return `标签：${map[m[1].trim().toLowerCase()] || m[1]}`; }],
    [/^Show (\d+) more topics?$/i, (m) => `显示另外 ${m[1]} 个话题`],
    [/^(.+) language$/i, (m) => `${m[1]} 语言`],
    [/^Starred, click to unstar this topic$/i, () => '已星标，点击取消星标此话题'],
    [/^#(\d+) updated$/i, (m) => `#${m[1]} 已更新`],
    [/^Revoke (.+)$/i, (m) => `撤销 ${m[1]}`],
    [/^Report (.+)$/i, (m) => `举报 ${m[1]}`],
    [/^Expires on \w+, (.+)\.$/i, (m) => `于 ${cnDate(m[1])} 到期。`],
    [/^(\d+)\/(\d+) complete$/i, (m) => `已完成 ${m[1]}/${m[2]}`],
    [/^Export all repositories and profile metadata for (.+?)\. Exports will be available for 7 days\.$/i, (m) => `导出 ${m[1]} 的所有仓库和个人资料元数据。导出文件将在 7 天内可用。`],
    [/^Connect a Patreon account for (.+?) to sponsor maintainers with\. Get recognition on GitHub for sponsorships made on Patreon when the sponsored person has linked Patreon and GitHub, too, and has a public GitHub Sponsors profile\.$/i, (m) => `为 ${m[1]} 关联一个 Patreon 账户以赞助维护者。当被赞助者同时关联了 Patreon 与 GitHub 并拥有公开的 GitHub Sponsors 主页时，你在 Patreon 上的赞助也能在 GitHub 上获得认可。`],
    [/^By clicking "Add Successor" below, I acknowledge that I am the owner of the (.+?) account, and am authorizing GitHub to transfer content within that account to my GitHub Successor, designated below, in the event of my death\. I understand that this appointment of a successor does not override legally binding next-of-kin rules or estate laws of any relevant jurisdiction, and does not create a binding will\.$/i, (m) => `点击下方“添加继任者”，即表示我确认自己是 ${m[1]} 账户的所有者，并授权 GitHub 在我身故时将账户内的内容转移给下方指定的 GitHub 继任者。我理解此继任者指定不凌驾于任何相关司法管辖区的法定近亲规则或遗产法，也不构成具有约束力的遗嘱。`],
    [/^(\d+)\s+Branch$/i, (m) => `${m[1]} 个分支`],
    [/^(\d+)\s+Tag$/i, (m) => `${m[1]} 个标签`],
    [/^Period: (.+)$/i, (m) => { const map = { 'all-time': '全部时间', 'today': '今天', 'last week': '上周', 'last month': '上个月', 'last year': '去年' }; return `时间范围：${map[m[1].trim().toLowerCase()] || m[1].trim()}`; }],
    [/^base: (.+)$/i, (m) => `基础：${m[1]}`],
    [/^compare: (.+)$/i, (m) => `比较：${m[1]}`],
    [/^Delete (.+)$/i, (m) => `删除 ${m[1]}`],
    [/^Open search for (.+)$/i, (m) => `打开「${m[1]}」的搜索`],
    [/^Copy query for (.+) to clipboard$/i, (m) => `复制「${m[1]}」的查询到剪贴板`],
    [/^(\d+)\/(\d+) checks passing$/i, (m) => `${m[1]}/${m[2]} 项检查通过`],
    [/^(\d[\d,]*) workflow runs$/i, (m) => `${m[1]} 次工作流运行`],
  ];

  function patternTranslate(text) {
    const t = (text || '').trim();
    if (!t) return '';
    for (const [re, fn] of PATTERN_RULES) {
      const m = re.exec(t);
      if (m) { const r = fn(m); if (r) return r; }
    }
    return '';
  }

  /* ============================================================
   * 二、缓存（内存 + 持久化）
   * ============================================================ */
  const CACHE_KEY = 'gh-zh-cache-v1';
  const CACHE_MAX = 5000;
  const cache = new Map();

  (function loadCache() {
    try {
      const rawText = (typeof GM_getValue === 'function')
        ? GM_getValue(CACHE_KEY, '')
        : localStorage.getItem(CACHE_KEY) || '';
      if (!rawText) return;
      const obj = JSON.parse(rawText);
      for (const k in obj) cache.set(k, obj[k]);
    } catch (e) { /* 忽略 */ }
  })();

  let saveTimer = null;
  function saveCache() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        const entries = [...cache.entries()].slice(-CACHE_MAX);
        const str = JSON.stringify(Object.fromEntries(entries));
        if (typeof GM_setValue === 'function') GM_setValue(CACHE_KEY, str);
        else localStorage.setItem(CACHE_KEY, str);
      } catch (e) { /* 忽略 */ }
    }, 1500);
  }

  /* ============================================================
   * 三、判定工具
   * ============================================================ */
  const processedText = new WeakSet();  // 已处理的文本节点
  const zhToEn = new Map();             // 译文 → 原文（用于关闭翻译时还原）
  const originalMap = new Map();        // 文本节点 → 原文（按钮关闭时还原）
  const pendingZh = new Map();          // 原文(规范化) → 译文，供 DOM 重建后补写
  const CJK = /[\u2E80-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
  const containsCJK = (s) => CJK.test(s);

  function isTranslatable(text) {
    const t = (text || '').trim();
    if (t.length < 2) return false;
    if (containsCJK(t)) return false;
    if (!/[A-Za-z]/.test(t)) return false;
    if (/^[\d\s\W]+$/.test(t)) return false;
    if (/^v?\d+(\.\d+){1,4}[-+.\w]*$/i.test(t)) return false; // 版本号
    if (/^(https?:\/\/|www\.)/i.test(t)) return false;        // URL
    if (!/\s/.test(t) && /^[\w.\-/@]+\.(js|ts|jsx|tsx|json|md|yml|yaml|py|go|rs|java|c|cpp|h|css|scss|html|sh|toml|lock|txt|png|jpg|svg)$/i.test(t)) return false;
    return true;
  }

  // 属性文本里，路径/仓库名/文件名之类跳过
  function isIdentifierLike(t) {
    const s = t.trim();
    if (/\s/.test(s)) return false;
    if (s.length > 80) return false;
    return /[\/.]/.test(s) && /^[A-Za-z0-9._\-\/]+$/.test(s);
  }

  function DICT_HAS_EXACT(t) {
    try { return !!(DICT_EXACT[t] || DICT_LOWER[String(t).toLowerCase()]); } catch (e) { return false; }
  }

  function isIdentifierInLink(node) {
    const el = node.parentElement;
    if (!el) return false;
    const link = el.closest('a, [role="link"]');
    if (!link) return false;
    const t = (node.nodeValue || '').trim();
    if (/\s/.test(t)) return false;
    if (t.length > 60) return false;
    return /^[A-Za-z0-9._\-\/@]+$/.test(t);
  }

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest('[data-zh-toggle]')) return true;
    if (el.isContentEditable) return true;
    if (el.closest(CFG.skipSelectors)) return true;
    if (!CFG.translateRepoDesc && isRepoDescContext(el)) return true;
    if (!CFG.translateReadme && isReadmeContext(el)) return true;
    if (!CFG.translateIssue && isIssueContext(el)) return true;
    // 开关已打开：明确允许翻译这些区域（覆盖其它兜底规则）
    if (CFG.translateRepoDesc && isRepoDescContext(el)) return false;
    if (CFG.translateReadme && isReadmeContext(el)) return false;
    if (CFG.translateIssue && isIssueContext(el)) return false;
    return false;
  }

  // 仓库描述/简介区域（受 ⑧ 开关控制）
  const REPO_DESC_SELECTORS = '[itemprop="description"], .repository-description, '
    + '[data-testid="repository-description"], .repo-list-description, '
    + '.org-repos-repo-description, [class*="SidebarAbout"][class*="description"], '
    + '[class*="repo-description"], [class*="OverviewSidebar"] [class*="description"]';
  function isRepoDescContext(el) {
    try {
      if (!el || !el.closest) return false;
      // 链接、按钮等交互元素不视为「描述正文」
      if (el.closest('a, button, [data-zh-toggle]')) return false;
      return !!el.closest(REPO_DESC_SELECTORS);
    } catch (e) { return false; }
  }

  // README 正文区域（受页面按钮控制，默认不翻译）
  const README_SELECTORS = '.repository-content .markdown-body, [data-testid="readme"] .markdown-body, '
    + '#readme .markdown-body, [class*="DirectoryRichtextContent"] .markdown-body, '
    + '[data-testid="readme-content"]';
  function isReadmeContext(el) {
    try { return !!(el && el.closest && el.closest(README_SELECTORS)); } catch (e) { return false; }
  }

  // Issue / PR 正文与评论区（受页面按钮控制，默认不翻译）
  const ISSUE_SELECTORS = '[class*="IssueBody"] .markdown-body, [class*="IssueCommentBody"] .markdown-body, '
    + '[class*="CommentBody"] .markdown-body, [class*="PullRequestComment"] .markdown-body, '
    + '[data-testid="issue-body"] .markdown-body, [class*="ReviewComment"] .markdown-body';
  function isIssueContext(el) {
    try { return !!(el && el.closest && el.closest(ISSUE_SELECTORS)); } catch (e) { return false; }
  }

  // 用户名 / 登录名等专有名词区域：一律不翻译
  const USER_SELECTORS = '.p-name, .p-nickname, .user-mention, [data-hovercard-type="user"], '
    + '[data-hovercard-url^="/users/"], a.author, .author, [itemprop="name"], [data-testid="profile-name"], '
    + '#settings-header, h1#settings-header, .vcard-fullname, .vcard-username, [data-testid="profile-name-link"]';
  function isUserContext(el) {
    try { return !!(el && el.closest && el.closest(USER_SELECTORS)); } catch (e) { return false; }
  }

  // 属性文字用的跳过判断：input/textarea 自身的 placeholder 仍需翻译
  function shouldSkipAttr(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('[data-zh-skip]')) return true;
    // 搜索框：只翻译占位提示，输入内容/查询串本来就不在翻译属性里
    const parent = el.parentElement;
    if (parent && parent.closest('pre, code, .blob-code, .highlight, [aria-labelledby="files"], [role="tree"], .react-directory-row')) return true;
    return false;
  }

  /* ============================================================
   * 四、翻译单元（统一处理「文本节点」与「属性」）
   * ============================================================ */
  function unitText(u) {
    return u.kind === 'text' ? (u.node.nodeValue || '') : (u.el.getAttribute(u.attr) || '');
  }
  function applyUnit(u, zh) {
    if (u.kind === 'text') {
      const raw = u.node.nodeValue;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
      u.node.nodeValue = (m ? m[1] : '') + zh + (m ? m[3] : '');
    } else {
      u.el.setAttribute(u.attr, zh);
    }
  }
  function isUnitDone(u) {
    if (u.kind === 'text') return processedText.has(u.node);
    return !!(u.el.__zhAttrs && u.el.__zhAttrs.has(u.attr));
  }
  function markUnitDone(u) {
    if (u.kind === 'text') processedText.add(u.node);
    else (u.el.__zhAttrs || (u.el.__zhAttrs = new Set())).add(u.attr);
  }
  function unitHostEl(u) {
    return u.kind === 'text' ? u.node.parentElement : u.el;
  }

  /* ============================================================
   * 五、网络请求 & 翻译源
   * ============================================================ */
  function gmRequest(opts) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        timeout: 8000,
        onload: (r) => (r.status >= 200 && r.status < 300)
          ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status)),
        onerror: () => reject(new Error('network')),
        ontimeout: () => reject(new Error('timeout')),
        ...opts,
      });
    });
  }
  const gmGet = (url) => gmRequest({ method: 'GET', url });
  const gmPost = (url, body, headers) => gmRequest({ method: 'POST', url, data: body, headers: headers || {} });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 5.1 必应 / Edge 内置翻译（免费无需 Key，国内可用）
  let bingToken = null, bingTokenExp = 0;
  async function bingBatch(texts) {
    if (!bingToken || Date.now() > bingTokenExp) {
      const jwt = await gmGet('https://edge.microsoft.com/translate/auth');
      bingToken = (jwt || '').trim();
      if (!bingToken) throw new Error('bing auth empty');
      bingTokenExp = Date.now() + 8 * 60 * 1000;
    }
    const body = JSON.stringify(texts.map((t) => ({ Text: t })));
    const res = await gmPost(
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans',
      body, { 'Authorization': 'Bearer ' + bingToken, 'Content-Type': 'application/json' }
    );
    const arr = JSON.parse(res);
    return arr.map((o) => (o.translations && o.translations[0] ? o.translations[0].text : ''));
  }

  // 5.2 Google 免费端点（国外可用）
  async function googleBatch(texts) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx'
      + '&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(texts.join('\n'));
    const data = JSON.parse(await gmGet(url));
    if (!data || !data[0]) throw new Error('google empty');
    let out = '';
    for (const seg of data[0]) if (seg && seg[0]) out += seg[0];
    const parts = out.split('\n');
    if (parts.length !== texts.length) throw new Error('google align');
    return parts;
  }

  // 5.3 有道 web 免费接口
  async function youdaoBatch(texts) {
    const url = 'https://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i='
      + encodeURIComponent(texts.join('\n'));
    const data = JSON.parse(await gmGet(url));
    if (!data || !data.translateResult) throw new Error('youdao empty');
    const out = data.translateResult.map((line) => line.map((seg) => seg.tgt || '').join(''));
    if (out.length !== texts.length) throw new Error('youdao align');
    return out;
  }

  // 5.3b 腾讯交互翻译 transmart（国内可用，免费无需 Key）
  async function tencentBatch(texts) {
    const body = JSON.stringify({
      header: { fn: 'auto_translation', client_key: 'browser-chrome-110.0.0-' + Date.now() },
      type: 'plain',
      model_category: 'normal',
      source: { lang: 'en', text_list: texts },
      target: { lang: 'zh' },
    });
    const res = await gmPost('https://transmart.qq.com/api/imt', body,
      { 'Content-Type': 'application/json', 'Accept': 'application/json' });
    const data = JSON.parse(res);
    const arr = data && (data.auto_translation || (data.data && data.data.auto_translation));
    if (Array.isArray(arr) && arr.length === texts.length) return arr.map((x) => (x == null ? '' : String(x)));
    throw new Error('tencent bad');
  }

  // 5.4 MyMemory（兜底，逐条）
  async function myMemoryBatch(texts) {
    const out = [];
    for (const t of texts) {
      const url = 'https://api.mymemory.translated.net/get?langpair=en|zh-CN&q='
        + encodeURIComponent(t);
      const data = JSON.parse(await gmGet(url));
      const s = (data && data.responseData && data.responseData.translatedText) || '';
      if (!s) throw new Error('mymemory empty');
      out.push(s);
      await sleep(120);
    }
    return out;
  }

  /* ---------- 可选翻译源：百度 / 腾讯云 TMT / AI（OpenAI 兼容） ---------- */
  const CREDS_KEY = 'ghzh_creds_v1';
  const creds = (function () {
    var raw = '';
    try { if (typeof GM_getValue === 'function') raw = GM_getValue(CREDS_KEY, '') || ''; } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(CREDS_KEY) || ''; } catch (e) {} }
    try { return JSON.parse(raw || '{}') || {}; } catch (e) { return {}; }
  })();
  function saveCreds() {
    var json = JSON.stringify(creds);
    try { if (typeof GM_setValue === 'function') GM_setValue(CREDS_KEY, json); } catch (e) {}
    try { localStorage.setItem(CREDS_KEY, json); } catch (e) {}
  }
  function isConfigured(name) {
    if (name === 'baidu') return !!(creds.baidu && creds.baidu.appid && creds.baidu.key);
    if (name === 'tencentcloud') return !!(creds.tencentcloud && creds.tencentcloud.secretId && creds.tencentcloud.secretKey);
    if (name === 'ai') return !!(creds.ai && creds.ai.apiKey && creds.ai.model && creds.ai.baseUrl);
    return true;
  }

  function utf8(s) { try { return unescape(encodeURIComponent(s)); } catch (e) { return s; } }
  function md5(str) {
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
    function cmn(q, a, b, x, s2, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s2) | (a >>> (32 - s2)), b); }
    function ff(a, b, c, d, x, s2, t) { return cmn((b & c) | ((~b) & d), a, b, x, s2, t); }
    function gg(a, b, c, d, x, s2, t) { return cmn((b & d) | (c & (~d)), a, b, x, s2, t); }
    function hh(a, b, c, d, x, s2, t) { return cmn(b ^ c ^ d, a, b, x, s2, t); }
    function ii(a, b, c, d, x, s2, t) { return cmn(c ^ (b | (~d)), a, b, x, s2, t); }
    function md5blk(s2) { var k = []; for (var i = 0; i < 64; i += 4) k[i >> 2] = s2.charCodeAt(i) + (s2.charCodeAt(i + 1) << 8) + (s2.charCodeAt(i + 2) << 16) + (s2.charCodeAt(i + 3) << 24); return k; }
    function cycle(x, k) {
      var a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function md5str(s2) {
      var n = s2.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
      for (i = 64; i <= s2.length; i += 64) cycle(state, md5blk(s2.substring(i - 64, i)));
      s2 = s2.substring(i - 64);
      var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0; i < s2.length; i++) tail[i >> 2] |= s2.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) { cycle(state, tail); tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; }
      tail[14] = n * 8; cycle(state, tail);
      return state;
    }
    function rhex(n) { var s2 = '', j; for (j = 0; j < 4; j++) s2 += ('0' + ((n >> (j * 8)) & 255).toString(16)).slice(-2); return s2; }
    return md5str(str).map(rhex).join('');
  }

  // 百度翻译（官方 API，需 APPID + 密钥）
  async function baiduBatch(texts) {
    if (!isConfigured('baidu')) throw new Error('baidu unconfigured');
    var appid = creds.baidu.appid, key = creds.baidu.key;
    var q = texts.join('\n');
    var salt = String(Date.now());
    var sign = md5(utf8(appid + q + salt + key));
    var url = 'https://fanyi-api.baidu.com/api/trans/vip/translate?q=' + encodeURIComponent(q)
      + '&from=auto&to=zh&appid=' + encodeURIComponent(appid)
      + '&salt=' + salt + '&sign=' + sign;
    var data = JSON.parse(await gmGet(url));
    if (!data || data.error_code) throw new Error('baidu ' + (data ? data.error_code : 'empty'));
    var arr = (data.trans_result || []).map(function (x) { return x.dst; });
    if (arr.length !== texts.length) throw new Error('baidu align');
    return arr;
  }

  // 腾讯云机器翻译 TMT（TC3-HMAC-SHA256 签名，需 SecretId/SecretKey）
  function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  async function sha256Hex(str) {
    var buf = new TextEncoder().encode(str);
    return hexOf(await crypto.subtle.digest('SHA-256', buf));
  }
  async function hmacHex(keyStr, msgStr) {
    var enc = new TextEncoder();
    var k = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hexOf(await crypto.subtle.sign('HMAC', k, enc.encode(msgStr)));
  }
  async function tencentCloudOne(text) {
    var c = creds.tencentcloud;
    var region = c.region || 'ap-guangzhou';
    var service = 'tmt', host = 'tmt.tencentcloudapi.com', action = 'TextTranslate', version = '2018-03-21';
    var payload = JSON.stringify({ SourceText: text, Source: 'en', Target: 'zh', ProjectId: 0 });
    var ts = Math.floor(Date.now() / 1000);
    var date = new Date(ts * 1000).toISOString().slice(0, 10);
    var ct = 'application/json; charset=utf-8';
    var canonicalHeaders = 'content-type:' + ct + '\nhost:' + host + '\n';
    var signedHeaders = 'content-type;host';
    var hashedPayload = await sha256Hex(payload);
    var canonicalRequest = 'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + hashedPayload;
    var credentialScope = date + '/' + service + '/tc3_request';
    var stringToSign = 'TC3-HMAC-SHA256\n' + ts + '\n' + credentialScope + '\n' + await sha256Hex(canonicalRequest);
    var secretDate = await hmacHex('TC3' + c.secretKey, date);
    var secretService = await hmacHex(secretDate, service);
    var secretSigning = await hmacHex(secretService, 'tc3_request');
    var signature = await hmacHex(secretSigning, stringToSign);
    var auth = 'TC3-HMAC-SHA256 Credential=' + c.secretId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
    var res = await gmPost('https://' + host, payload, {
      'Content-Type': ct, 'Authorization': auth, 'X-TC-Action': action,
      'X-TC-Timestamp': String(ts), 'X-TC-Version': version, 'X-TC-Region': region,
    });
    var data = JSON.parse(res); var r = data.Response || {};
    if (r.Error) throw new Error('tencentcloud ' + r.Error.Code);
    return (r.TextTranslate && r.TextTranslate.TargetText) || '';
  }
  async function tencentCloudBatch(texts) {
    if (!isConfigured('tencentcloud')) throw new Error('tencentcloud unconfigured');
    var out = [];
    for (var i = 0; i < texts.length; i++) { out.push(await tencentCloudOne(texts[i])); await sleep(80); }
    return out;
  }

  // AI 翻译（OpenAI 兼容接口：硅基流动 / 智谱 GLM 等）
  async function aiBatch(texts) {
    if (!isConfigured('ai')) throw new Error('ai unconfigured');
    var a = creds.ai;
    var base = String(a.baseUrl).replace(/\/+$/, '');
    var url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
    var body = JSON.stringify({
      model: a.model, temperature: 0,
      messages: [
        { role: 'system', content: 'You are a translation engine. Translate each input string into Simplified Chinese. Return ONLY a JSON array of translated strings, same length and order, no explanations.' },
        { role: 'user', content: JSON.stringify(texts) },
      ],
    });
    var res = await gmPost(url, body, { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + a.apiKey });
    var data = JSON.parse(res);
    var content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    var s2 = content.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    var arr; try { arr = JSON.parse(s2); } catch (e) { throw new Error('ai parse'); }
    if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error('ai align');
    return arr.map(function (x) { return String(x); });
  }

  const PROVIDERS = { ai: aiBatch, baidu: baiduBatch, tencentcloud: tencentCloudBatch, tencent: tencentBatch, bing: bingBatch, youdao: youdaoBatch, google: googleBatch, mymemory: myMemoryBatch };

  // 翻译源熔断：连续失败两次的源，5 分钟内不再尝试，避免一个被墙的源拖垮全部
  const providerState = Object.create(null);
  function providerAvailable(name) {
    if (!isConfigured(name)) return false;
    const st = providerState[name];
    return !st || !st.until || Date.now() > st.until;
  }
  function providerFail(name) {
    const st = providerState[name] || (providerState[name] = { fails: 0, until: 0 });
    st.fails += 1;
    if (st.fails >= 2) { st.until = Date.now() + 5 * 60 * 1000; st.fails = 0; }
  }
  function providerOk(name) { const st = providerState[name]; if (st) st.fails = 0; }

  async function translateTexts(texts) {
    for (const name of CFG.providers) {
      const fn = PROVIDERS[name];
      if (!fn || !providerAvailable(name)) continue;
      try {
        const r = await fn(texts);
        if (Array.isArray(r) && r.length === texts.length) { providerOk(name); return r; }
        providerFail(name);
      } catch (e) {
        providerFail(name);
        console.debug('[GitHub中文化] 翻译源失败：' + name, e && e.message);
      }
    }
    return null;
  }

  /* ============================================================
   * 六、API 队列（串行 + 分批）
   * ============================================================ */
  const apiQueue = [];
  let apiRunning = false;
  let flushTimer = null;

  function enqueueForApi(units) {
    if (!units || !units.length) return;
    apiQueue.push(units);
    if (flushTimer) return;
    flushTimer = setTimeout(drainQueue, 150);
  }

  async function drainQueue() {
    flushTimer = null;
    if (apiRunning) return;
    apiRunning = true;
    try {
      while (apiQueue.length) {
        await processGroup(apiQueue.shift());
        if (CFG.apiDelay) await sleep(CFG.apiDelay);
      }
    } finally { apiRunning = false; }
  }

  function chunkUnits(units) {
    const groups = [];
    let cur = [], chars = 0;
    for (const u of units) {
      const len = (unitText(u) || '').trim().length;
      if (cur.length >= CFG.batchItems || (chars + len > CFG.batchChars && cur.length)) {
        groups.push(cur); cur = []; chars = 0;
      }
      cur.push(u); chars += len;
    }
    if (cur.length) groups.push(cur);
    return groups;
  }

  async function processGroup(units) {
    const todo = [];
    for (const u of units) {
      const host = unitHostEl(u);
      if (!host || !host.isConnected || isUnitDone(u)) continue;
      const t = (unitText(u) || '').trim();
      if (!t || !isTranslatable(t)) { markUnitDone(u); continue; }
      if (cache.has(t)) { applyUnit(u, cache.get(t)); markUnitDone(u); continue; }
      // 单个「词」不送在线翻译，避免误译用户名 / 专有名词
      if (!/\s/.test(t)) { markUnitDone(u); continue; }
      todo.push(u);
    }
    if (!todo.length || !CFG.online) return;

    for (const group of chunkUnits(todo)) {
      const raw = group.map((u) => (unitText(u) || '').trim());
      // 去掉内部换行，保证批量下各行数一一对应
      const send = raw.map((t) => t.replace(/\s*\n+\s*/g, ' '));
      const results = await translateTexts(send);
      if (results) {
        for (let i = 0; i < group.length; i++) {
          const zh = (results[i] || '').trim();
          if (zh && containsCJK(zh)) {
            cache.set(raw[i], zh);
            zhToEn.set(zh, raw[i]);
            const host = unitHostEl(group[i]);
            const srcNorm = raw[i].replace(/\s+/g, ' ').trim();
            const srcKey = srcNorm.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim();
            // 优先按原文在页面上重新定位（应对 React 重建导致节点引用失效）
            let applied = false;
            try {
              applied = applyByText(srcNorm, zh);
              if (!applied && srcKey) {
                const cands = document.querySelectorAll('p, div, span, li, td, h1, h2, h3');
                for (const el of cands) {
                  if (el.closest('[data-zh-toggle]')) continue;
                  if (el.children.length > 0) continue;
                  const tn = el.firstChild;
                  if (!tn || tn.nodeType !== 3) continue;
                  const tKey = (tn.nodeValue || '').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim();
                  if (tKey && tKey === srcKey) { tn.nodeValue = zh; applied = true; break; }
                }
              }
            } catch (e4) {}
            if (!applied && host && host.isConnected) {
              applyUnit(group[i], zh);
            }
          }
          markUnitDone(group[i]); // 无论成功与否都标记，避免专有名词反复请求
        }
        saveCache();
      } else {
        for (const u of group) {
          u.__zhFail = (u.__zhFail || 0) + 1;
          if (u.__zhFail >= CFG.maxRetry) markUnitDone(u);
        }
      }
    }
  }

  /* ============================================================
   * 七、扫描（文本节点 + 属性），按可见性懒翻译
   * ============================================================ */
  const observedEls = new WeakSet();

  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        const ready = [];
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          const units = e.target.__zhUnits;
          e.target.__zhUnits = null;
          if (units && units.length) ready.push(...units);
        }
        if (ready.length) enqueueForApi(ready);
      }, { rootMargin: '250px 0px' })
    : null;

  // 把一个「可见性宿主元素」下的待翻译单元交给 IO 或直接入队
  function scheduleUnits(el, units) {
    if (!el || !units.length) return;
    if (io && !observedEls.has(el)) {
      observedEls.add(el);
      el.__zhUnits = units;
      io.observe(el);
    } else {
      // 已观察过（或没有 IO）：直接入队（多见于后插入的菜单/弹窗新节点）
      enqueueForApi(units);
    }
  }

  function collectTextUnits(scope, pending) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (processedText.has(node)) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || shouldSkip(p) || isUserContext(p)) return NodeFilter.FILTER_REJECT;
        if (!(node.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      const text = (n.nodeValue || '').trim();
      if (!text) continue;
      // 1) 词表精确命中（单个词也靠词表翻译）
      const hit = dictLookup(text);
      if (hit) { applyUnit({ kind: 'text', node: n }, hit); processedText.add(n); continue; }
      // 1.5) 动态短语规则（带数字/时间的整句）
      const pat = patternTranslate(text);
      if (pat) { applyUnit({ kind: 'text', node: n }, pat); processedText.add(n); continue; }
      // 2) 非英文 / 无意义文本
      if (!isTranslatable(text)) { processedText.add(n); continue; }
      // 3) 链接里的标识符（但词表有明确译法的界面词仍要翻译，如 Unread / Assigned）
      if (isIdentifierInLink(n) && !DICT_HAS_EXACT(text)) { processedText.add(n); continue; }
      // 4) 缓存命中
      if (cache.has(text)) { applyUnit({ kind: 'text', node: n }, cache.get(text)); processedText.add(n); continue; }
      // 5) <option> 内仅走词表，避免语言/时区名等被机翻
      if (n.parentElement && n.parentElement.tagName === 'OPTION') { processedText.add(n); continue; }
      // 5.1) 单个「词」不送在线翻译，避免把用户名 / 仓库名 / 专有名词译坏
      if (!/\s/.test(text)) { processedText.add(n); continue; }
      // 6) 交给在线翻译
      if (!CFG.online) { processedText.add(n); continue; }
      const parent = n.parentElement;
      if (!parent) { processedText.add(n); continue; }
      const u = { kind: 'text', node: n };
      if (!pending.has(parent)) pending.set(parent, []);
      pending.get(parent).push(u);
    }
  }

  function collectAttrUnits(scope, pending) {
    if (!CFG.translateAttributes) return;
    const sel = '[placeholder],[title],[aria-label],[alt]';
    const list = [];
    if (scope.matches && scope.matches(sel)) list.push(scope);
    if (scope.querySelectorAll) {
      const found = scope.querySelectorAll(sel);
      for (let i = 0; i < found.length; i++) list.push(found[i]);
    }
    for (const el of list) {
      if (!el.isConnected || shouldSkipAttr(el) || isUserContext(el)) continue;
      const attrs = TRANSLATE_ATTRS.slice();
      if (VALUE_ATTR_HOSTS.test(el.tagName === 'INPUT' ? (el.type || '') : '')) attrs.push('value');
      for (const attr of attrs) {
        if (!el.hasAttribute(attr)) continue;
        if (el.__zhAttrs && el.__zhAttrs.has(attr)) continue;
        if (attr === 'alt' && el.closest('pre,code')) continue;
        const text = (el.getAttribute(attr) || '').trim();
        if (!text || !isTranslatable(text)) continue;
        if (isIdentifierLike(text)) { (el.__zhAttrs || (el.__zhAttrs = new Set())).add(attr); continue; }
        const hit = dictLookup(text);
        if (hit) { el.setAttribute(attr, hit); (el.__zhAttrs || (el.__zhAttrs = new Set())).add(attr); continue; }
        if (cache.has(text)) { el.setAttribute(attr, cache.get(text)); (el.__zhAttrs || (el.__zhAttrs = new Set())).add(attr); continue; }
        const pat = patternTranslate(text);
        if (pat) { el.setAttribute(attr, pat); (el.__zhAttrs || (el.__zhAttrs = new Set())).add(attr); continue; }
        // 单个「词」不送在线翻译，避免误译用户名 / 专有名词
        if (!/\s/.test(text)) { (el.__zhAttrs || (el.__zhAttrs = new Set())).add(attr); continue; }
        if (!CFG.online) continue;
        const u = { kind: 'attr', el, attr };
        if (!pending.has(el)) pending.set(el, []);
        pending.get(el).push(u);
      }
    }
  }

  const shadowObserved = new WeakSet();

  // 递归枚举 scope 内的 open shadow root（含嵌套）
  function scanShadowTrees(scope) {
    const found = [];
    const walk = (node) => {
      let kids = node.children || [];
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        if (el.shadowRoot) { found.push(el.shadowRoot); walk(el.shadowRoot); }
        walk(el);
      }
    };
    try { walk(scope); } catch (e) { /* 忽略 */ }
    return found;
  }

  // 让 MutationObserver 也监听 shadow root，捕捉动态更新（如 relative-time 的时间变化）
  function observeShadow(root) {
    if (!root || shadowObserved.has(root)) return;
    shadowObserved.add(root);
    try {
      mo.observe(root, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: TRANSLATE_ATTRS.concat(['value']),
      });
    } catch (e) { /* 忽略 */ }
  }

  function scan(root) {
    const scope = (root && (root.nodeType === 1 || root.nodeType === 11)) ? root : document.body;
    if (!scope || !scope.isConnected) return;
    const pending = new Map();
    collectTextUnits(scope, pending);
    collectAttrUnits(scope, pending);
    const shadows = scanShadowTrees(scope);
    for (const sr of shadows) {
      observeShadow(sr);
      collectTextUnits(sr, pending);
      collectAttrUnits(sr, pending);
    }
    for (const [el, units] of pending) scheduleUnits(el, units);
  }

  /* ============================================================
   * 八、动态监听：新增节点 / 文本变化 / 属性变化 都即时翻译
   *    GitHub 的下拉菜单、弹窗、提示多为运行时插入到 body/portal
   * ============================================================ */
  const dirtyRoots = new Set();
  let dirtyTimer = null;

  function markDirty(el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return;
    dirtyRoots.add(el);
    if (dirtyTimer) return;
    dirtyTimer = setTimeout(() => {
      dirtyTimer = null;
      const roots = [...dirtyRoots];
      dirtyRoots.clear();
      for (const r of roots) if (r.isConnected) scan(r);
    }, 120);
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) markDirty(n);
          else if (n.nodeType === 3 && n.parentElement) markDirty(n.parentElement);
        });
      } else if (m.type === 'characterData') {
        // 文本被外部改动（如 GitHub 把同一节点从中文改回英文）：清除“已处理”标记以便重新翻译
        if (processedText.has(m.target)) processedText.delete(m.target);
        if (m.target.parentElement) markDirty(m.target.parentElement);
      } else if (m.type === 'attributes') {
        // 属性被外部改动：清除该属性的“已处理”标记
        if (m.target.__zhAttrs && m.attributeName) m.target.__zhAttrs.delete(m.attributeName);
        markDirty(m.target);
      }
    }
  });
  mo.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: TRANSLATE_ATTRS.concat(['value']),
  });

  ['turbo:load', 'pjax:end', 'DOMContentLoaded', 'turbo:render', 'turbo:frame-render']
    .forEach((ev) => document.addEventListener(ev, () => markDirty(document.body), true));

  // 兜底全量扫描（捕获极少数未触发 Mutation 的情况）
  setInterval(() => {
    if (document.visibilityState === 'visible') scan(document.body);
  }, CFG.fullRescanMs);

  /* ---------- 页面内翻译按钮：README / 关于描述 ---------- */
  const TOGGLE_CSS = `
    [data-zh-toggle]{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:4px;
      margin-left:8px;padding:1px 8px;border:1px solid rgba(31,35,40,.15);border-radius:6px;
      font-size:12px;line-height:20px;color:#57606a;background:rgba(175,184,193,.1);vertical-align:middle;
      transition:background .12s,border-color .12s,color .12s;white-space:nowrap;}
    [data-zh-toggle]:hover{background:rgba(175,184,193,.25);border-color:rgba(31,35,40,.25);color:#24292f;}
    [data-zh-toggle][data-on]{background:#ddf4ff;border-color:#54aeff;color:#0969da;}
    @media (prefers-color-scheme:dark){
      [data-zh-toggle]{color:#adbac7;border-color:rgba(205,217,229,.2);background:rgba(205,217,229,.08);}
      [data-zh-toggle]:hover{background:rgba(205,217,229,.2);color:#cdd9e5;border-color:rgba(205,217,229,.35);}
      [data-zh-toggle][data-on]{background:rgba(56,139,253,.2);border-color:#388bfd;color:#79c0ff;}
    }`;

  function ensureToggleStyle() {
    if (document.getElementById('zh-toggle-style')) return;
    const st = document.createElement('style');
    st.id = 'zh-toggle-style';
    st.textContent = TOGGLE_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function makeToggle(kind, label) {
    const on = !!pageState[kind];
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-zh-toggle', kind);
    b.setAttribute('data-zh-skip', '');
    b.title = on ? '点击关闭翻译' : '点击翻译为中文';
    if (on) b.setAttribute('data-on', '');
    b.textContent = (on ? '✓ ' : '') + label;
    return b;
  }

  // 关闭在线翻译时，把已翻译的节点还原成原文
  function restoreOnlineTranslations() {
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      const todo = [];
      while ((n = walker.nextNode())) {
        if (!n.nodeValue) continue;
        const t = n.nodeValue.trim();
        if (zhToEn.has(t)) todo.push(n);
      }
      todo.forEach((node) => {
        const t = node.nodeValue.trim();
        const en = zhToEn.get(t);
        if (en) node.nodeValue = node.nodeValue.replace(t, en);
      });
      pendingZh.clear();
    } catch (e) {}
  }

  // 只改纯文本元素的文字，绝不重建元素结构（避免破坏含链接/图标的容器）
  function applyByText(srcNorm, zh) {
    try {
      const cands = document.querySelectorAll('p, div, span, li, td, h1, h2, h3');
      for (const el of cands) {
        if (el.closest('[data-zh-toggle]')) continue;
        // 有子元素的一律跳过，只处理纯文本节点容器
        if (el.children.length > 0) continue;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t === srcNorm) {
          const tn = el.firstChild;
          if (tn && tn.nodeType === 3) { tn.nodeValue = zh; return true; }
        }
      }
      // 退一步：只替换单一文本子节点，保留元素结构
      for (const el of cands) {
        if (el.closest('[data-zh-toggle]')) continue;
        if (el.children.length > 0) continue;
        const tn = el.firstChild;
        if (!tn || tn.nodeType !== 3) continue;
        if ((tn.nodeValue || '').replace(/\s+/g, ' ').trim() === srcNorm) {
          tn.nodeValue = zh;
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // 观察 DOM 重建后补写译文
  (function () {
    if (typeof MutationObserver !== 'function') return;
    const mo = new MutationObserver(() => {
      if (!pendingZh.size) return;
      pendingZh.forEach((zh, src) => {
        if (!document.body.innerText.includes(src)) return;
        applyByText(src, zh);
      });
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  })();

  // 翻译/还原某个区域（按钮与状态恢复共用）
  async function translateZone(kind) {
    const scopeSel = kind === 'readme' ? README_SELECTORS
      : kind === 'issue' ? ISSUE_SELECTORS : REPO_DESC_SELECTORS;
    const on = !!pageState[kind];
    const scopes = [...document.querySelectorAll(scopeSel)];
    if (!scopes.length) return;
    for (const scope of scopes) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const items = [];
      let n;
      while ((n = walker.nextNode())) {
        const t = (n.nodeValue || '').trim();
        if (t) items.push({ node: n, text: t });
      }
      if (!on) {
        for (const it of items) {
          if (originalMap.has(it.node)) it.node.nodeValue = originalMap.get(it.node);
          else if (zhToEn.has(it.text)) it.node.nodeValue = zhToEn.get(it.text);
        }
        continue;
      }
      const todo = [];
      for (const it of items) {
        const hit = dictLookup(it.text) || patternTranslate(it.text);
        if (hit) { originalMap.set(it.node, it.text); it.node.nodeValue = hit; continue; }
        if (!isTranslatable(it.text) || !/\s/.test(it.text)) continue;
        if (cache.has(it.text)) { originalMap.set(it.node, it.text); it.node.nodeValue = cache.get(it.text); continue; }
        todo.push(it);
      }
      if (todo.length && CFG.online) {
        try {
          const res = await translateTexts(todo.map((i) => i.text));
          if (res) {
            todo.forEach((it, i) => {
              const zh = (res[i] || '').trim();
              if (zh && containsCJK(zh)) {
                const key = it.text.replace(/\s+/g, ' ').trim();
                pendingZh.set(key, zh);
                zhToEn.set(zh, it.text);
                cache.set(it.text, zh);
                if (it.node.isConnected) {
                  originalMap.set(it.node, it.text);
                  it.node.nodeValue = zh;
                } else {
                  applyByText(key, zh);
                }
              }
            });
          }
        } catch (e6) {}
      }
    }
    scopes.forEach((sc) => sc.setAttribute('data-zh-done', kind));
  }

  // 事件委托：按钮可能被 React 重建，监听器挂在 document 上不会丢
  function onToggleClick(e) {
    const b = e.target && e.target.closest && e.target.closest('[data-zh-toggle]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const kind = b.getAttribute('data-zh-toggle');
    const next = !pageState[kind];
    pageState[kind] = next;
    if (kind === 'readme') CFG.translateReadme = next;
    else if (kind === 'issue') CFG.translateIssue = next;
    else CFG.translateRepoDesc = next;

    // 写入 sessionStorage 后刷新，由页面加载流程统一翻译（最稳）
    ssSet(kind, next);
    if (kind === 'readme') CFG.translateReadme = next;
    else if (kind === 'issue') CFG.translateIssue = next;
    else CFG.translateRepoDesc = next;
    try { location.reload(); } catch (e5) {}

    const label = b.textContent.replace(/^✓\s*/, '');
    if (next) b.setAttribute('data-on', '');
    else b.removeAttribute('data-on');
    b.title = next ? '点击关闭翻译' : '点击翻译为中文';
    b.textContent = (next ? '✓ ' : '') + label;
  }
  document.addEventListener('click', onToggleClick, true);

  // README 标签栏：按钮固定到 nav 最右侧（margin-left:auto），不挤占左侧标签
  const README_TITLE_RE = /^(README|Readme|readme|自述文件|说明文件|readme\s*文件)$/i;
  function findReadmeNav() {
    const items = document.querySelectorAll('a, li, span');
    for (const el of items) {
      if (el.hasAttribute('data-zh-toggle')) continue;
      if (el.closest('.markdown-body')) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!README_TITLE_RE.test(t) || t.length > 20) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height === 0 || r.height > 60) continue;
      if (el.closest('[class*="OverviewSidebar"], [class*="sidebar"]')) continue;
      const nav = el.closest('nav') || el.closest('[class*="UnderlineWrapper"]');
      if (nav) return nav;
    }
    return null;
  }

  // 找到「关于」标题
  function findAboutHeading() {
    const nodes = document.querySelectorAll('h2,h3,h4');
    for (const el of nodes) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t !== '关于' && t !== 'About') continue;
      if (el.closest('[class*="OverviewSidebar"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 10 && r.height <= 40) return el;
      }
    }
    return null;
  }

  function placeToggles() {
    refreshPageState();
    ensureToggleStyle();
    // 同步已有按钮的外观与状态
    document.querySelectorAll('[data-zh-toggle]').forEach((b) => {
      const k = b.getAttribute('data-zh-toggle');
      const want = !!pageState[k];
      if (want && !b.hasAttribute('data-on')) {
        b.setAttribute('data-on', '');
        b.textContent = '✓ ' + b.textContent.replace(/^✓\s*/, '');
      } else if (!want && b.hasAttribute('data-on')) {
        b.removeAttribute('data-on');
        b.textContent = b.textContent.replace(/^✓\s*/, '');
      }
    });
    // 有开启的区域且尚未翻译时，触发一次翻译
    ['readme', 'about', 'issue'].forEach((k) => {
      if (!pageState[k]) return;
      if (document.querySelector('[data-zh-done="' + k + '"]')) return;
      translateZone(k);
    });
    // README
    if (!document.querySelector('[data-zh-toggle="readme"]')) {
      const nav = findReadmeNav();
      if (nav) {
        const b = makeToggle('readme', '翻译 README');
        b.style.marginRight = '8px';
        b.style.verticalAlign = 'middle';
        // 右侧按钮组里第一个是 readmeHeaderSlot（Copilot 图标），插到它之前 = 整组最左
        const slot = [...document.querySelectorAll('[class*="readmeHeaderSlot"]')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            const nr = nav.getBoundingClientRect();
            return r.width > 0 && Math.abs(r.y - nr.y) < 40;
          })[0];
        if (slot) {
          slot.insertAdjacentElement('beforebegin', b);
        } else {
          const box = [...document.querySelectorAll('[class*="OverviewRepoFiles"][class*="Box_3"]')]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              const nr = nav.getBoundingClientRect();
              return r.width > 0 && Math.abs(r.y - nr.y) < 40;
            })[0];
          if (box) box.insertAdjacentElement('afterbegin', b);
          else {
            b.style.marginLeft = 'auto';
            nav.appendChild(b);
          }
        }
      }
    }
    // Issue / PR 正文与评论
    if (!document.querySelector('[data-zh-toggle="issue"]')) {
      if (/\/(issues|pull)\//.test(location.pathname)) {
        // 正文卡片头部右上角（⋯ 按钮左边）
        const head = document.querySelector('.timeline-comment-header, [class*="IssueBodyHeader"], [class*="CommentHeader"]');
        if (head && !head.querySelector('[data-zh-toggle]')) {
          const b = makeToggle('issue', '翻译正文');
          b.style.marginLeft = 'auto';
          b.style.marginRight = '8px';
          b.style.alignSelf = 'center';
          const more = head.querySelector('[class*="ellipsis"], button[aria-label*="More"], button[aria-label*="更多"], [data-testid*="more"]');
          if (more) head.insertBefore(b, more);
          else head.appendChild(b);
        }
      }
    }
    // 关于描述
    if (!document.querySelector('[data-zh-toggle="about"]')) {
      const h = findAboutHeading();
      if (h) {
        const b = makeToggle('about', '翻译简介');
        b.style.marginLeft = '8px';
        // 插到 H2 之后（不放进 H2 内部，避免触发父级点击行为）
        h.insertAdjacentElement('afterend', b);
      }
    }
  }

  /* ============================================================
   * 九、菜单 & 快捷键
   * ============================================================ */
  // 菜单只注册一次，避免不同脚本管理器注销行为不一致导致重复项
  function reloadPage() {
    setTimeout(() => { try { location.reload(); } catch (e) {} }, 60);
  }

  function registerMenu() {
    if (typeof GM_registerMenuCommand !== 'function') return;

    GM_registerMenuCommand('① 在线翻译（当前：' + (CFG.online ? '开' : '关') + '）', () => {
      CFG.online = !CFG.online;
      saveOnline();
      if (!CFG.online) {
        try { restoreOnlineTranslations(); } catch (e) {}
      }
      reloadPage();
    });

    GM_registerMenuCommand('② 立即重新扫描翻译当前页', () => {
      scan(document.body);
    });

    GM_registerMenuCommand('③ 清空翻译缓存', () => {
      cache.clear();
      try {
        if (typeof GM_setValue === 'function') GM_setValue(CACHE_KEY, '');
        else localStorage.removeItem(CACHE_KEY);
      } catch (e) {}
      reloadPage();
    });

    GM_registerMenuCommand('④ 设置百度翻译（APPID / 密钥）', () => {
      var appid = window.prompt('百度翻译 APPID（留空清除）：', (creds.baidu && creds.baidu.appid) || '');
      if (appid === null) return;
      var key = window.prompt('百度翻译密钥（留空清除）：', (creds.baidu && creds.baidu.key) || '');
      if (key === null) return;
      creds.baidu = { appid: appid.trim(), key: key.trim() };
      saveCreds();
      reloadPage();
    });

    GM_registerMenuCommand('⑤ 设置腾讯云机器翻译（SecretId / SecretKey）', () => {
      var sid = window.prompt('腾讯云 SecretId（留空清除）：', (creds.tencentcloud && creds.tencentcloud.secretId) || '');
      if (sid === null) return;
      var skey = window.prompt('腾讯云 SecretKey（留空清除）：', (creds.tencentcloud && creds.tencentcloud.secretKey) || '');
      if (skey === null) return;
      var region = window.prompt('地域 Region（默认 ap-guangzhou）：', (creds.tencentcloud && creds.tencentcloud.region) || 'ap-guangzhou');
      if (region === null) return;
      creds.tencentcloud = { secretId: sid.trim(), secretKey: skey.trim(), region: (region || 'ap-guangzhou').trim() };
      saveCreds();
      reloadPage();
    });

    GM_registerMenuCommand('⑥ 设置 AI 翻译（硅基流动 / 智谱 GLM）', () => {
      var base = window.prompt('接口地址 Base URL（硅基流动：https://api.siliconflow.cn/v1 ；智谱：https://open.bigmodel.cn/api/paas/v4）', (creds.ai && creds.ai.baseUrl) || 'https://api.siliconflow.cn/v1');
      if (base === null) return;
      var key = window.prompt('API Key：', (creds.ai && creds.ai.apiKey) || '');
      if (key === null) return;
      var model = window.prompt('模型名（如 Qwen/Qwen2.5-7B-Instruct 或 glm-4-flash）：', (creds.ai && creds.ai.model) || '');
      if (model === null) return;
      creds.ai = { baseUrl: base.trim(), apiKey: key.trim(), model: model.trim() };
      saveCreds();
      reloadPage();
    });

    GM_registerMenuCommand('⑦ 清空所有自定义翻译密钥', () => {
      creds.baidu = null; creds.tencentcloud = null; creds.ai = null;
      saveCreds();
      reloadPage();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
      CFG.online = !CFG.online;
      saveOnline();
      if (!CFG.online) { try { restoreOnlineTranslations(); } catch (err) {} }
      reloadPage();
    }
  });

  /* ============================================================
   * 十、启动
   * ============================================================ */
  function syncFlagsFromSession() {
    try {
      refreshPageState();
      if (pageState.readme) CFG.translateReadme = true;
      if (pageState.about) CFG.translateRepoDesc = true;
      if (pageState.issue) CFG.translateIssue = true;
    } catch (e) {}
  }

  function boot() {
    syncFlagsFromSession();
    try {
      const t = document.title;
      const hit = dictLookup(t);
      if (hit) document.title = hit;
    } catch (e) {}
    registerMenu();
    placeToggles();
    scan(document.body);
    // 页面稳定后再补扫一次（应对首屏异步渲染）
    setTimeout(() => { placeToggles(); scan(document.body); }, 800);
    setInterval(placeToggles, 1500);
    // 兜底：定期补译「漏网」的界面词（词表命中即译，零网络）
    setInterval(() => {
      try {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
          const p = n.parentElement;
          if (!p || shouldSkip(p) || isUserContext(p)) continue;
          const t = (n.nodeValue || '').trim();
          if (!t || t.length > 40) continue;
          // 词表能译就译（不依赖 processedText 标记，避免早期漏标导致永久跳过）
          const hit = dictLookup(t);
          if (hit && hit !== t) { n.nodeValue = n.nodeValue.replace(t, hit); processedText.add(n); }
        }
      } catch (e) {}
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  console.log('%c[GitHub中文化] 已加载', 'color:#2ea44f;font-weight:bold');
})();
