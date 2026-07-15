/**
 * 魔趣(vrmoo.net / vrmoo.vip) 每日自动签到 - Loon 版（全域名探测 + 原始Cookie优先 v1.0.3）
 * 类型：cron（可手动运行测试）
 *
 * 逻辑：
 *  1. 优先使用捕获时保存的「原始 Cookie 头」(vrmoo_raw_cookie) 透传；
 *     失败再退回组件重拼的 vrmoo_cookies。
 *  2. 依次尝试 4 个域名组合（www/apex × .net/.vip），命中即用。
 *     —— 解决「账号在 .vip 但脚本只打 .net」或 www↔apex 串域 的问题。
 *  3. 任意组合成功后，记录可用组合，后续日常只发 1 个请求。
 *  4. 全部失败时在通知里给出：末次服务器真实返回 + 状态码 + 已存 Cookie 组成，
 *     便于一次性定位。
 */
const COOKIE_KEY  = "vrmoo_cookies";
const RAW_KEY     = "vrmoo_raw_cookie";
const HOST_KEY    = "vrmoo_host";
const B2_KEY      = "vrmoo_b2_token";
const WP_KEY      = "vrmoo_wp_cookie";
const PHP_KEY     = "vrmoo_phpsessid";
const WP_NAME_KEY = "vrmoo_wp_cookie_name";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ALL_HOSTS = ["www.vrmoo.net", "vrmoo.net", "www.vrmoo.vip", "vrmoo.vip"];

function readStore(k) { try { return $persistentStore.read(k) || ""; } catch (e) { return ""; } }

function cookieCandidates() {
    const raw = readStore(RAW_KEY);
    const reasm = readStore(COOKIE_KEY) || (function () {
        // 兜底：用各组件拼一份（兼容旧版只存了组件的情况）
        const b2 = readStore(B2_KEY), ph = readStore(PHP_KEY),
              wn = readStore(WP_NAME_KEY), wv = readStore(WP_KEY);
        return [b2 ? "b2_token=" + b2 : "",
                (wn && wv) ? wn + "=" + wv : "",
                ph ? "PHPSESSID=" + ph : "",
                "night=0", "gg_info=" + Math.floor(Date.now() / 1000)]
               .filter(Boolean).join("; ");
    })();
    const fastType = readStore("vrmoo_ok_cookie"); // "raw" | "reasm"
    let list = [];
    if (fastType === "raw" && raw) list = [raw, reasm];
    else if (fastType === "reasm" && reasm) list = [reasm, raw];
    else list = [raw, reasm];
    list = list.filter(Boolean);
    return Array.from(new Set(list)); // 去重
}

function hostCandidates() {
    const okHost = readStore("vrmoo_ok_host");
    const recHost = readStore(HOST_KEY) || "www.vrmoo.net";
    let list = [];
    if (okHost) list.push(okHost);
    list = list.concat(ALL_HOSTS);
    if (recHost && !list.includes(recHost)) list.splice(1, 0, recHost);
    return Array.from(new Set(list));
}

function diagFlags() {
    const b2 = readStore(B2_KEY) ? "Y" : "N";
    const ph = readStore(PHP_KEY) ? "Y" : "N";
    const wn = readStore(WP_NAME_KEY) ? "Y" : "N";
    const wv = readStore(WP_KEY) ? "Y" : "N";
    const raw = readStore(RAW_KEY) ? "Y" : "N";
    return `raw:${raw} b2:${b2} wpName:${wn} wpVal:${wv} phpsessid:${ph}`;
}

function postOnce(host, cookie, cb) {
    const url = "https://" + host + "/wp-json/b2/v1/userMission";
    const headers = {
        "Cookie": cookie,
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://" + host + "/",
        "Origin": "https://" + host,
        "X-Requested-With": "XMLHttpRequest"
    };
    console.log("[vrmoo] POST " + url + " (cookieLen=" + cookie.length + ")");
    $httpClient.post(url, { headers: headers, body: "" }, function (err, resp, data) {
        const status = (resp && (resp.status || resp.statusCode)) || "?";
        const body = data || "";
        console.log("[vrmoo]   -> status=" + status + " err=" + (err || "null") + " body=" + body.slice(0, 200));
        cb(err, status, body, host);
    });
}

// 判定响应：成功 / 未登录 / 其它失败
function classify(status, body) {
    const s = String(body || "");
    if (s.indexOf("已经签到") >= 0 || s.indexOf("今日已") >= 0 || s.indexOf("已经") >= 0) {
        return { ok: true, kind: "already" };
    }
    if (s.indexOf("成功") >= 0 && s.indexOf("失败") < 0) {
        return { ok: true, kind: "text" };
    }
    try {
        const j = JSON.parse(s);
        if (j && j.code === "success") return { ok: true, kind: "json", j };
        if (j && j.data && (j.data.credit != null || (j.data.mission && (j.data.mission.credit != null || j.data.mission.my_credit != null)))) {
            return { ok: true, kind: "json", j };
        }
        if (j && j.code === "user_error") return { ok: false, notLogin: true, j };
    } catch (e) {}
    return { ok: false, notLogin: false };
}

function creditText(j) {
    if (!j) return "";
    const d = j.data || {};
    const m = d.mission || {};
    const credit = (d.credit != null) ? d.credit
                 : (m.credit != null) ? m.credit
                 : (m.my_credit != null) ? m.my_credit : "";
    const always = (m.always != null) ? m.always : "";
    const msg = j.message || "";
    let t = "";
    if (credit !== "") t += "+积分 " + credit + "；";
    if (always !== "") t += "连续 " + always + " 天；";
    t += msg;
    return t.trim();
}

function notify(title, sub, body) {
    if (typeof $notification !== 'undefined') $notification.post(title, sub, body);
}

function main() {
    const cookies = cookieCandidates();
    const hosts = hostCandidates();
    if (cookies.length === 0) {
        notify("魔趣签到", "失败", "无Cookie：请先在 Safari 通过 Loon 登录 vrmoo.net / vrmoo.vip");
        console.log("[vrmoo] no cookie at all");
        $done();
        return;
    }
    console.log("[vrmoo] diag=" + diagFlags() + " | hosts=" + hosts.length + " cookies=" + cookies.length);

    const attempts = [];
    let hi = 0, ci = 0, doneFlag = false;

    function next() {
        if (doneFlag) return;
        if (hi >= hosts.length) { finishAllFail(attempts); return; }
        if (ci >= cookies.length) { hi++; ci = 0; next(); return; }
        const host = hosts[hi], cookie = cookies[ci];
        ci++;
        postOnce(host, cookie, function (err, status, body, usedHost) {
            if (doneFlag) return;
            const c = classify(status, body);
            if (c.ok) {
                doneFlag = true;
                // 记录可用组合，日常只发 1 个请求
                $persistentStore.write(usedHost, "vrmoo_ok_host");
                $persistentStore.write(cookie === cookies[0] ? "raw" : "reasm", "vrmoo_ok_cookie");
                let sub = (c.kind === "already") ? "今日已签到" : "成功";
                let body2 = (c.kind === "json") ? creditText(c.j) : (body.slice(0, 120));
                notify("魔趣签到", sub, "host=" + usedHost + " | " + (body2 || "OK"));
                $done();
                return;
            }
            attempts.push((usedHost) + "[" + status + "]" + (c.notLogin ? "(未登录)" : (err ? "(网络错)" : "")));
            next();
        });
    }
    next();
}

function finishAllFail(attempts) {
    const last = attempts[attempts.length - 1] || "";
    const summary = attempts.join(" → ");
    notify("魔趣签到", "全部失败",
        "已试:" + attempts.length + "次 | 末次:" + last + " | diag:" + diagFlags());
    console.log("[vrmoo] ALL FAIL | " + summary);
    $done();
}

main();
