# 魔趣(vrmoo.net) Loon 自动签到 使用说明

## 原理
魔趣(VR魔趣网) 是基于 WordPress + b2 主题的资源站，每日签到接口为：

```
POST https://<域名>/wp-json/b2/v1/userMission
```

只要带着登录后的 Cookie 发一个 POST 即可完成签到。脚本分两部分：
1. **vrmoo-net-capture.js**（http-response）：你在 Safari 打开魔趣任意页面时，Loon 通过 MITM 拦截请求、自动抽出 Cookie 并保存。
2. **vrmoo-net-signin.js**（cron）：每天 08:00 读取保存的 Cookie，自动 POST 签到，结果以系统通知推送。

域名做了自适应：捕获时记下来你用的是 `www.vrmoo.net` 还是 `www.vrmoo.vip`，签到时回打同一个域名，所以两个域名都能用。

## 文件
- `vrmoo-net-capture.js` — Cookie 捕获脚本
- `vrmoo-net-signin.js`  — 每日签到脚本
- `vrmoo-net.plugin`     — Loon 插件（一键安装用）

## 安装方式（任选其一）

### 方式 A：插件一键安装（推荐，需把三个文件托管到可访问的 URL）
把三个文件传到 GitHub 仓库 / 任意可直链的地方，然后用 Loon 打开插件链接：
```
https://raw.githubusercontent.com/<你>/<仓库>/main/vrmoo-net.plugin
```
Loon 会自己拉取两个 .js。

### 方式 B：本地文件 + 配置块（无需托管，最稳）
1. 把 `vrmoo-net-capture.js`、`vrmoo-net-signin.js` 两个文件放进 Loon 的脚本目录
   （Loon App → 脚本 → 右上角 `+`/导入，或用文件 App 放到 Loon 的文件夹）。
2. 在 Loon 配置里加入下面的 [Script] 和 [MITM] 段（Loon → 配置 → 编辑文本）：

```
[Script]
http-response ^https://www\.(vrmoo\.net|vrmoo\.vip)/ script-path=本地路径/vrmoo-net-capture.js, tag=魔趣Cookie捕获, requires-body=0
cron "0 8 * * *" script-path=本地路径/vrmoo-net-signin.js, tag=魔趣每日签到

[MITM]
hostname = %APPEND% www.vrmoo.net, www.vrmoo.vip
```
（把 `本地路径` 换成你实际存放 .js 的位置，例如 `/var/mobile/Library/Mobile Documents/com~apple~CloudDocs/Loon/` 之类；Loon 也支持相对路径。）

## 首次使用（需要你配合的一步）
1. Loon → 配置 → MITM → 打开开关，并 **安装/信任 CA 证书**（设置→已下载描述文件→安装→关于本机→证书信任设置 全开）。
2. Loon 里确保该插件/脚本已启用，且 MITM hostname 包含 `www.vrmoo.net`。
3. 用 **Safari**（走 Loon 代理）打开 https://www.vrmoo.net/ 并登录账号。
4. 收到「魔趣 - Cookie已捕获」通知即成功。
5. 之后每天 08:00 自动签到，结果通过通知推送；也可在 Loon 里手动运行「魔趣每日签到」立即测试。

## 排错
- 通知「Cookie 失效 / 无 Cookie」：Safari 重新登录一次魔趣即可。
- 通知「网络错误」：检查 Loon 代理是否正常、MITM 是否开启。
- 想改签到时间：把 `cron "0 8 * * *"` 改成你想要的（分 时 日 月 周），例如 `"30 9 * * *"` 为每天 9:30。

## 参考
- GitHub 参考实现：https://github.com/csjoyxy/vrmoo-loon-signin （原版针对 vrmoo.vip，本版适配 vrmoo.net 并双域名兼容）
- 接口已实测：对 vrmoo.vip 的 `/wp-json/b2/v1/userMission` 发起 POST，未登录返回 `{"code":"user_error","message":"请先登录"}`，证明端点正确。
