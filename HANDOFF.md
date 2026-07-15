# HANDOFF — 魔趣(vrmoo.net) Loon 自动签到插件

> 本文件用于「新对话无缝接手」。新会话读取本文件即可继续，无需重新推导。
> 最后更新：2026-07-15（v1.0.4 推送后）

---

## 1. 目标
为 iOS **Loon** 做「魔趣 VR 社区 vrmoo.net / vrmoo.vip」的**每日自动签到**插件：
- 用户用 Safari 经 Loon 代理登录网站时，**自动 MITM 捕获登录 Cookie**；
- 之后 **每天 08:00 定时**用该 Cookie 调签到接口，结果走系统通知；
- 同时兼容 `.net` / `.vip` 两个域名，以及**带 www / 不带 www** 两种写法。

## 2. 当前状态
| 环节 | 状态 | 说明 |
|---|---|---|
| 仓库创建 + 推送 | ✅ 完成 | 公开仓库，脚本 raw 200 |
| Cookie 捕获脚本 | ✅ 已验证可用 | 用户确认 Safari 登录后收到「Cookie已捕获」 |
| 插件 MITM/正则 | ✅ 已修 | 覆盖 4 个域名（含非 www / 双 TLD） |
| 每日签到脚本 | 🔶 v1.0.4 已推送，**待手机实测确认** | 已做「4 域名全试 + 原始 Cookie 优先」，大概率已修好，等用户跑一次确认 |
| CDN 缓存坑 | ✅ 已规避 | plugin 的 script-path **钉到提交 SHA**（非 `main` 分支引用），避免 raw CDN 返回旧脚本 |

## 3. 仓库与文件
- **仓库（公开）**：`https://github.com/csjoyxy/vrmoo-net-loon-signin`
- **一键安装链接**：`https://raw.githubusercontent.com/csjoyxy/vrmoo-net-loon-signin/main/vrmoo-net.plugin`
- **本地工作区**：`C:/Users/lili/AppData/Local/hermes/workspace/vrmoo-net/`
- 文件清单：
  - `vrmoo-net-capture.js` — http-response 捕获 Cookie（自动触发，勿手动跑），v1.0.3 起额外存原始 Cookie 头
  - `vrmoo-net-signin.js` — cron 每日签到（可手动跑测试），**当前 v1.0.4**（4 域名探测 + 原始 Cookie 优先）
  - `vrmoo-net.plugin` — Loon 插件壳（[Script] + [MITM]），**v1.0.4**，script-path 钉到 SHA `27b6349`
  - `README_vrmoo_net.md` — 使用说明（中文）
  - `HANDOFF.md` — 本文件
- 当前钉死的脚本直链（plugin 内部引用，不可变、立即生效）：
  - `https://raw.githubusercontent.com/csjoyxy/vrmoo-net-loon-signin/27b6349/vrmoo-net-capture.js`
  - `https://raw.githubusercontent.com/csjoyxy/vrmoo-net-loon-signin/27b6349/vrmoo-net-signin.js`

## 4. 关键技术事实（已验证）
- **签到接口**：`POST https://<host>/wp-json/b2/v1/userMission`
  - 无需请求体（`body:""`）。
  - **未登录时（桌面实测，2026-07-15）**：`www.vrmoo.net` 返回
    `{"code":"user_error","message":"请先登录","data":{"status":403}}` —— **HTTP 403**（不是 200！）。
  - `vrmoo.net`（apex）返回 301 跳转到 `www.vrmoo.net`。
  - `www.vrmoo.vip` / `vrmoo.vip` 从本机（海外）不可达（超时/TLS 失败），但**手机（国内）应可达**，故脚本仍全域名尝试。
  - `<host>`**：v1.0.4 不再只翻 www↔apex，而是依次尝试 4 个域名组合**（www/apex × .net/.vip），命中即用。
- **站点技术栈**：WordPress + **b2 主题**。
- **Cookie 组成**（capture 从请求头 `Cookie` 解析后持久化）：
  - `b2_token`（存 `vrmoo_b2_token`）
  - `wordpress_logged_in_<hash>`（键名存 `vrmoo_wp_cookie_name`，值存 `vrmoo_wp_cookie`）
  - `PHPSESSID`（存 `vrmoo_phpsessid`）
  - 组件重拼时额外加 `night=0` 与 `gg_info=<unix时间戳>`，以 `; ` 拼接存 `vrmoo_cookies`。
  - **v1.0.3 新增**：原样保存完整 Cookie 头到 `vrmoo_raw_cookie`（签到优先透传，避免重拼漏项）。
- **MITM hostname**（插件内）：`%APPEND% vrmoo.net, www.vrmoo.net, vrmoo.vip, www.vrmoo.vip`
- **捕获正则**：`^https?://(www\.)?vrmoo\.(net|vip)/`
- **持久化键**（capture 与 signin 共用，必须一致）：
  `vrmoo_cookies` / `vrmoo_host` / `vrmoo_b2_token` / `vrmoo_wp_cookie` / `vrmoo_phpsessid` / `vrmoo_wp_cookie_name`
  `vrmoo_raw_cookie`（v1.0.3+ 原始头）/ `vrmoo_ok_host` + `vrmoo_ok_cookie`（v1.0.4+ 成功后记住的可用组合）

## 5. 环境 / 工具链注意事项（踩坑记录）
- **本机 Windows 10 + git-bash（MSYS）**：`/tmp` 在 git-bash 下 ≠ `C:\tmp`；写文件用工作区绝对路径或 `/c/...`。
- **GitHub Token**：`repo` scope，存于 `HERMES_HOME/.env` 的 `GITHUB_TOKEN`（`HERMES_HOME=C:\Users\lili\AppData\Local\hermes`）。用户名 `csjoyxy`。git remote URL 已内嵌 token（`https://ghp_***@github.com/...`），普通 `git push` 即可，token 不出现在命令里。
- **推仓库命令模式**：本仓库已配好带 token 的 remote，直接
  `cd /c/Users/lili/AppData/Local/hermes/workspace/vrmoo-net && git add <files> && git commit -m "..." && git push origin main`。
  若需从零建仓/改 remote，用 Python `subprocess` 列表参数 + 从 `.env` 读 token（避免 Hermes 机密打码破坏 shell 引号）。
- **raw.githubusercontent.com 在本机 curl 报 `CRYPT_E_REVOCATION_OFFLINE`**：用 `curl -k` 或 GitHub API（base64）取文件。
- **GitHub 未认证 API 限流 60次/小时/IP**：批量抓文件会超，换 `-k` raw 或认证。
- **node 语法检查**：`node --check file.js`（Loon 全局对象不影响语法检查）。
- **⚠️ raw CDN 缓存**：`main` 分支引用的 raw 会在边缘节点缓存旧脚本（实测 signin.js 推送后短暂仍返回旧版）。**对策：plugin 的 script-path 钉到具体提交 SHA**（如 `27b6349`），SHA 不可变、立即生效。每次推新脚本后，记得把 plugin 里的 SHA 同步更新再推。

## 6. 已验证 / 已排除
- ✅ 接口路径 `POST /wp-json/b2/v1/userMission` 正确（桌面实测 www.vrmoo.net 返回 403「请先登录」）。
- ✅ 捕获脚本确实写进了 `vrmoo_cookies` 等键（用户收到「Cookie已捕获」）。
- ✅ 捕获正则与 MITM 已覆盖非 www / 双域名。
- ✅ v1.0.4 已推到 `main`，且 plugin 钉的 SHA `27b6349` 经核实含全套新版脚本（signin 7282B / capture 3342B）。
- 🔶 待确认：手机实测签到是否成功（v1.0.4 已针对性修域名/TLD 匹配，预期能成）。

## 7. 未决问题（OPEN ISSUE）
**现象（上一轮）**：捕获成功，但手动运行「魔趣每日签到」仍报错（用户未给原文，上下文溢出前未拿到诊断输出）。
**根因假设（桌面实测支撑）**：服务端判定「未登录」→ Cookie 没被 `.net` 服务端认。最可能原因：
1. 捕获域名与签到域名差一层（尤其 **.net ↔ .vip 跨 TLD**，旧版 `altHost` 只翻 www↔apex，不会翻 TLD）；
2. Cookie 重拼时漏了关键项。
**v1.0.4 已做的修复**：
- **4 域名全试**（www/apex × .net/.vip），命中即用 —— 直接消除域名/TLD 猜测；
- **优先透传原始 Cookie 头**（`vrmoo_raw_cookie`），退回才用组件重拼；
- 成功后**记住可用组合**（`vrmoo_ok_host` / `vrmoo_ok_cookie`），日常只发 1 个请求；
- 全部失败时通知给出：尝试次数、末次服务器真实返回 + 状态码 + Cookie 组成诊断。
**下一步（解锁本问题所需）**：用户在 Loon **重装插件**（拿钉 SHA 的新脚本）→ 手动运行「魔趣每日签到」→ 把通知**原话**发来。
- 若通知显示「成功 / 今日已签到」→ 修好了，完事。
- 若仍「全部失败 / 未登录」→ 通知里的 `diag:raw:Y/N b2:Y/N ...` 和末次返回会告诉我们是 Cookie 漏存还是账号域名不对（例如在 .vip 有号但脚本打 .net）。

## 8. 新对话恢复步骤
1. 读本文件即可接手；不够再 `session_search(query="vrmoo 签到 loon")` 拉完整历史。
2. 可加载 `loon-auto-checkin` skill（通用工作流与坑）。
3. 改脚本：`write_file` 更新工作区文件 → `node --check` → `git add/commit/push` → **同步把 plugin 里的 SHA 改成新提交号再推一次**（否则手机仍跑旧脚本）。
4. 让用户**重装插件**（或确认 Loon 已拉到新脚本）后重跑验证。

## 9. 备注
- 用户原仓库 `csjoyxy/vrmoo-loon-signin`（仅 vrmoo.vip）未改动，本插件是独立新仓库。
- 用户偏好：免费/低价方案优先；用中文交流；iPhone + Loon。
- Token 安全：token 仅在 `.env` 与 git remote URL，用户可随时在 GitHub 吊销；不要写回聊天。
- **当前钉的提交 SHA = `27b6349`**（capture + signin 均为新版）。下次推送新脚本后务必更新此 SHA。
