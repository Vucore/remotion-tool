# Voice và phụ đề tự động

## Đầu vào

Voice có thể **tải WAV/MP3** hoặc **tạo từ TXT bằng Chatterbox Modal**. Hai cách dùng chung pipeline thời lượng, waveform và phụ đề. TTS có các ngôn ngữ trong tài liệu API (chưa có tiếng Việt); bộ căn local được mở rộng lựa chọn tương ứng. [Tạo và cấu hình TTS](TICH-HOP-TTS.md).

Một cảnh = một ảnh + một voice WAV/MP3 + một mục TXT cùng số. Ví dụ `01.png`, `01.mp3` (hoặc `01.wav`) và mục `1. Nội dung đọc…`. TXT UTF-8 chứa toàn bộ lời đọc, đánh số liên tục từ 1; mỗi mục có thể gồm nhiều câu hoặc nhiều dòng. Tên file có thể kèm mô tả sau số.

Trong web, dùng ba ô **Ảnh bối cảnh**, **Voice (WAV · MP3)**, **Lời đọc TXT**. Có thể chọn lẫn WAV và MP3 trong cùng một lần, ví dụ `01.mp3`, `02.wav`, `03.mp3`. Không tải thư mục chứa cả ba loại. Thay một loại giữ nguyên hai loại còn lại; lỗi ghép được báo trước khi dựng. [Bộ mẫu dùng ngay](../test/README.md).

Mỗi voice tối đa 100 MB và 0,5–300 giây, tối đa 300 file. WAV cần RIFF/WAVE PCM 8/16/24/32-bit hoặc float 32/64-bit, mono/stereo, 8–192 kHz. MP3 nhận CBR/VBR mono/stereo. Có voice thì bắt buộc có TXT tương ứng, kể cả khi tắt hiển thị phụ đề. Hai file WAV/MP3 trùng số cảnh vẫn bị báo trùng.

**Cả hai định dạng được giữ nguyên để preview/xuất.** MP3 chỉ được giải mã thành bản phân tích tạm cho waveform và WAV tạm cho aligner; không thay nguồn MP3 bằng WAV. Không đổi âm lượng, tốc độ, số kênh hoặc sample rate của bản phân tích. MP4 xuất mã hóa AAC 320 kbps (cao) / 192 kbps (tiêu chuẩn). [Chi tiết chất lượng và triển khai](HO-TRO-MP3.md).

## Cài môi trường bằng uv

Chạy một lần trong thư mục dự án:

```sh
npm run setup:voice
```

Script dùng uv tạo `.venv` với Python 3.11, cài thư viện từ `pyproject.toml` bằng `uv sync`, tải model `small` vào `.cache/whisper`. Không sửa Python hệ thống.

Muốn model khác:

```sh
npm run setup:voice -- --model base
```

Sau đó chọn đúng model đã cài tại **Tuỳ chọn thêm và mẫu dùng lại**. Các lựa chọn tiny/base/small/medium, mặc định small và tiếng Việt. Mọi thư viện Python dùng chung `.venv` do uv quản lý.

## Dùng trên web

```sh
npm run dev
```

1. Chọn ba đầu vào riêng. Dải thumbnail hiển thị ảnh, WAV và thời lượng theo số.
2. Preview và timeline ba hàng có ngay sau nhập; nhấn Play để chạy thử cả ảnh/WAV. Cue chưa căn được ghi rõ ước tính. Chọn **Căn phụ đề** để chạy model trước, hoặc **Xuất video** để tự căn và xuất MP4.
3. Theo dõi tiến độ và huỷ nếu cần. Nếu thiếu môi trường/model, lỗi xuất hiện ngay trên giao diện; đầu vào được giữ.

Thời lượng cảnh lấy từ WAV. Chuyển cảnh kéo dài phần hình, không cắt mất lời đọc. Phụ đề chia câu/cụm từ TXT rồi dùng Stable-ts/Whisper tìm mốc trong WAV; không nhận dạng lại để thay text gốc. Kết quả được cache theo âm thanh, text và thiết lập model.

Không có WAV thì vẫn dựng ảnh/TXT được nhưng mốc phụ đề là **ước lượng thời gian đọc**, không phải forced alignment.

## CLI

Cấu hình mẫu: [voice-edit.config.json](examples/voice-edit.config.json). Chỉnh đường dẫn ảnh, voice, TXT và đầu ra theo bộ của bạn; đường dẫn tương đối tính từ file config.

```sh
npm run auto -- --config /duong-dan/voice-edit.config.json --plan
npm run auto -- --config /duong-dan/voice-edit.config.json
```

`--plan` vẫn cần căn voice để tạo timing, nhưng chưa xuất MP4. [CLI và hàng đợi](TU-DONG-HOA.md).

Bộ `test/` đã kiểm tra format WAV và ghép đủ ba cặp; cần người dùng tự kiểm tra chất lượng mốc phụ đề với model thực tế. Không tự cài Python/model trong lượt chuẩn bị bộ mẫu.
