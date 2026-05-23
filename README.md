# MastoGale

**简洁、优雅的长毛象（Mastodon）浏览器扩展客户端**

> 基于 PREFiX 框架深度改造，完整适配 Mastodon API & Manifest V3 架构。

---

## ✨ 功能特性

- 🔐 **OAuth 2.0 动态注册登录**：支持任意 Mastodon 实例，自动完成应用注册与授权
- 👥 **多账号管理**：一键添加、切换、退出多个 Mastodon 账号，会话无缝切换
- 🏠 **主时间线**：实时拉取 Home Timeline，支持自动刷新与滚动定位记忆
- 💬 **私信收件箱**：查看并发送私信（Direct Message）
- 🔔 **提及（@消息）**：实时获取 @mentions，角标未读计数提醒
- 🖼️ **图片预览**：内联查看媒体附件
- ⭐ **收藏（Favourites）**：查看已加星标的嘟文
- 🔁 **转发 / 点赞**：一键 Boost & Favourite
- 🔔 **桌面通知**：后台检测新消息时弹出系统级通知并播放提示音
- 🌗 **深色主题**：全局深色 UI，护眼舒适
- ⌨️ **Vim 风格快捷键**：键盘流操作支持

---

## 🏗️ 技术架构

| 层级 | 技术选型 |
|---|---|
| 扩展规范 | Manifest V3（Chrome / Edge） |
| 后台 | Service Worker（非持久化） |
| 存储 | `chrome.storage.local` 异步代理 → 同步 `localStorage` Proxy |
| API | Mastodon REST API v1 |
| 登录 | OAuth 2.0 动态客户端注册 + OOB 授权码回调 |
| UI 框架 | avalon.js（MV3 CSP 安全沙箱模板解释器） |
| 通知 | `chrome.notifications` + Offscreen Document 音频播放 |

---

## 🚀 安装使用

1. 克隆或下载本仓库
2. 打开 Edge / Chrome，进入 `edge://extensions/`（或 `chrome://extensions/`）
3. 开启「开发者模式」，点击「加载已解压的扩展程序」
4. 选择本项目根目录即可
5. 点击扩展图标 → 输入你的 Mastodon 实例域名（如 `mast.dragon-fly.club`）→ 授权登录

---

## 📋 版本历史

### v1.1.0（MastoGale 长毛象版）
- 迁移至 **Mastodon** 平台，完整适配 Mastodon REST API
- 实现 **OAuth 2.0 动态注册**与 OOB 授权码自动捕获流程
- 新增 **多账号管理**界面：添加、切换、退出账号
- 修复 Service Worker 严格模式顶层 `this` 崩溃（Status code 15）
- 修复 `DOMParser` 在 Service Worker 上下文不可用问题（regex 引擎替代）
- 修复 MV3 `chrome.extension.getBackgroundPage()` 为 `null` 的崩溃
- 美化登录页：实例推荐下拉、手动输入授权码双轨兜底

### v1.0.0（Manifest V3 完美适配版）
- 全面迁移至 Manifest V3 架构，适配 Chrome 2025 MV2 停用时间线
- 后台 Service Worker 重构，降低内存占用
- MV3 存储兼容垫片：`chrome.storage.local` 同步 Proxy
- 安全沙箱模板解释器：兼容 `ms-duplex` 等 avalon.js 语法（无 `unsafe-eval`）
- `MockXMLHttpRequest`：`fetch()` 封装替代 SW 中已移除的 `XMLHttpRequest`
- Offscreen Document 音频播放 + `chrome.notifications` 桌面通知重构

---

## 🙏 致谢

基于开源项目深度改造：
- [PREFiX / Ripple](https://github.com/riophae/Ripple)（原始框架）
- [avalon.js](https://github.com/RubyLouvre/avalon)（MVVM 数据绑定）
- [jQuery](https://github.com/jquery/jquery)
