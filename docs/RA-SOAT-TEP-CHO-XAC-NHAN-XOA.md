# Rà soát tệp để xác nhận dọn dẹp

Thời điểm đối chiếu: 12:28:54 25/10/26 (Asia/Ho_Chi_Minh). **Chưa xóa file nào.** Chỉ tạo báo cáo này và CSV; không sửa mã nguồn, dữ liệu dự án hay môi trường.

Đã đọc snapshot + replay journal đầy đủ của mọi dự án trong data/projects, giữ tham chiếu lịch sử tài nguyên, đối chiếu mọi snapshot export và cache TTS. Không gọi worker lưu trữ hoặc server để tránh phát sinh ghi dữ liệu. Danh sách là ảnh chụp tại thời điểm rà soát, không phải lệnh xóa; phải đối chiếu lại trước khi thực hiện, đặc biệt khi đang xuất video. Các bản JSON/sao lưu nằm ngoài thư mục repo chưa được quét.

## Các nhóm có thể xác nhận

| Nhóm | Nội dung | Số file | Dung lượng nội dung | Đánh giá |
|---|---|---:|---:|---|
| A | data/uploads: ảnh/voice nhập cũ không còn tham chiếu | 2697 | 259.59 MiB | Có thể đề xuất dọn; không xóa toàn thư mục uploads |
| B | data/exports: MP4 cũ không có bản ghi tác vụ tương ứng | 3 | 20.10 MiB | Xem lại nếu cần giữ video cũ trước khi xác nhận |
| C | .DS_Store, bytecode Python cũ, cache công cụ thiết kế | 9 | 0.08 MiB | Không phải dữ liệu app |
| D | .cache/proxies và .cache/render-bundles | Theo thư mục | Khoảng 9,3 + 37 MiB trên đĩa | Có thể tái tạo, nhưng vẫn phục vụ app; chỉ dọn khi không có job dùng bundle |
| E | WAV phiên bản cũ + cache TTS tương ứng | 216 | 40.34 MiB | Vẫn thuộc lịch sử/cache; chỉ dọn nếu chủ động bỏ các phiên bản giọng cũ |

A + B + C thu hồi khoảng **279.77 MiB nội dung file**. Dung lượng trên đĩa có thể khác do block, compression, hard link hoặc copy-on-write.

Danh sách đầy đủ từng đường dẫn A/B/C/E: [CSV](DANH-SACH-TEP-CHO-XAC-NHAN-XOA.csv). Có thể mở CSV và lọc cột group. Nhóm D chưa có trong CSV vì là cache tái tạo đang có thể được dùng.

## Chi tiết

- A: 2.651 PNG, 40 JPG, 6 WAV; đều mang tên UUID của luồng upload cũ. Không tìm thấy liên kết từ dự án hiện hành, manifest lịch sử, snapshot export hoặc cache TTS. Không thể từ riêng tên file kết luận chúng từng là test hay dữ liệu người dùng; đây là lý do vẫn chờ xác nhận.
- B:
  - `data/exports/7b17dfa4-b078-4822-a587-4ca2338ab4dc.mp4` — 4.95 MiB
  - `data/exports/ac4d2a2d-1fa4-4466-8d03-87113da7b828.mp4` — 4.95 MiB
  - `data/exports/b995612a-b4bf-4e63-88a1-d86f528203c0.mp4` — 10.20 MiB
- C:
  - `.DS_Store` — 6,148 byte
  - `src/.DS_Store` — 6,148 byte
  - `docs/.DS_Store` — 6,148 byte
  - `test/.DS_Store` — 6,148 byte
  - `data/.DS_Store` — 6,148 byte
  - `data/projects/.DS_Store` — 6,148 byte
  - `.cache/.DS_Store` — 8,196 byte
  - `__pycache__/image_upscaler.cpython-311.pyc` — 27,283 byte
  - `.impeccable/hook.cache.json` — 6,393 byte
- E: 108 WAV cũ (40.33 MiB) và 108 JSON cache. Giữ chúng cho phép dùng lại kết quả TTS khi quay về nội dung/cấu hình trước; không phải media mồ côi.

## Những mục đã kiểm tra và nên giữ

- Dự án hiện tại: **Bajau**, 108 ảnh, 108 voice, 108 cảnh. Có 215 file media duy nhất đang được tham chiếu, khoảng 167.63 MiB; số file ảnh ít hơn số asset do dùng chung nguồn.
- data/projects và data/jobs: metadata hiện ghi một tác vụ rendering và một tác vụ error, cả hai của dự án hiện tại. Cần giữ snapshot/metadata để theo dõi và xuất lại; chưa đưa vào danh sách dọn.
- test/: ba ảnh, ba WAV, một TXT và README khoảng 2,07 MiB. Bộ test của TTS, voice input, xử lý ảnh và server đang đọc trực tiếp các file mẫu. Không xem là thư mục demo bỏ hoang.
- tests/: 17 file, 143.139 byte nội dung; đều là kiểm tra dự án qua npm test. Không phải output video.
- scripts/smoke.mjs: 3.264 byte, kiểm tra API/render thủ công, không chạy trong npm test hoặc app. Có thể bỏ nếu không muốn giữ kiểm tra thủ công, nhưng vẫn liên quan dự án.
- src/: 72 file TS/TSX đều nằm trong đồ thị build đã đối chiếu (web, worker, Remotion và các entrypoint Node). Chưa thấy file nguồn tách rời để đề xuất xóa. Đây là kiểm tra tham chiếu file, không khẳng định mọi hàm/CSS đều đang dùng.
- public/samples/: ảnh fallback và demo animation còn dùng trong code/test.
- docs/images/: khoảng 1,7 MiB ảnh minh chứng/tài liệu; không phải runtime nhưng còn liên quan lịch sử tính năng. Có thể tinh giản tài liệu riêng nếu muốn, chưa tự phân loại là rác.
- dist/: khoảng 23 MiB, build lại được nhưng npm start và backend đang dùng; chỉ dọn nếu sẽ npm run build lại trước khi chạy.
- node_modules/ và .venv/: khoảng 1,1 GiB mỗi thư mục; là thư viện chạy app/Python dùng chung uv.
- .cache/whisper/: khoảng 461 MiB; .cache/models/: khoảng 262 MiB — model căn phụ đề/xử lý ảnh đang dùng.
- .cache/tts và .cache/alignment: cache giúp tránh gọi API/chạy model lại; không xếp toàn bộ vào nhóm không liên quan.
- .git/: khoảng 703 MiB lịch sử Git; có nhánh backup/main-before-model-cleanup-2d26521. Không xóa .git; muốn tối ưu lịch sử/backup là tác vụ riêng.

## Xác nhận

Có thể trả lời theo mã nhóm, ví dụ “Xóa A và C”, hoặc “Xóa A, B, C; giữ các giọng cũ E”. Sau khi xác nhận cần rà soát lại tham chiếu hiện tại rồi chỉ thao tác trên danh sách đã duyệt.
