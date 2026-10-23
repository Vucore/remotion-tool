# Khung — Dựng video kể chuyện bằng Remotion

**v0.8**: không gian editor với preview ở giữa và timeline **Ảnh · Voice · Phụ đề** phía dưới. Có mốc thời gian, waveform thật, playhead, chạy thử và zoom timeline. Ba ô nhập riêng cho ảnh, WAV và một TXT đánh số.

Chọn đầu vào là có thể chạy thử ngay. Bốn tab thiết lập nhanh cập nhật preview trực tiếp: **Chuyển động · Chuyển cảnh · Lớp phủ · Phụ đề**. Đủ danh mục hiện có trong engine: 20 loại lớp phủ (tối đa 8 lớp), 38 chuyển cảnh, 33 lựa chọn chuyển động ảnh; kiểu/cỡ/màu/font/vị trí/animation phụ đề. Chỉ **9:16 và 16:9**.

**v0.8** thêm 14 kiểu chữ, 29 lựa chọn animation vào/ra, 12 lựa chọn lặp; tâm zoom, đường đi/keyframe, tốc độ/easing và kiểu chữ nâng cao. Chọn phạm vi toàn video hoặc từng cảnh. Ô tính năng có demo minh họa A/B khi rê chuột/focus, không lấy ảnh dự án. Kéo thanh phân cách để đổi kích thước các vùng; bố cục được lưu tự động. [Hướng dẫn](docs/HUONG-DAN.md), [phạm vi triển khai](docs/MO-RONG-THIET-LAP-VA-LAYOUT.md).

Voice hỗ trợ **WAV và MP3**, có thể nhập chung; giữ nguyên nguồn cho preview/xuất, chỉ giải mã MP3 tạm khi phân tích/căn phụ đề. Ghép ảnh–voice–TXT theo số như trước. [Định dạng và chất lượng âm thanh](docs/HO-TRO-MP3.md).

**Tạo voice từ TXT**: ngoài tải voice sẵn, có thể chọn Chatterbox TTS (Modal), Turbo/Multilingual, giọng preset/giọng mẫu và WAV/MP3. Xuất video tự gọi TTS từng cảnh, dùng lại audio đã tạo rồi căn phụ đề và render. Cấu hình nâng cao thu gọn; API hiện không hỗ trợ tiếng Việt. [Cách thiết lập và sử dụng](docs/TICH-HOP-TTS.md).

**Xuất video** tự ghép số, căn voice/phụ đề và xuất MP4. Khi chưa căn, preview ghi rõ **Phụ đề ước tính**; có thể bấm Căn phụ đề trước khi xuất. Mẫu dùng lại lưu/mở bằng nút, không cần viết JSON.

**SRT**: xuất kèm MP4 hoặc tải riêng; nhập SRT có sẵn, dịch qua Google Translate miễn phí qua deep-translator và xuất bản dịch/song ngữ giữ thời gian. Tên file có mã + tên ngôn ngữ (`en_tienganh.srt`). Sidebar thu gọn, cấu hình giọng/lời đọc/nhân vật/SRT mở dialog. Không tải thêm model dịch local. [Hướng dẫn](docs/PHU-DE-SRT-VA-GIAO-DIEN.md), [dung lượng thực tế](docs/DUNG-LUONG-SRT.md).

```sh
npm install
npm run dev
# Cài một lần nếu cần căn phụ đề thật theo WAV, dùng uv:
npm run setup:voice
```

Mở `http://127.0.0.1:3210`. Dừng bằng Ctrl+C. Không cần Python cho preview tạm hoặc chỉ dựng ảnh/chữ; căn voice thực tế cần môi trường/model.

Bộ minh hoạ sẵn tại [`test/`](test/README.md): ba PNG, ba WAV tiếng Việt và một TXT, khoảng 36 giây. Ảnh 01 ghép WAV 01 và mục TXT 1. Không upload cả thư mục; chọn từng loại qua ba ô tương ứng.

```sh
npm run build
npm start
npm run auto -- --config /duong-dan/auto-edit.config.json
npm run auto -- --batch /duong-dan/jobs.json --resume
```

Tài nguyên/video xuất nằm trong `data/`; giữ thư mục này để mở lại dự án. Runtime/CLI vẫn đọc dự án cũ. Các bộ demo cũ đã dọn; `tests/` là kiểm tra mã nguồn, khác với dữ liệu `test/`.

[Hướng dẫn](docs/HUONG-DAN.md) · [Thiết kế workspace](docs/THIET-KE.md) · [Kế hoạch triển khai](docs/KHONG-GIAN-DUNG-VIDEO.md) · [Cài voice bằng uv](docs/VOICE-VA-PHU-DE.md) · [Tài liệu](docs/README.md)

**Xử lý ảnh hàng loạt**: LaMa xóa vùng logo chọn bằng chuột + Real-ESRGAN upscale 2×/4×, xem trước/sau, cấu hình tự chạy ảnh mới và khôi phục nguồn. Dùng chung `.venv`; cần `uv sync` và tải trọng số upscale nếu dùng. [Hướng dẫn](docs/XU-LY-ANH-HANG-LOAT.md).
