/**
 * 魔趣(vrmoo.net / vrmoo.vip) 每日自动签到脚本 - Loon 版
 *
 * 类型：cron (建议: 0 8 * * *)
 * 功能：读取持久化的 Cookie，向 b2 主题签到接口 POST 完成每日签到。
 *
 * 接口：https://<host>/wp-json/b2/v1/userMission   (POST, 无需 body)
 * 验证：未登录返回 {"code":"user_error","message":"请先登录"} → 提示重新登录
 */
const COOKIE_KEY  = "vrmoo_cookies";
const HOST_KEY    = "vrmoo_host";
const B2_KEY      = "vrmoo_b2_token";
const WP_KEY      = "vrmoo_wp_cookie";
const PHP_KEY      = "vrmoo_phpsessid";
const WP_NAME_KEY = "vrmoo_wp_cookie_name";

function getCookieAndHost() {
    const host = $persistentStore.read(HOST_KEY) || "www.vrmoo.net";
    const s = $persistentStore.read(COOKIE_KEY);
    if (s && s.length > 20) return { cookie: s, host };

    // 兜底：从分项重建完整 Cookie 串
    const b2 = $persistentStore.read(B2_KEY) || "";
    const wn = $persistentStore.read(WP_NAME_KEY) || "";
    const wv = $persistentStore.read(WP_KEY) || "";
    const ph = $persistentStore.read(PHP_KEY) || "";
    if (b2 || (wn && wv)) {
        const p = [];
        if (b2) p.push("b2_token=" + b2);
        if (wn && wv) p.push(wn + "=" + wv);
        if (ph) p.push("PHPSESSID=" + ph);
        p.push("night=0");
        p.push("gg_info=" + Math.floor(Date.now() / 1000));
        return { cookie: p.join("; "), host };
    }
    return { cookie: "", host };
}

function doSignIn(host, cookie) {
    const SIGN_URL = "https://" + host + "/wp-json/b2/v1/userMission";
    $httpClient.post(SIGN_URL, {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh-Hans;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": "https://" + host,
        "Referer": "https://" + host + "/",
        "Cookie": cookie
    }, "", function (err, resp, data) {
        if (err) {
            $notification.post("魔趣签到", "网络错误", String(err));
            $done();
            return;
        }
        console.log("[vrmoo-signin] HTTP " + (resp ? resp.status : "?") + " | " + (data || "").substring(0, 200));
        try {
            const j = JSON.parse(data);
            if (j.code === "user_error" || (j.message && j.message.indexOf("登录") > -1)) {
                $notification.post("魔趣签到", "Cookie 失效", "请在 Safari 重新登录 " + host);
            } else if (j.credit || j.mission) {
                const c = j.credit || (j.mission && j.mission.credit) || "?";
                const t = (j.mission && j.mission.my_credit) || "?";
                const d = (j.mission && j.mission.always) || "?";
                $notification.post("魔趣签到", "签到成功", "+" + c + "积分 | 总:" + t + " | 连续" + d + "天");
            } else if (data && data.indexOf("已经") > -1) {
                $notification.post("魔趣签到", "今日已签到", "无需重复");
            } else {
                $notification.post("魔趣签到", "未知响应", (data || "").substring(0, 100));
            }
        } catch (e) {
            if (data && data.indexOf("已经") > -1) {
                $notification.post("魔趣签到", "今日已签到", "无需重复");
            } else {
                $notification.post("魔趣签到", "响应解析失败", (data || "").substring(0, 100));
            }
        }
        $done();
    });
}

const r = getCookieAndHost();
if (!r.cookie) {
    $notification.post("魔趣签到", "无 Cookie", "请在 Safari 打开 vrmoo 登录一次");
    $done();
} else {
    doSignIn(r.host, r.cookie);
}
