/**
 * 魔趣(vrmoo.net / vrmoo.vip) Cookie 自动捕获脚本 - Loon 版
 *
 * 类型：http-response
 * 匹配：^https://www\.(vrmoo\.net|vrmoo\.vip)/
 *
 * 功能：在 Safari 中访问魔趣任意页面时，自动从请求头提取 Cookie
 *       (b2_token / wordpress_logged_in_* / PHPSESSID) 并持久化存储，
 *       同时记录本次登录使用的域名，供签到脚本回打。
 */
const COOKIE_KEY   = "vrmoo_cookies";
const HOST_KEY     = "vrmoo_host";
const B2_KEY       = "vrmoo_b2_token";
const WP_KEY       = "vrmoo_wp_cookie";
const PHP_KEY      = "vrmoo_phpsessid";
const WP_NAME_KEY  = "vrmoo_wp_cookie_name";
const WP_PREFIX    = "wordpress_logged_in_";

if ($request && $request.headers) {
    const headers = $request.headers;
    const raw = headers["Cookie"] || headers["cookie"] || "";
    if (!raw) { $done({}); return; }

    // 记录实际使用的域名（.net 或 .vip），签到时回打同一域名
    let host = "www.vrmoo.net";
    const um = ($request.url || "").match(/^https?:\/\/([^/]+)/);
    if (um) host = um[1];

    const cookies = {};
    raw.split(";").forEach(p => {
        const i = p.indexOf("=");
        if (i > 0) cookies[p.substring(0, i).trim()] = p.substring(i + 1).trim();
    });

    let changed = false;
    if (cookies["b2_token"])  { $persistentStore.write(cookies["b2_token"], B2_KEY); changed = true; }
    if (cookies["PHPSESSID"]) { $persistentStore.write(cookies["PHPSESSID"], PHP_KEY); changed = true; }
    for (const k of Object.keys(cookies)) {
        if (k.startsWith(WP_PREFIX)) {
            $persistentStore.write(cookies[k], WP_KEY);
            $persistentStore.write(k, WP_NAME_KEY);
            changed = true;
            break;
        }
    }

    if (changed) {
        const b2 = cookies["b2_token"] || $persistentStore.read(B2_KEY) || "";
        const ph = cookies["PHPSESSID"] || $persistentStore.read(PHP_KEY) || "";
        const wn = Object.keys(cookies).find(k => k.startsWith(WP_PREFIX)) || $persistentStore.read(WP_NAME_KEY) || "";
        const wv = cookies[wn] || $persistentStore.read(WP_KEY) || "";

        const full = [
            b2 ? "b2_token=" + b2 : "",
            (wn && wv) ? wn + "=" + wv : "",
            ph ? "PHPSESSID=" + ph : "",
            "night=0",
            "gg_info=" + Math.floor(Date.now() / 1000)
        ].filter(Boolean).join("; ");

        $persistentStore.write(full, COOKIE_KEY);
        $persistentStore.write(host, HOST_KEY);
        console.log("[vrmoo] Cookie captured for " + host);
        $notification.post("魔趣", "Cookie已捕获", "域名: " + host + " (可关闭页面，之后自动签到)");
    }
    $done({});
} else {
    $done({});
}
