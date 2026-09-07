/* =========================================================
   CAREER QR — Chia sẻ qua mã QR
   ---------------------------------------------------------
   Vì trang không có đăng nhập / máy chủ lưu dữ liệu cá nhân,
   cách chia sẻ đơn giản nhất là: gói gọn phần dữ liệu cần cho
   người khác xem ngay vào trong đường link (tham số "?xem=…"),
   rồi vẽ mã QR trỏ tới đường link đó. Khi ai đó quét mã, trang
   sẽ mở đúng dữ liệu này ở chế độ CHỈ XEM — không chỉnh sửa
   được, và không có gì được gửi lên máy chủ cả.
   Với trang Tra cứu, không cần đóng gói dữ liệu — chỉ cần dùng
   lại đúng các tham số lọc mà trang đã hỗ trợ sẵn trên URL.
   ========================================================= */
const CareerShare = (function () {
  function toBase64Url(json) {
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromBase64Url(str) {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return decodeURIComponent(escape(atob(b64)));
  }

  function encodeData(obj) {
    return toBase64Url(JSON.stringify(obj));
  }
  function decodeData(str) {
    try { return JSON.parse(fromBase64Url(str)); } catch (e) { return null; }
  }

  // Đọc dữ liệu chia sẻ từ URL hiện tại (tham số "xem"), nếu có.
  function readShared() {
    const raw = new URLSearchParams(location.search).get("xem");
    if (!raw) return null;
    return decodeData(raw);
  }

  // Ghép URL tuyệt đối tới 1 trang trong site + bộ tham số cho trước
  // (bỏ qua các tham số rỗng/undefined).
  function buildUrl(pageFile, paramsObj) {
    const url = new URL(pageFile, location.href);
    url.search = "";
    Object.entries(paramsObj || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
    return url.toString();
  }

  function buildShareUrl(pageFile, dataObj) {
    return buildUrl(pageFile, { xem: encodeData(dataObj) });
  }

  /* ---------------------------------------------------------
     Tải thư viện vẽ QR (qrcode.js) THEO YÊU CẦU, ngay khi cần
     vẽ mã — thay vì trông cậy vào thẻ <script> tĩnh đã chạy
     xong trước đó hay chưa (mạng chậm / trình duyệt chặn script
     ngoài khi mở bằng file:// đều có thể khiến thẻ đó lỡ nhịp).

     Ưu tiên bản đóng gói sẵn trong chính dự án
     (assets/js/vendor/qrcode.min.js) — không phụ thuộc CDN nào,
     hoạt động cả khi không có mạng ngoài hoặc mở trang bằng
     file://. Hai URL CDN bên dưới chỉ là phương án dự phòng
     trong trường hợp file local vì lý do gì đó bị thiếu.
     ---------------------------------------------------------- */
  const QR_LIB_URLS = [
    "assets/js/vendor/qrcode.min.js",
    "https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js",
    "https://unpkg.com/qrcode@1.4.4/build/qrcode.min.js"
  ];
  let qrLibPromise = null;

  function loadScriptOnce(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error("timeout: " + url));
      }, timeoutMs);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("load error: " + url)); };
      document.head.appendChild(script);
    });
  }

  // Thử lần lượt từng URL trong danh sách, dùng cái đầu tiên tải được.
  async function loadQRCodeLibFromCdns() {
    let lastErr;
    for (const url of QR_LIB_URLS) {
      try {
        await loadScriptOnce(url);
        if (window.QRCode && QRCode.toCanvas) return;
        lastErr = new Error("script tải xong nhưng không thấy window.QRCode: " + url);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Không tải được thư viện QR từ bất kỳ nguồn nào.");
  }

  // Đảm bảo thư viện đã sẵn sàng, chỉ tải 1 lần dù gọi open() nhiều lần.
  function ensureQRCodeLib() {
    if (window.QRCode && QRCode.toCanvas) return Promise.resolve();
    if (!qrLibPromise) {
      qrLibPromise = loadQRCodeLibFromCdns().catch((err) => {
        qrLibPromise = null; // cho phép thử lại ở lần bấm sau (vd. mạng vừa có lại)
        throw err;
      });
    }
    return qrLibPromise;
  }

  /* ---------------- Modal chung để hiện mã QR ---------------- */
  let modal, canvas, linkInput, titleEl, descEl, copyBtn, statusEl;

  function ensureModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = "share-qr-modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width:380px; text-align:center;">
        <button class="modal-close" type="button" aria-label="Đóng">×</button>
        <h3 id="share-qr-title" class="mt-0">Chia sẻ qua mã QR</h3>
        <p id="share-qr-desc" class="text-soft" style="font-size:.88rem;"></p>
        <canvas class="share-qr-canvas" width="220" height="220"></canvas>
        <p id="share-qr-status" class="text-faint" style="min-height:1.2em; margin:6px 0 0;"></p>
        <div class="share-link-row">
          <input type="text" id="share-qr-link" readonly>
          <button class="btn btn-ghost btn-sm" type="button" id="share-qr-copy">Sao chép</button>
        </div>
        <p class="text-faint" style="margin-top:10px;">Người quét mã chỉ xem được, không chỉnh sửa được dữ liệu của em.</p>
      </div>`;
    document.body.appendChild(modal);

    canvas = modal.querySelector("canvas");
    linkInput = modal.querySelector("#share-qr-link");
    titleEl = modal.querySelector("#share-qr-title");
    descEl = modal.querySelector("#share-qr-desc");
    copyBtn = modal.querySelector("#share-qr-copy");
    statusEl = modal.querySelector("#share-qr-status");

    modal.querySelector(".modal-close").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(linkInput.value);
      } catch (e) {
        linkInput.removeAttribute("readonly");
        linkInput.select();
        document.execCommand("copy");
        linkInput.setAttribute("readonly", "true");
      }
      copyBtn.textContent = "Đã sao chép ✓";
      setTimeout(() => { copyBtn.textContent = "Sao chép"; }, 1800);
    });
  }

  function clearCanvas() {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function open(url, opts = {}) {
    ensureModal();
    titleEl.textContent = opts.title || "Chia sẻ qua mã QR";
    descEl.textContent = opts.description || "Cho bạn khác quét mã này để xem cùng nội dung.";
    linkInput.value = url;
    copyBtn.textContent = "Sao chép";
    modal.classList.add("open");

    // Mở modal ngay (không chờ thư viện) để người dùng thấy phản hồi tức thì;
    // link vẫn dùng/copy được ngay cả khi mã QR chưa vẽ xong.
    clearCanvas();
    statusEl.textContent = "Đang tải bộ tạo mã QR…";
    statusEl.style.color = "";

    try {
      await ensureQRCodeLib();
      // Modal có thể đã bị đóng hoặc mở lại cho link khác trong lúc chờ tải —
      // chỉ vẽ nếu link input vẫn đang là link này.
      if (linkInput.value !== url) return;
      QRCode.toCanvas(canvas, url, { width: 220, margin: 1, color: { dark: "#1B2A2E", light: "#FFFFFF" } }, (err) => {
        if (err) {
          console.error("Không tạo được mã QR:", err);
          statusEl.textContent = "Không vẽ được mã QR. Bạn vẫn có thể sao chép đường link bên dưới.";
          statusEl.style.color = "var(--danger, #b3261e)";
        } else {
          statusEl.textContent = "";
        }
      });
    } catch (err) {
      console.error("Không tải được thư viện tạo mã QR:", err);
      if (linkInput.value !== url) return;
      statusEl.textContent = "Không tải được bộ tạo mã QR (có thể do mạng chậm hoặc bị chặn). Bạn vẫn có thể sao chép đường link bên dưới.";
      statusEl.style.color = "var(--danger, #b3261e)";
    }
  }

  // ---- Banner hiển thị khi đang xem dữ liệu người khác chia sẻ ----
  function renderBanner(mountEl, { text, saveLabel, onSave } = {}) {
    const box = document.createElement("div");
    box.className = "notice route shared-banner";
    box.innerHTML = `<p>${text}</p>` +
      (onSave ? `<button type="button" class="btn btn-waypoint btn-sm">${saveLabel || "Lưu về máy của em"}</button>` : "");
    if (onSave) box.querySelector("button").addEventListener("click", onSave);
    mountEl.prepend(box);
    return box;
  }

  return { encodeData, decodeData, readShared, buildUrl, buildShareUrl, open, renderBanner };
})();
