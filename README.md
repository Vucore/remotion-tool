# Khung — Ghép ảnh thành video

Web editor tiếng Việt chạy cục bộ, dùng React và Remotion. Thư viện ảnh, dải cảnh kéo thả, thêm chữ, chỉnh bố cục/màu, chuyển động nhẹ, chuyển cảnh và xuất MP4.

v0.5: **nhân vật/vật thể PNG, bộ phận và sprite; xem thử từng động tác trước khi dùng**. Đặt vị trí, đổi kích thước và chọn chuyển động riêng cho từng ảnh ở bảng dưới timeline; sao chép để dùng lại cho nhiều cảnh. Tự thêm theo mẫu là tuỳ chọn. Mẫu dựng có form và nút lưu/mở, JSON thu gọn. [Cách chuẩn bị asset, xem thử và sử dụng](docs/NHAN-VAT-VA-VAT-THE.md).

v0.4: **ảnh + nhiều WAV + một TXT đánh số → tự ghép cảnh, căn phụ đề từng câu và xuất video có voice**. [Cài bằng uv và hướng dẫn sử dụng](docs/VOICE-VA-PHU-DE.md), [config voice mẫu](docs/examples/voice-edit.config.json), [TXT mẫu](docs/examples/script.txt).

v0.3: **bộ ảnh + config → tự dựng và xuất MP4** trên web hoặc CLI/hàng đợi. Editor có chỉnh nhanh ngay trên dải cảnh; bảng nâng cao chỉ mở khi cần. [Hướng dẫn tự động hoá](docs/TU-DONG-HOA.md), [config mẫu](docs/examples/auto-edit.example.json).

v0.2 bổ sung đủ 81 factory trong `@remotion/effects` 4.0.537, stack và automation, chữ nâng cao/font riêng, lớp phủ, mặt nạ và keyframe ảnh. Xem [danh mục đã tích hợp](docs/DANH-MUC-CHU-HIEU-UNG.md) và [giới hạn GPU](docs/KIEM-TRA.md).

Chỉ hai tỷ lệ: **9:16 dọc** và **16:9 ngang**.

```sh
npm install
# Cài môi trường căn voice một lần bằng uv và tải model small:
npm run setup:voice
npm run dev
```

Mở **http://127.0.0.1:3210**. Dừng bằng `Ctrl+C`.

Xem [hướng dẫn sử dụng](docs/HUONG-DAN.md), [kế hoạch thực hiện](docs/KE-HOACH.md) và [toàn bộ tài liệu](docs/README.md).

```sh
npm run lint   # ESLint và TypeScript
npm test       # Kiểm tra model, thời gian và dữ liệu
npm run build  # Build giao diện
npm start      # Chạy bản build
npm run auto -- --config /duong-dan/auto-edit.config.json # Tự dựng và xuất
npm run auto -- --batch /duong-dan/jobs.json --resume   # Chạy hàng loạt
```

Khi server đang chạy, `node scripts/smoke.mjs` kiểm tra API, nhập ảnh, xuất video thực tế và huỷ tác vụ. Script này tạo file kiểm tra trong `data/` và `test-results/` (không đưa vào Git).

Ảnh/WAV/asset nhập và video xuất lưu trong `data/`. Công cụ dành cho **ảnh tĩnh thành video**, có nhân vật/vật thể, voice WAV và phụ đề theo TXT; chưa có video nguồn hay GPT. Chỉ dựng ảnh và asset không có voice thì không cần cài Python/model. Phần asset không thêm thư viện mới. v0.5 chỉ cập nhật code và tài liệu theo yêu cầu; chưa chạy kiểm tra, cài môi trường, server hoặc render.
