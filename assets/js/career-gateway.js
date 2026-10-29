/* =========================================================
   CAREER QR — Module gọi AI qua CAREER Gateway (n8n)
   (script thường, nạp bằng <script>; cần firebase-app-compat + firebase-auth-compat)

   Luồng:
    1. Lấy Firebase ID token của người dùng. CAREER QR không có màn đăng nhập nên dùng
       đăng nhập ẩn danh (Anonymous Auth) — tự tạo ở lần dùng AI đầu tiên, nhớ trong trình duyệt.
    2. Gửi {id_token, page_url} tới /career-gw-token -> nhận token sống ~5 phút.
    3. Gọi /career-gw-chat kèm token + mode -> n8n kiểm tra, gọi LLM và trả lời.
   Token được làm mới âm thầm: (a) hẹn giờ ở phút thứ 4 nếu người dùng vừa hoạt động,
   (b) làm mới "lười" ngay trước khi gọi nếu token còn dưới 60 giây, (c) tự thử lại 1 lần khi gặp 401.

   mode: "chat" (khung trò chuyện) | "plan" (soạn kế hoạch JSON) | "suggest" (gợi ý ngành JSON).
   System prompt, model, nhiệt độ, max_tokens của từng mode do n8n quyết định.
   ========================================================= */
(function () {
  "use strict";

  const BASE_URL = (window.CAREER_GATEWAY && window.CAREER_GATEWAY.BASE_URL) || "";
  const RENEW_BEFORE_MS = 60 * 1000;        // còn dưới 60s thì xin token mới trước khi gọi
  const RENEW_TIMER_BEFORE_MS = 60 * 1000;  // hẹn giờ xin lại khi còn 60s
  const ACTIVE_WINDOW_MS = 10 * 60 * 1000;  // chỉ tự gia hạn nền nếu người dùng vừa dùng AI trong 10 phút

  let cached = null;      // { token, expMs }
  let inflight = null;    // chống gọi trùng khi nhiều nơi cùng xin token
  let userPromise = null; // chống đăng nhập ẩn danh trùng
  let renewTimer = null;
  let lastUsedAt = 0;

  class GatewayError extends Error {
    constructor(code, status) { super(code); this.code = code; this.status = status || 0; }
  }

  // Chỉ gửi origin + đường dẫn (bỏ ?query và #hash, vì link chia sẻ kế hoạch có thể chứa dữ liệu cá nhân).
  function pageUrl() { return location.origin + location.pathname; }

  async function postJson(path, body) {
    let res;
    try {
      res = await fetch(BASE_URL + path, {
        method: "POST",
        // text/plain = "simple request": trình duyệt không gửi preflight (OPTIONS) tới n8n.
        // Nội dung vẫn là JSON, n8n tự parse.
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new GatewayError("network_error");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* phản hồi không phải JSON */ }
    return { status: res.status, data };
  }

  /* ---------- Firebase Anonymous Auth ---------- */
  function authError(e) {
    const c = e && e.code;
    if (c === "auth/operation-not-allowed" || c === "auth/admin-restricted-operation") {
      return new GatewayError("anon_auth_disabled");
    }
    return new GatewayError("auth_unavailable");
  }

  function getUser() {
    if (typeof firebase === "undefined" || !firebase.auth) return Promise.reject(new GatewayError("auth_unavailable"));
    const auth = firebase.auth();
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (!userPromise) {
      userPromise = new Promise((resolve, reject) => {
        let unsub = null;
        let handled = false;
        unsub = auth.onAuthStateChanged(async (u) => {
          if (handled) return;
          handled = true;
          if (unsub) unsub();
          if (u) { resolve(u); return; }
          try { resolve((await auth.signInAnonymously()).user); }
          catch (e) { reject(authError(e)); }
        });
      }).finally(() => { userPromise = null; });
    }
    return userPromise;
  }

  // Tài khoản ẩn danh bị xoá phía server (hiếm) -> tạo lại.
  async function resetUser() {
    const auth = firebase.auth();
    try { await auth.signOut(); } catch (e) { /* bỏ qua */ }
    try { return (await auth.signInAnonymously()).user; }
    catch (e) { throw authError(e); }
  }

  /* ---------- Token ---------- */
  async function fetchToken(isRetry) {
    const user = await getUser();
    let idToken;
    try { idToken = await user.getIdToken(!!isRetry); }
    catch (e) { throw new GatewayError("auth_unavailable"); }

    const { status, data } = await postJson("/career-gw-token", { id_token: idToken, page_url: pageUrl() });

    if (status === 401 && data && data.error === "invalid_id_token" && !isRetry) {
      await resetUser();
      return fetchToken(true);
    }
    if (status !== 200 || !data || !data.token) {
      throw new GatewayError((data && data.error) || "token_http_" + status, status);
    }
    const ttlMs = (Number(data.expires_in) || 300) * 1000;
    cached = { token: data.token, expMs: Date.now() + ttlMs };
    scheduleRenew(ttlMs);
    return cached.token;
  }

  function scheduleRenew(ttlMs) {
    clearTimeout(renewTimer);
    renewTimer = setTimeout(() => {
      if (Date.now() - lastUsedAt < ACTIVE_WINDOW_MS) ensureToken(true).catch(() => {});
    }, Math.max(10 * 1000, ttlMs - RENEW_TIMER_BEFORE_MS));
  }

  /** Đảm bảo có token còn hạn; force=true để bắt buộc xin mới. */
  function ensureToken(force) {
    if (!force && cached && cached.expMs - Date.now() > RENEW_BEFORE_MS) return Promise.resolve(cached.token);
    if (!inflight) inflight = fetchToken(false).finally(() => { inflight = null; });
    return inflight;
  }

  /** Gọi khi người dùng mở khung chat, để câu hỏi đầu không phải chờ xin token. */
  function prefetchToken() {
    lastUsedAt = Date.now();
    ensureToken().catch(() => {});
  }

  /** Thông báo lỗi thân thiện bằng tiếng Việt cho người dùng cuối. */
  function friendlyError(err) {
    const code = (err && err.code) || "";
    const map = {
      network_error: "Không kết nối được tới trợ lý, hãy kiểm tra mạng rồi thử lại.",
      anon_auth_disabled: "Trợ lý chưa được bật (thiếu đăng nhập ẩn danh trong Firebase). Hãy báo người quản trị.",
      auth_unavailable: "Không khởi tạo được phiên làm việc cho trợ lý. Tải lại trang rồi thử lại nhé.",
      user_rate_limit: "Bạn gửi hơi nhanh, đợi một chút rồi hỏi tiếp nhé.",
      user_daily_limit: "Hôm nay bạn đã dùng hết lượt hỏi trợ lý. Mai quay lại nhé!",
      web_daily_cap: "Hôm nay trợ lý đã hết lượt dùng. Thử lại vào ngày mai nhé.",
      daily_cap_reached: "Hôm nay trợ lý đã hết lượt dùng. Thử lại vào ngày mai nhé.",
      gateway_disabled: "Trợ lý đang tạm dừng để bảo trì. Thử lại sau nhé.",
      message_too_long: "Nội dung quá dài, hãy rút gọn lại.",
      too_many_requests: "Có quá nhiều yêu cầu, đợi một chút rồi thử lại.",
      llm_unavailable: "Trợ lý đang quá tải, thử lại sau ít phút nhé.",
      forbidden: "Trang này chưa được phép dùng trợ lý."
    };
    return map[code] || ("Trợ lý đang gặp sự cố (" + (code || (err && err.message) || "lỗi không rõ") + "). Thử lại sau nhé.");
  }

  /**
   * Gửi câu hỏi tới AI.
   * @param {{mode?:"chat"|"plan"|"suggest", message:string, history?:{role:string,content:string}[], context?:string}} p
   * @returns {Promise<string>} nội dung trả lời
   */
  async function ask({ mode = "chat", message, history = [], context = "" }) {
    lastUsedAt = Date.now();
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await ensureToken(attempt > 0);
      const { status, data } = await postJson("/career-gw-chat", {
        token, mode, message, history, context, page_url: pageUrl()
      });
      if (status === 200 && data && typeof data.reply === "string") return data.reply;
      const code = (data && data.error) || "http_" + status;
      // token hết hạn/không hợp lệ -> xin token mới và thử lại đúng 1 lần
      if (status === 401 && attempt === 0) { cached = null; continue; }
      throw new GatewayError(code, status);
    }
    throw new GatewayError("token_refresh_failed");
  }

  window.CareerGateway = { ask, ensureToken, prefetchToken, friendlyError, GatewayError };
})();
