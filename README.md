PREFiX
======

**简洁、易用的饭否客户端**

**作者:** @锐风 https://fanfou.com/ruif

安装
--
**Chrome 应用商店地址:** https://is.gd/PREFiX

版本历史
----

**ver 0.1.0**
* 自动智能压缩链接
* 支持上传图片
* 每 30s 自动刷新 Timeline 和获取未读@消息/私信数量
* 在图标一角显示新通知数量和播放提示音
* @自动补全
* 支持查看@消息和私信收件箱
* 显示 Emoji 表情
* 自动向 Timeline 加载新消息
* 记录 Timeline 阅读位置
* 查看图片和消息上下文
* 支持独立窗口模式运行

**ver 0.2.0**
* 平滑滚动效果
* 支持将粘贴板中的图像数据直接上传到饭否

**ver 0.3.0**
* 自定义尾巴
* 在地址栏查看 Timeline 和发布消息
* 自动抛弃缓存功能 (改善性能)
* 生日提醒
* 界面放大功能
* 显示使用技巧
* 一键设置尾巴
* 上传页面加入@自动补全

**ver 0.4.0**
* Retina 支持
* 添加随便看看/关注的话题界面
* 全新的设置界面
* 点击用户名发送私信
* 加载较多消息时显示加载时间点提示
* 上传图片显示进度

**ver 0.5.0**
* 查看收藏
* 启动时打开 PREFiX 窗口
* 扩展内搜索话题消息
* 查看自己的消息

**ver 0.6.0**
* Vim 风格快捷键支持
* 可以调整提示音音量
* 自动调整刷新频率
* 智能滑动页面
* 可以自定义缓存数量
* 旋转图片功能

**ver 0.7.0**
* Streaming API 支持、实时推送桌面通知
* 过滤消息
* 应用内查看用户个人页面
* 自定义转发格式
* 全自动展开短链接、应用内预览第三方内容

**ver 0.8.0**
* 增加虾米封面显示和一键打开虾米播放器功能
* 大幅优化滚动性能, 解决消息较多时滚动卡顿的问题

**ver 1.0.0 (Manifest V3 完美适配版)**
* **全面迁移至 Manifest V3 架构**：完美适配 Chrome 2025 MV2 停用时间线，升级扩展安全性与性能。
* **后台 Service Worker 重构**：将原有的 Persistent Background Page 重构为非持久化 Service Worker，降低了内存占用。
* **MV3 存储兼容垫片**：为 Popup 和 Options 页面构建了基于 `chrome.storage.local` 异步加载的同步 `localStorage` Proxy 代理，确保老版本用户数据的平滑过渡。
* **安全沙箱模板表达式解释器**：实现了一套符合 MV3 CSP（无 `'unsafe-eval'` 限制）的轻量级 avalon.js 模板表达式解释器，完美兼容原项目的数据双向绑定语法（`ms-duplex` 等）。
* **Service Worker 网络垫片**：实现了 `MockXMLHttpRequest`，使用 `fetch()` 重新封装以替代 Service Worker 中已被剔除的 `XMLHttpRequest`，完美适配 OAuth 1.0a 签名验证库 `ripple.js`。
* **声音与通知适配**：引入 Offscreen Document 解决 Service Worker 下原生 DOM 播放 `dongdong.mp3` 的限制，并采用 `chrome.notifications` 重构了桌面通知弹窗，修复了原生 `Notification` 构造器报错。
* **竞态与稳定性修复**：完美修复了 Popup 在 MV3 独立作用域下的各种 DOM Ready 初始化竞态报错、滚动条位置抖动，并移除了 avalon.js 内部的 `setTimeout("string")` 动态求值警告。

基于开源项目 [Ripple](https://github.com/riophae/Ripple), [Avalon](https://github.com/RubyLouvre/avalon), [jQuery](https://github.com/jquery/jquery) 开发.
