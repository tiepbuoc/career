# CAREER QR

Công cụ tra cứu hướng nghiệp cho học sinh THPT: khám phá bản thân, tra cứu ngành / trường / tổ hợp xét tuyển, so sánh lựa chọn và lập kế hoạch nghề nghiệp (Career Roadmap). Có trợ lý AI hỗ trợ tư vấn.

Trang web thuần HTML/CSS/JS (không cần build), dữ liệu ngành/trường/tổ hợp lưu trên **Firestore**, dữ liệu cá nhân của học sinh (khám phá bản thân, so sánh, kế hoạch) lưu trên **trình duyệt của các em** (localStorage) — vì công cụ không có đăng nhập.

## Cấu trúc thư mục

```
career-qr/
├── index.html                 Trang chủ
├── kham-pha-ban-than.html     Bước 1 — khám phá bản thân
├── tra-cuu-nganh.html         Bước 2 — tra cứu ngành (đọc Firestore)
├── tra-cuu-truong.html        Bước 3 — tra cứu trường (đọc Firestore)
├── to-hop.html                Bước 4 — tra cứu tổ hợp (đọc Firestore)
├── so-sanh.html                Bước 5 — so sánh tối đa 3 phương án
├── ke-hoach.html               Bước 6 — Career Roadmap
├── admin.html                  Trang quản trị dữ liệu (KHÔNG chia sẻ công khai)
└── assets/
    ├── css/style.css           Hệ thống thiết kế dùng chung
    ├── css/ai-chat.css         Giao diện khung chat trợ lý AI
    ├── js/firebase-config.js   Cấu hình kết nối Firestore
    ├── js/app.js                Tiện ích dùng chung + localStorage
    └── js/ai-chat.js            Trợ lý AI (theo mẫu chatbot bạn gửi)
```

## 1. Đưa lên GitHub Pages

1. Tạo repo mới trên GitHub (ví dụ `career-qr`), đẩy toàn bộ thư mục `career-qr/` lên (thư mục gốc của repo chính là các file `index.html`, `assets/`…).
2. Vào **Settings → Pages**, chọn nhánh `main`, thư mục `/ (root)`, bấm Save.
3. Sau 1–2 phút, trang sẽ có địa chỉ dạng `https://<ten-tai-khoan>.github.io/career-qr/`.
4. Tạo mã QR trỏ tới địa chỉ đó (dùng bất kỳ công cụ tạo QR miễn phí nào) để học sinh quét.

## 2. Firestore — nạp dữ liệu ngành / trường / tổ hợp

Dự án đã được nối sẵn với Firebase project **career-1733f** (file `assets/js/firebase-config.js`).

**Bước bắt buộc trước khi dùng thật:** vào [Firebase Console](https://console.firebase.google.com/) → chọn project `career-1733f` → **Firestore Database** → **Rules**, đặt quyền đọc công khai, còn quyền ghi thì hạn chế lại (xem mục "Bảo mật dữ liệu" bên dưới). Nếu Firestore chưa được bật, bấm **Create database** trước.

Có 2 cách nạp dữ liệu:

**Cách nhanh — dùng trang quản trị:**
Mở `admin.html` trên trang web đã deploy, nhập mã quản trị (mặc định `careerqr2026`, nhớ đổi trong file trước khi dùng thật), bấm **Nạp dữ liệu mẫu** để có ngay vài dòng ví dụ, sau đó dùng form để sửa/thêm dữ liệu thật.

**Cách thủ công — nhập trực tiếp trong Firebase Console:**
Vào Firestore Database → Start collection, tạo 3 collection: `nganh`, `truong`, `tohop`, với các trường (field) như bảng dưới.

### Collection `nganh`
| Trường | Ví dụ |
|---|---|
| `ma_nganh` | 7480201 |
| `ten_nganh` | Công nghệ thông tin |
| `nhom_nganh` | Công nghệ |
| `mo_ta` | Thiết kế, xây dựng và vận hành phần mềm… |
| `nang_luc` | Tư duy logic, giải quyết vấn đề |
| `so_thich` | Công nghệ, lập trình |
| `mon_hoc` | Toán, Tin học |
| `vi_tri_viec_lam` | Lập trình viên, kỹ sư phần mềm |
| `to_hop` | A00, A01, D01 |
| `lien_ket` | https://… (không bắt buộc) |

### Collection `truong`
| Trường | Ví dụ |
|---|---|
| `ten_truong` | Trường Đại học A |
| `tinh_thanh` | Hà Nội |
| `loai_truong` | Công lập |
| `ten_nganh` | Công nghệ thông tin |
| `ma_nganh` | 7480201 |
| `to_hop` | A00, A01, D01 |
| `phuong_thuc` | Điểm thi THPT, ĐGNL |
| `diem_tk` | 24.5 (điểm tham khảo năm gần nhất) |
| `hoc_phi_tk` | 15 triệu/năm |
| `website` | https://tuyensinh.truonga.edu.vn |
| `nam_cap_nhat` | 2026 |

### Collection `tohop`
| Trường | Ví dụ |
|---|---|
| `ma_to_hop` | A00 |
| `cac_mon` | Toán – Vật lí – Hóa học |
| `nhom_nganh` | Kỹ thuật, công nghệ, kinh tế |

> Ghi rõ năm cập nhật và luôn nhắc học sinh kiểm tra lại thông tin điểm chuẩn/học phí trên website chính thức của trường — dữ liệu tuyển sinh thay đổi theo từng năm.

## 3. Trợ lý AI

`assets/js/ai-chat.js` gọi API theo đúng cấu trúc trong file `chatbot.html` mẫu bạn gửi (endpoint dạng `/v1/chat/completions`, giữ lịch sử hội thoại, model `gpt-4o-mini`). Key hiện tại là **key demo giống hệt file mẫu** — dùng để chạy thử ngay, không cần cấu hình gì thêm.

**Trước khi dùng chính thức**, đổi 3 giá trị ở đầu file `assets/js/ai-chat.js`:
```js
const AI_CONFIG = {
  API_KEY: "...",          // đổi thành key thật của bạn
  API_ENDPOINT: "...",     // endpoint dịch vụ AI bạn dùng
  MODEL: "gpt-4o-mini"     // model bạn muốn dùng
};
```

⚠️ **Vì sao không nên để key thật ở đây lâu dài:** đây là code JS chạy trên trình duyệt người dùng, ai mở "View source" trên trang GitHub Pages cũng đọc được key. Cách an toàn hơn khi dự án phát triển lớn hơn: viết một **Firebase Cloud Function** nhỏ giữ key ở phía máy chủ, cho trang web gọi vào function đó thay vì gọi thẳng nhà cung cấp AI. Với quy mô dùng nội bộ trường/lớp, việc dùng key demo/dùng chung có giới hạn chi tiêu là lựa chọn đơn giản và chấp nhận được.

## 4. Bảo mật dữ liệu (Firestore Rules)

Vì trang không có đăng nhập, cách đơn giản và đủ dùng cho một công cụ tra cứu công khai:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false; // chỉ sửa dữ liệu qua Firebase Console hoặc admin.html khi cần
    }
  }
}
```

Với quy tắc này, `admin.html` sẽ **không ghi được** dữ liệu nữa — bạn quản trị dữ liệu trực tiếp trong Firebase Console. Nếu muốn tiếp tục dùng `admin.html` để ghi dữ liệu, bạn cần thêm Firebase Authentication (đăng nhập bằng email) và đổi rule `allow write` thành `if request.auth != null`. Đây là bước nên làm nếu nhiều người cùng quản trị dữ liệu — có thể nhờ hỗ trợ thêm khi cần.

## 5. Kiểm tra trước khi phát hành (dựa theo checklist gốc của bạn)

- [ ] Mã QR quét được bằng cả Android và iPhone
- [ ] Trang mở được, không cần đăng nhập
- [ ] Các nút bấm hoạt động đúng (lọc, lưu, so sánh…)
- [ ] Dữ liệu ngành/trường/tổ hợp hiển thị được trên điện thoại
- [ ] Liên kết website các trường hoạt động
- [ ] Có ghi năm cập nhật dữ liệu tuyển sinh
- [ ] Có lưu ý "thông tin tham khảo" ở các trang liên quan
- [ ] Không thu thập/lưu dữ liệu cá nhân học sinh lên máy chủ chung (chỉ lưu trên máy các em)
- [ ] Thời gian tải trang hợp lý trên mạng di động
- [ ] `admin.html` đã đổi mã quản trị mặc định, và đã cân nhắc mục 4 (Bảo mật dữ liệu)

## 6. Những phần học sinh lưu trên máy (localStorage), không lên Firestore

- Kết quả "Khám phá bản thân"
- Danh sách ngành đã lưu để so sánh
- Bảng chấm điểm so sánh phương án
- Career Roadmap (kế hoạch nghề nghiệp)

Nếu học sinh đổi trình duyệt/thiết bị, các dữ liệu này sẽ không tự đồng bộ — đây là đánh đổi hợp lý để không phải làm hệ thống đăng nhập cho một công cụ tra cứu công khai.
