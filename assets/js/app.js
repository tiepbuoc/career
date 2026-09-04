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

/* =========================================================
   CareerWizard — hiện từng bước một, ẩn bước cũ đi
   Dùng cho các trang dạng hỏi-đáp / chọn tuần tự (khám phá bản
   thân, tra cứu, so sánh…) để luôn chỉ hiện 1 nội dung, gọn và
   dễ theo dõi trên điện thoại.
   ========================================================= */
function CareerWizard(root) {
  const panes = [...root.querySelectorAll(".step-pane")];
  let current = panes.findIndex(p => p.classList.contains("is-active"));
  if (current < 0) current = 0;

  function go(index, { scroll = true } = {}) {
    if (index < 0 || index >= panes.length) return;
    panes.forEach((p, i) => p.classList.toggle("is-active", i === index));
    current = index;
    if (scroll) {
      requestAnimationFrame(() => {
        panes[index].scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  return {
    go,
    next: (opts) => go(current + 1, opts),
    back: (opts) => go(current - 1, opts),
    current: () => current,
    panes
  };
}
