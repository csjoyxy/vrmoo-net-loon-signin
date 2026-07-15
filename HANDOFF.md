# HANDOFF — 魔趣(vrmoo.net) Loon 自动签到插件

> 本文件用于「新对话无缝接手」。新会话读取本文件即可继续，无需重新推导。
> 最后更新：2026-07-15（对话上下文超限前的交接点）

---

## 1. 目标
为 iOS **Loon** 做「魔趣 VR 社区 vrmoo.net / vrmoo.vip」的**每日自动签到**插件：
- 用户用 Safari 经 Loon 代理登录网站时，**自动 MITM 捕获登录 Cookie**；
- 之后 **每天 08:00 定时**用该 Cookie 调签到接口，结果走系统通知；
- 同时兼容 `.net` / `.vip` 两个域名，以及**带 www / 不带 www** 两种写法。

## 2. 当前状态
| 环节 | 状态 | 说明 |
|---|---|---|
| 仓库创建 + 推送 | ✅ 完成 | 公开仓库，4 个文件全部 raw 200 |
| Cookie 捕获脚本 | ✅ 已验证可用 | 用户确认 Safari 登录后收到「Cookie已捕获」 |
| 插件 MITM/正则 | ✅ 已修 | 之前只覆盖 `www.vrmoo.net` 导致静默不触发，已扩成 4 个域名 |
| **每日签到脚本** | ❌ 仍报错 | 捕获成功但签到调用失败，需拿服务端真实返回定位 |
| 诊断版签到脚本 | ✅ 已推送 v1.0.2 | 会打印服务器原话/状态码/Cookie 组成，等待用户报错文本 |

## 3. 仓库与文件
- **仓库（公开）**：`https://github.com/csjoyxy/vrmoo-net-loon-signin`
- **一键安装链接**：`https://raw.githubusercontent.com/csjoyxy/vrmoo-net-loon-signin/main/vrmoo-net.plugin`
- **本地工作区**：`C:/Users/lili/AppData/Local/hermes/workspace/vrmoo-net/`
- 文件清单：
  - `vrmoo-net-capture.js` — http-response 捕获 Cookie（自动触发，勿手动跑）
  - `vrmoo-net-signin.js` — cron 每日签到（可手动跑测试，当前 v1.0.2 诊断版）
  - `vrmoo-net.plugin` — Loon 插件壳（[Script] + [MITM]）
  - `README_vrmoo_net.md` — 使用说明（中文）
  - `HANDOFF.md` — 本文件
- raw 直链（脚本由插件 `script-path` 引用，Loon 每次运行会重新拉取）：
  - `https://raw.githubusercontent.com/csjoyxy/vrmoo-net-loon-signin/main/vrmoo-net-capture.js`
  - `https://raw.githubusercontent.com/csjoyxy/vrmoo-net-loon-signin/main/vrmoo-net-signin.js`

## 4. 关键技术事实（已验证）
- **签到接口**：`POST https://<host>/wp-json/b2/v1/userMission`
  - 无需请求体（参考仓库用 `body:""`）。
  - 未登录时返回 `{"code":"user_error","message":"请先登录"}`（已在 vrmoo.vip 实测确认路径正确）。
  - `<host>` 取自捕获时实际访问的域名（带/不带 www、.net/.vip 均可），Cookie 不跨域，所以捕获与签到必须用同一 host。
- **站点技术栈**：WordPress + **b2 主题**（曾经 web.archive.org 快照确认 `wp-content/themes/b2`）。
- **Cookie 组成**（捕获脚本从请求头 `Cookie` 解析后持久化）：
  - `b2_token`（存 `vrmoo_b2_token`）
  - `wordpress_logged_in_<hash>`（键名存 `vrmoo_wp_cookie_name`，值存 `vrmoo_wp_cookie`）
  - `PHPSESSID`（存 `vrmoo_phpsessid`）
  - 组装完整 Cookie 时额外加 `night=0` 与 `gg_info=<unix时间戳>`，以 `; ` 拼接存 `vrmoo_cookies`。
- **MITM hostname**（插件内）：`%APPEND% vrmoo.net, www.vrmoo.net, vrmoo.vip, www.vrmoo.vip`
- **捕获正则**：`^https?://(www\.)?vrmoo\.(net|vip)/`
- **持久化键**（capture 与 signin 共用，必须一致）：
  `vrmoo_cookies` / `vrmoo_host` / `vrmoo_b2_token` / `vrmoo_wp_cookie` / `vrmoo_phpsessid` / `vrmoo_wp_cookie_name`

## 5. 环境 / 工具链注意事项（踩坑记录）
- **本机 Windows 10 + git-bash（MSYS）**：`/tmp` 在 git-bash 下 ≠ `C:\tmp`；写文件用工作区绝对路径或 `/c/...`。
- **GitHub Token**：`repo` scope，存于 `HERMES_HOME/.env` 的 `GITHUB_TOKEN`（`HERMES_HOME=C:\Users\lili\AppData\Local\hermes`）。用户名 `csjoyxy`。
- **推仓库命令模式（关键，避免打码破坏 shell 引号）**：
  用 Python `execute_code` + `subprocess` 列表参数调 `curl`/`git`，token 从 `.env` 用 `re` 读出，**不要**写进带引号的 bash 命令（Hermes 机密打码会把 `$TOK` 替换并改坏引号导致语法错误）。
  参考片段：
  ```python
  import subprocess, re
  tok = re.search(r'^GITHUB_TOKEN=(.+)$', open("C:/Users/lili/AppData/Local/hermes/.env", encoding="utf-8").read(), re.MULTILINE).group(1).strip()
  REPO="vrmoo-net-loon-signin"; LOGIN="csjoyxy"
  wd="C:/Users/lili/AppData/Local/hermes/workspace/vrmoo-net"
  run=lambda c: subprocess.run(c, capture_output=True, text=True)
  run(["git","-C",wd,"add","-A"])
  run(["git","-C",wd,"commit","-q","-m","msg"])
  run(["git","-C",wd,"push","-u","origin","https://%s@github.com/%s/%s.git"%(tok,LOGIN,REPO)])
  ```
- **raw.githubusercontent.com 在本机 curl 报 `CRYPT_E_REVOCATION_OFFLINE`**：用 `curl -k` 或 GitHub API（base64）取文件。
- **GitHub 未认证 API 限流 60次/小时/IP**：批量抓文件会超，换 `-k` raw 或认证。
- **node 语法检查**：`C:/Users/lili/.hermes-web-ui/desktop-runtime/hermes/0.16.0/win-x64/node/node --check file.js`

## 6. 已验证 / 已排除
- ✅ 接口路径 `POST /wp-json/b2/v1/userMission` 正确（vip 实测未登录返回「请先登录」）。
- ✅ 捕获脚本确实写进了 `vrmoo_cookies` 等键（用户收到「Cookie已捕获」）。
- ✅ 捕获正则与 MITM 已覆盖非 www / 双域名（修复了最初静默不触发的问题）。
- ❌ 未知：签到具体失败原因（等用户报错文本）。

## 7. 未决问题（OPEN ISSUE）
**现象**：捕获成功，但手动运行「魔趣每日签到」仍报错（用户描述「和之前一样错误」，未给原文）。
**已做的诊断增强（v1.0.2）**：签到脚本现在会：
- 发送 `Cookie` + `Referer` + `Origin` + `User-Agent` + `X-Requested-With` 头，`body:""`；
- 若主域名返回「未登录」，自动用 `www<->apex` 互换的备用域名重试一次；
- 通知里打印：状态码、服务器原话（前 200 字）、以及 Cookie 组成诊断 `b2:Y/N wpName:Y/N wpVal:Y/N phpsessid:Y/N`。
**下一步（解锁本问题所需）**：用户在 Loon 手动运行「魔趣每日签到」，把通知**原话**发来。按诊断信息分类处置：
| 通知内容 | 含义 | 对策 |
|---|---|---|
| `user_error/请先登录` | Cookie 未被认（域名层 or 缺项） | 改「原样透传完整 Cookie」；或按备用域重试逻辑再扩展 |
| `返回非JSON(403/404)` | 路径/UA/来源被拦 | 调整头或探测真实接口路径 |
| `网络错误/timeout` | Loon 访问 vrmoo.net 不通 | 确认 Loon 是 Safari 代理、节点可达 |
| 某组件 `:N` | 捕获漏存 | 修 capture.js 解析 |

## 8. 新对话恢复步骤
1. 开新对话，发送：
   > 读 `C:/Users/lili/AppData/Local/hermes/workspace/vrmoo-net/HANDOFF.md`，继续魔趣 vrmoo 自动签到脚本调试。当前卡在签到调用报错，这是报错原话：<粘贴通知>
2. 若 HANDOFF 不够，可让 agent 用 `session_search(query="vrmoo 签到 loon")` 拉回完整历史。
3. 可加载 `loon-auto-checkin` skill（含通用工作流与坑）。
4. 改完脚本：`write_file` 更新工作区文件 → 用第 5 节 Python 片段推仓库 → 让用户重装/重跑验证。

## 9. 备注
- 用户原仓库 `csjoyxy/vrmoo-loon-signin`（仅 vrmoo.vip）未改动，本插件是独立新仓库。
- 用户偏好：免费/低价方案优先；用中文交流；iPhone + Loon。
- Token 安全：token 仅在 `.env`，用户可随时在 GitHub 吊销；不要写回聊天。
