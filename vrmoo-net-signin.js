/**
 * 魔趣(vrmoo.net / vrmoo.vip) 每日自动签到 - Loon 版（诊断增强 v1.0.2）
 * 类型：cron（可手动运行测试）
 *
 * 逻辑：读取捕获的登录 Cookie，POST 到 /wp-json/b2/v1/userMission 完成每日签到。
 *      若主域名返回“未登录”，自动用 www<->apex 互换的备用域名重试一次
 *      （Cookie 常因域名差这一层而失效）。
 */
const COOKIE_KEY  = "vrmoo_cookies";
const HOST_KEY    = "vrmoo_host";
const B2_KEY      = "vrmoo_b2_token";
const WP_KEY      = "vrmoo_wp_cookie";
const PHP_KEY     = "vrmoo_phpsessid";
const WP_NAME_KEY = "vrmoo_wp_cookie_name";

function getCookieAndHost() {
    const cookie = $persistentStore.read(COOKIE_KEY) || "";
    let host = $persistentStore.read(HOST_KEY) || "www.vrmoo.net";
    if (!cookie) {
        // 兜底：用各组件拼一份
        const b2 = $persistentStore.read(B2_KEY) || "";
        const ph = $persistentStore.read(PHP_KEY) || "";
        const wn = $persistentStore.read(WP_NAME_KEY) || "";
        const wv = $persistentStore.read(WP_KEY) || "";
        const full = [b2 ? "b2_token=" + b2 : "",
                      (wn && wv) ? wn + "=" + wv : "",
                      ph ? "PHPSESSID=" + ph : "",
                      "night=0",
                      "gg_info=" + Math.floor(Date.now() / 1000)].filter(Boolean).join("; ");
        if (full) { return { cookie: full, host }; }
        return { cookie: "", host };
    }
    return { cookie, host };
}

function altHost(h) {
    if (h.startsWith("www.")) return h.slice(4);
    return "www." + h;
}

function diag(cookie) {
    const b2 = $persistentStore.read(B2_KEY) ? "Y" : "N";
    const ph = $persistentStore.read(PHP_KEY) ? "Y" : "N";
    const wn = $persistentStore.read(WP_NAME_KEY) ? "Y" : "N";
    const wv = $persistentStore.read(WP_KEY) ? "Y" : "N";
    return `b2:${b2} wpName:${wn} wpVal:${wv} phpsessid:${ph}`;
}

function signinOnce(host, cookie, cb) {
    const url = "https://" + host + "/wp-json/b2/v1/userMission";
    const headers = {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://" + host + "/",
        "Origin": "https://" + host,
        "X-Requested-With": "XMLHttpRequest"
    };
    const opts = { headers: headers, body: "" };
    console.log("[vrmoo] POST " + url);
    $httpClient.post(url, opts, function (err, resp, data) {
        let status = resp && resp.status ? resp.status : (resp && resp.statusCode ? resp.statusCode : "?");
        console.log("[vrmoo] status=" + status + " err=" + (err || "null") + " data=" + (data || "").slice(0, 300));
        cb(err, status, data || "");
    });
}

function notify(title, subtitle, body) {
    if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle, body);
    }
}

function main() {
    const { cookie, host } = getCookieAndHost();
    if (!cookie) {
        notify("魔趣签到", "失败", "无Cookie：请先在 Safari 通过 Loon 登录 vrmoo.net");
        console.log("[vrmoo] no cookie");
        $done();
        return;
    }
    console.log("[vrmoo] host=" + host + " diag=" + diag(cookie));

    signinOnce(host, cookie, function (err, status, data) {
        if (err) {
            // 网络错误，尝试备用域名
            const ah = altHost(host);
            console.log("[vrmoo] err on " + host + ", retry " + ah);
            signinOnce(ah, cookie, function (err2, status2, data2) {
                if (err2) {
                    notify("魔趣签到", "网络错误", String(err2).slice(0, 200) + " | diag:" + diag(cookie));
                    $done();
                    return;
                }
                finish(status2, data2, ah, cookie);
            });
            return;
        }
        // 判断是否“未登录”
        let notLogin = false;
        try {
            const j = JSON.parse(data);
            if (j && (j.code === "user_error" || (j.message && j.message.indexOf("登录") >= 0))) notLogin = true;
        } catch (e) {}
        if (notLogin) {
            const ah = altHost(host);
            console.log("[vrmoo] notLogin on " + host + ", retry " + ah);
            signinOnce(ah, cookie, function (err2, status2, data2) {
                if (err2) {
                    notify("魔趣签到", "失败", "主域未登录且备用域网络错误: " + String(err2).slice(0, 120) + " | diag:" + diag(cookie));
                    $done();
                    return;
                }
                finish(status2, data2, ah, cookie);
            });
            return;
        }
        finish(status, data, host, cookie);
    });
}

function finish(status, data, usedHost, cookie) {
    let title = "魔趣签到", sub = "", body = "";
    try {
        const j = JSON.parse(data);
        if (j && j.code === "success") {
            sub = "成功";
            let credit = "";
            if (j.data) {
                credit = j.data.credit != null ? j.data.credit
                       : (j.data.mission && j.data.mission.credit != null) ? j.data.mission.credit
                       : (j.data.mission && j.data.mission.my_credit != null) ? j.data.mission.my_credit : "";
            }
            body = (credit !== "" ? ("+积分 " + credit + "；") : "") + (j.message || "");
        } else {
            sub = "失败(" + (j.code || status) + ")";
            body = (j.message || data || "未知返回") + " | diag:" + diag(cookie);
        }
    } catch (e) {
        sub = "返回非JSON(" + status + ")";
        body = "前200字: " + String(data).slice(0, 200) + " | diag:" + diag(cookie);
    }
    notify(title, sub, body);
    $done();
}

main();
