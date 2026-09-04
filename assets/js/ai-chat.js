/* =========================================================
   CAREER QR — Trợ lý AI (dùng chung mọi trang)
   Viết dựa theo đúng cấu trúc gọi API của file chatbot mẫu
   bạn đã gửi (fetch → chat/completions, giữ lịch sử hội thoại).
   =========================================================

   ⚠️ QUAN TRỌNG VỀ BẢO MẬT
   API_KEY dưới đây là "key demo" y như trong file chatbot mẫu —
   nó nằm trong code JS mà TRÌNH DUYỆT tải về, nên bất kỳ ai xem
   mã nguồn trang GitHub Pages của bạn cũng lấy được key này.
   Điều đó ổn để chạy thử, nhưng KHÔNG an toàn khi dùng thật:
     - Ai đó có thể lấy key này dùng cho việc khác, tốn phí của bạn.
   Khi sẵn sàng dùng chính thức, cách an toàn là đặt một hàm trung
   gian (proxy) — ví dụ Firebase Cloud Function — giữ key ở phía
   máy chủ, và cho trang web gọi vào hàm đó thay vì gọi thẳng OpenAI.
   Xem hướng dẫn trong README.md của dự án.
   ========================================================= */

const AI_CONFIG = {
  API_KEY: "sk-4150297863e3eee405805e8609648e6c5cebb1b502ffb46e",
  API_ENDPOINT: "https://api.shopaikey.com/v1/chat/completions",
  MODEL: "gpt-4o-mini"
};

const AI_SYSTEM_PROMPT = `Bạn là trợ lý hướng nghiệp của CAREER QR, một công cụ giúp học sinh THPT tra cứu ngành học, trường đào tạo và tổ hợp xét tuyển.
Nhiệm vụ của bạn:
- Trả lời ngắn gọn, dễ hiểu, đúng trọng tâm câu hỏi của học sinh.
- Giúp học sinh suy nghĩ rõ hơn về sở thích, năng lực, và các lựa chọn ngành/trường — KHÔNG quyết định thay các em.
- Khi học sinh hỏi thông tin tuyển sinh cụ thể (điểm chuẩn, chỉ tiêu, học phí...), nhắc các em kiểm tra lại trên website tuyển sinh chính thức của trường vì thông tin có thể thay đổi theo năm.
- Không đưa ra chẩn đoán tâm lý hay kết luận "em nên chọn ngành X". Hãy gợi mở, đặt câu hỏi, và trình bày ưu/nhược điểm để học sinh tự quyết định.
- Nếu học sinh có dấu hiệu căng thẳng, áp lực học tập/thi cử, hãy quan tâm hỏi thăm và khuyến khích các em chia sẻ với giáo viên, phụ huynh hoặc chuyên gia tâm lý học đường.
Trả lời bằng tiếng Việt, giọng thân thiện, như một anh/chị tư vấn hướng nghiệp.`;

/* ---------------------------------------------------------
   Hàm gọi AI dùng chung — các trang khác (kế hoạch, khám phá
   bản thân…) có thể dùng window.CareerAI.chat(messages) để
   gọi AI mà không cần mở khung chat.
   --------------------------------------------------------- */
async function careerAIChat(messages, opts = {}) {
  const response = await fetch(AI_CONFIG.API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + AI_CONFIG.API_KEY
    },
    body: JSON.stringify({
      model: AI_CONFIG.MODEL,
      messages,
      temperature: opts.temperature ?? 0.6
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lỗi API (${response.status}): ${errText}`);
  }
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("AI không trả về nội dung.");
  return reply;
}

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

window.CareerAI = { chat: careerAIChat, parseJson: parseAIJson };

(function () {
  let conversationHistory = [{ role: "system", content: buildSystemPrompt() }];
  let panelBuilt = false;

  function buildSystemPrompt() {
    const extra = window.CAREERQR_AI_CONTEXT
      ? `\n\nBối cảnh trang hiện tại (dùng để trả lời sát hơn, không đọc lại nguyên văn cho học sinh): ${window.CAREERQR_AI_CONTEXT}`
      : "";
    return AI_SYSTEM_PROMPT + extra;
  }

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
        <div class="chat-msg bot">Chào em 👋 Chị/anh là trợ lý hướng nghiệp của CAREER QR. Em đang băn khoăn điều gì — về sở thích, ngành học, hay chọn trường?</div>
      </div>
      <div class="chat-suggest" id="ai-chat-suggest"></div>
      <div class="chat-input">
        <textarea id="ai-chat-input" placeholder="Nhập câu hỏi…" rows="1"></textarea>
        <button id="ai-chat-send" type="button">Gửi</button>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    launcher.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) document.getElementById("ai-chat-input").focus();
    });
    panel.querySelector(".chat-close").addEventListener("click", () => panel.classList.remove("open"));

    const suggestWrap = document.getElementById("ai-chat-suggest");
    const suggestions = window.CAREERQR_AI_SUGGESTIONS || [
      "Em thích Toán và công nghệ, nên tìm hiểu ngành nào?",
      "Tổ hợp A01 phù hợp với những ngành nào?",
      "Làm sao chọn giữa 2 ngành em đang phân vân?"
    ];
    suggestions.forEach(text => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", () => {
        document.getElementById("ai-chat-input").value = text;
        sendMessage();
      });
      suggestWrap.appendChild(b);
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

    appendMessage(text, "user");
    conversationHistory.push({ role: "user", content: text });
    input.value = "";
    sendBtn.disabled = true;

    const typingEl = appendMessage("Đang trả lời…", "bot typing");

    try {
      const reply = await careerAIChat(conversationHistory);
      typingEl.remove();
      appendMessage(reply, "bot");
      conversationHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      typingEl.remove();
      appendMessage("Xin lỗi, trợ lý đang gặp sự cố khi kết nối (" + err.message + "). Em thử lại sau ít phút, hoặc hỏi trực tiếp giáo viên tư vấn nhé.", "error");
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
