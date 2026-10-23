# Dọn tệp cũ và chuẩn bị bộ mẫu

Theo yêu cầu hiện tại, thay các demo cũ bằng bộ đầu vào nhỏ để người dùng tự thử ba ô ảnh/WAV/TXT.

## Bộ mẫu

- `test/images/`: đúng ba PNG hoạt hình 720×1280.
- `test/voices/`: đúng ba WAV tiếng Việt PCM 16-bit/mono/24 kHz, đọc đúng ba mục trong `test/script.txt`.
- Voice dài 10,99 / 11,50 / 13,19 giây, tổng 35,68 giây.
- `test/README.md` hướng dẫn chọn từng loại qua ba ô, không upload thư mục gộp.

Đã kiểm tra header ảnh, format WAV/có tín hiệu và bộ ghép số cho ba cặp. Không chạy model alignment, server hoặc render video trong lượt này. Giọng Linh dùng từ macOS, không thêm thư viện vào dự án.

## Đã xoá

- Hai bộ video/asset tuổi thơ cũ trong `output/`, gồm sprite frame, zip, project demo, MP4 và ảnh kiểm tra.
- `scripts/demos/` vì không được công cụ hay lệnh npm hiện tại gọi.
- Hai bundle render cũ `.cache/remotion-29229`, `.cache/remotion-30748`; renderer tự tạo lại bundle khi cần.
- Tài liệu đề xuất/kế hoạch cũ, hai tài liệu demo video và ảnh chụp editor đã thay thế. Cập nhật mục lục và các hướng dẫn còn dùng để không dẫn đến file đã xoá.
- Các `.DS_Store` trong vùng dọn, ngoài `node_modules`, `.git` và `data`.

Tổng cộng **2.327 tệp, khoảng 420,2 MiB**. Số này tính cả ảnh/frame và bản zip trùng dữ liệu của demo cũ.

## Giữ lại

Mã nguồn/runtime dùng bởi web, CLI và định dạng dự án tương thích; các lệnh npm; `tests/` được dùng bởi `npm test`; sample SVG dùng trong kiểm tra; `dist/` cần cho server; dependencies trong `node_modules`; toàn bộ `data/` chứa tài nguyên người dùng và video đã xuất. Không xoá Python/model/cache căn phụ đề của người dùng.
