/* =========================================================
   CAREER QR — Cấu hình Firebase (dùng chung cho mọi trang)
   Dự án Firebase: career-1733f
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyApwygCFGIMe58o8aZvSl5ZEAKpUJ930KE",
  authDomain: "career-1733f.firebaseapp.com",
  projectId: "career-1733f",
  storageBucket: "career-1733f.firebasestorage.app",
  messagingSenderId: "544873924713",
  appId: "1:544873924713:web:02dc4f65a3867c0f0f7af8",
  measurementId: "G-E3B1KQZN5Q"
};

// Dùng Firebase SDK bản "compat" (nạp qua thẻ <script> ở mỗi trang HTML)
// nên không cần build/bundler — phù hợp để deploy thẳng lên GitHub Pages.
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Tên các collection trong Firestore — đổi ở đây nếu bạn đặt tên khác.
const COL = {
  NGANH: "nganh",
  TRUONG: "truong",
  TOHOP: "tohop"
};
