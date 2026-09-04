/* =========================================================
   CAREER QR — Tiện ích dùng chung cho mọi trang
   ========================================================= */

// ---- Menu mobile ----
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  // Đánh dấu link đang ở trang hiện tại
  const current = document.body.dataset.page;
  if (current) {
    document.querySelectorAll(".site-nav a[data-page]").forEach(a => {
      if (a.dataset.page === current) a.classList.add("current");
    });
  }
});

/* =========================================================
   Lưu trữ cá nhân (localStorage) — KHÔNG dùng Firestore
   Lý do: CAREER QR không có đăng nhập, nên dữ liệu cá nhân của
   học sinh (phương án đã lưu, kết quả khám phá bản thân, kế
   hoạch nghề nghiệp) chỉ nên lưu trên máy của các em, không đưa
   lên cơ sở dữ liệu công khai.
   ========================================================= */
const CareerStore = {
  KEYS: {
    SELF: "careerqr_kham_pha_ban_than",
    SAVED_NGANH: "careerqr_nganh_da_luu",
    COMPARE: "careerqr_so_sanh",
    ROADMAP: "careerqr_ke_hoach",
    CHAT: "careerqr_ai_chat_history"
  },
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Không lưu được vào localStorage:", e);
      return false;
    }
  },
  addSavedNganh(item) {
    const list = this.get(this.KEYS.SAVED_NGANH, []);
    if (!list.some(x => x.id === item.id)) {
      list.push(item);
      this.set(this.KEYS.SAVED_NGANH, list);
    }
    return list;
  },
  removeSavedNganh(id) {
    const list = this.get(this.KEYS.SAVED_NGANH, []).filter(x => x.id !== id);
    this.set(this.KEYS.SAVED_NGANH, list);
    return list;
  }
};

// ---- Helper: chuỗi "A00, A01, D01" -> mảng ----
function splitCodes(str) {
  if (!str) return [];
  return String(str).split(/[,;/]/).map(s => s.trim()).filter(Boolean);
}

// ---- Helper: tạo chip HTML an toàn (escape) ----
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
