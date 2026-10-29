/* =========================================================
   CAREER QR — Trợ lý AI (dùng chung mọi trang)

   Trình duyệt KHÔNG còn giữ API key và không gọi thẳng nhà cung cấp AI.
   Mọi yêu cầu đi qua CAREER Gateway (n8n) qua assets/js/career-gateway.js:
   n8n xác thực, giới hạn lượt dùng, giữ system prompt rồi mới gọi LLM.

   Cần nạp trước file này (theo thứ tự):
     firebase-app-compat.js, firebase-auth-compat.js, firebase-config.js,
     gateway-config.js, career-gateway.js

   Các trang khác dùng chung:
     CareerAI.ask({ mode: "plan" | "suggest" | "chat", message, history?, context? })  -> Promise<string>
     CareerAI.parseJson(text)    -> bóc ```json ... ``` rồi parse
     CareerAI.errorText(err)     -> thông báo lỗi tiếng Việt thân thiện
   ========================================================= */

// Trợ giúp: model đôi khi bọc JSON trong ```json ... ``` — bóc ra và parse.
function parseAIJson(text) {
  const cleaned = text.replace(/```json/gi, "```").split("```").join("").trim();
  const start = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  let from = start;
  if (start === -1 || (startArr !== -1 && startArr < start)) from = startArr;
  const jsonSlice = from >= 0 ? cleaned.slice(from) : cleaned;
  return JSON.parse(jsonSlice);
}

function careerAIErrorText(err) {
  if (err && err.code && window.CareerGateway) return window.CareerGateway.friendlyError(err);
  return (err && err.message) || "lỗi không rõ";
}

window.CareerAI = {
  ask: (p) => window.CareerGateway.ask(p),
  parseJson: parseAIJson,
  errorText: careerAIErrorText
};

(function () {
  // Lịch sử hội thoại (chỉ gồm lượt user/assistant; system prompt do n8n giữ).
  let conversationHistory = [];
  let panelBuilt = false;
  const MAX_INPUT = 1000; // khớp giới hạn của mode "chat" trong n8n

  function mount() {
    const launcher = document.createElement("button");
    launcher.id = "ai-chat-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Mở trợ lý AI hướng nghiệp");
    launcher.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.08-.16-3.02-.46L3 21l1.55-4.13A7.86 7.86 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"/></svg>`;

    const panel = document.createElement("div");
    panel.id = "ai-chat-panel";
    panel.innerHTML = `
      <div class="chat-head">
        <div>
          <strong>Trợ lý CAREER QR</strong>
          <span>Hỏi về ngành học, trường, tổ hợp…</span>
        </div>
        <button class="chat-close" type="button" aria-label="Đóng trợ lý">×</button>
      </div>
      <div class="chat-body" id="ai-chat-body">
        <div class="chat-msg bot">Chào bạn 👋 Chị/anh là trợ lý hướng nghiệp của CAREER QR. Bạn đang băn khoăn điều gì — về sở thích, ngành học, hay chọn trường?</div>
      </div>
      <div class="chat-input">
        <textarea id="ai-chat-input" placeholder="Nhập câu hỏi…" rows="1" maxlength="1000"></textarea>
        <button id="ai-chat-send" type="button">Gửi</button>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    function toggleOpen() {
      const willOpen = !panel.classList.contains("open");
      panel.classList.toggle("open", willOpen);
      // Khi mở khung chat, ẩn nút mở đi và cho panel chiếm luôn phần
      // không gian đó (tối ưu diện tích màn hình, nhất là trên điện thoại).
      launcher.classList.toggle("is-hidden", willOpen);
      if (willOpen) {
        document.getElementById("ai-chat-input").focus();
        // Xin sẵn token (và tạo phiên ẩn danh nếu cần) để câu hỏi đầu không phải chờ.
        if (window.CareerGateway) window.CareerGateway.prefetchToken();
      }
    }
    launcher.addEventListener("click", toggleOpen);

    panel.querySelector(".chat-close").addEventListener("click", () => {
      panel.classList.remove("open");
      launcher.classList.remove("is-hidden");
    });

    const input = document.getElementById("ai-chat-input");
    document.getElementById("ai-chat-send").addEventListener("click", sendMessage);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    panelBuilt = true;
  }

  function appendMessage(text, cls) {
    const body = document.getElementById("ai-chat-body");
    const div = document.createElement("div");
    div.className = "chat-msg " + cls;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const input = document.getElementById("ai-chat-input");
    const sendBtn = document.getElementById("ai-chat-send");
    const text = input.value.trim();
    if (!text) return;

    if (text.length > MAX_INPUT) {
      appendMessage("Câu hỏi hơi dài, bạn rút gọn dưới " + MAX_INPUT + " ký tự giúp mình nhé.", "error");
      return;
    }

    appendMessage(text, "user");
    input.value = "";
    sendBtn.disabled = true;

    const typingEl = appendMessage("Đang trả lời…", "bot typing");

    try {
      const reply = await CareerAI.ask({
        mode: "chat",
        message: text,
        history: conversationHistory,                 // các lượt trước (chưa gồm câu hỏi hiện tại)
        context: window.CAREERQR_AI_CONTEXT || ""     // bối cảnh trang, đọc tại thời điểm gửi
      });
      typingEl.remove();
      appendMessage(reply, "bot");
      conversationHistory.push({ role: "user", content: text }, { role: "assistant", content: reply });
    } catch (err) {
      typingEl.remove();
      appendMessage(careerAIErrorText(err) + " Bạn cũng có thể hỏi trực tiếp giáo viên tư vấn nhé.", "error");
      console.error(err);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!panelBuilt) mount();
  });
})();
