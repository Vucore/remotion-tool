# VieNeu-TTS v3 Turbo

## Phạm vi

Thêm VieNeu bên cạnh Chatterbox trong **Lời đọc & giọng → Thiết lập TTS**. Dự án cũ thiếu `provider` vẫn dùng Chatterbox; giữ tương thích model, tham số, URL và cache cũ. Nguồn **Dùng WAV / MP3** hoạt động như trước. Không cài model VieNeu, Python hay Modal SDK trên Mac.

Luồng chung: ảnh/TXT đánh số → phân vai → tạo/cập nhật voice → đo duration/waveform → ghép đúng cảnh → căn câu Whisper nếu cần → preview/xuất MP4/SRT. VieNeu dùng ngôn ngữ căn phụ đề `vi`; Chatterbox Turbo vẫn `en`, Multilingual theo lựa chọn cũ. Đổi hiệu ứng không tạo voice lại.

## Cấu hình backend

Tạo `.env` ở gốc dự án, hoặc thêm vào `.env` đang có. Có mẫu `.env.example`; không ghi đè cấu hình riêng hiện tại.

```dotenv
VIENEU_BASE_URL=https://emsimv10--vieneu-tts-v3-turbo-api-api.us-east.modal.run
VIENEU_API_KEY=thay_bang_key_cua_ban
```

Khởi động lại với `npm run dev` hoặc `npm run build` rồi `npm start`. Backend Node đọc `.env`; biến đã đặt trong môi trường có ưu tiên hơn file. Riêng TTS cloud không cần thêm thư viện vào uv; Whisper tiếp tục dùng `.venv` uv hiện có.

Key chỉ nằm ở backend, không được lưu trong workspace, JSON dự án, frontend hoặc cache. `.env` đã được Git ignore. Không thêm key vào URL/TXT và không commit file chứa key.

URL VieNeu lưu riêng trong `tts.vieneu.baseUrl`, không thay URL Chatterbox. Backend chỉ gửi Bearer tới đúng `VIENEU_BASE_URL`, từ chối URL khác kể cả một miền Modal khác. Khi đổi endpoint hoặc chuyển máy: sửa `.env`, khởi động lại, vào **Kết nối API → Kiểm tra cấu hình backend → Dùng URL server**. Nút kiểm tra chỉ đọc cấu hình local, không gọi GPU và không xác nhận key hợp lệ trên cloud.

## Cách dùng

1. Nhập ảnh/TXT như trước. Mở **Lời đọc & giọng**, chọn **Tạo giọng từ lời đọc**.
2. Trong **Thiết lập TTS**, chọn **VieNeu v3 Turbo · Tiếng Việt**, rồi WAV hoặc MP3. Các tham số Chatterbox được giữ nhưng không gửi cho VieNeu.
3. Trong **Người nói → Thiết lập giọng**, chọn preset và bấm **Tải danh sách giọng**. Chọn từ kết quả API hoặc nhập ID chính xác; để trống dùng `Hải Đăng` theo tài liệu. Danh sách chỉ tải khi bấm, không đoán 25 tên giọng. Tên preset Chatterbox không dùng chung với VieNeu, cần chọn lại khi đổi dịch vụ.
4. Nếu clone: chọn WAV/MP3 **3–8 giây, tối đa 10 MiB**, rõ tiếng; tùy chọn **Lọc nhiễu giọng mẫu** mặc định bật. Editor giữ đầu vào WAV/MP3 để dùng chung luồng nhập/phân tích hiện có.
5. Gán giọng cho lượt/cảnh/chọn tất cả như trước. Mỗi lượt tối đa **2.000 ký tự**; dùng **Tách lượt** cho đoạn dài. Giới hạn và các file clone được kiểm tra trước khi bắt đầu gọi cloud.
6. Bấm **Tạo / cập nhật voice** hoặc **Xuất video**. Dùng lại cache từng lượt, tạo phần còn thiếu, ghép theo thứ tự hiện có. Không thêm một luồng preview kết quả từng phần khác.

## Giao thức và chất lượng

- Preset: POST JSON `/v1/audio/speech`, `model=vieneu-v3-turbo`, `input`, `voice`, `response_format=wav`. Chỉ theo chuyển hướng kết quả trong cùng origin, không chuyển Bearer sang nơi khác.
- Clone: mỗi lượt POST multipart `/v1/audio/clone/file?background=true` với `ref_audio`, `text_file`, `mode=single`, `response_format=wav`, `denoise`; nhận 202, poll pending/completed/failed rồi tải `/v1/audio/jobs/{id}/result`. Không tự gọi `/readyz`.
- Một tác vụ nền cho mỗi lượt giữ cache/phân vai/ghép cảnh hiện có; không nhập ZIP hoặc gom cả kịch bản vào một batch. Giới hạn 50 đoạn/10.000 ký tự của một batch không trở thành giới hạn tổng dự án: mỗi request chỉ một lượt, tối đa 2.000 ký tự.
- WAV giữ nguyên bytes API; tài liệu công bố PCM16 mono 48 kHz. MP3 dùng FFmpeg đi kèm Remotion mã hoá WAV một lần ở 320 kbps, không chủ động resample, đổi tốc độ hoặc lọc âm lượng. Nhiều người nói vẫn ghép WAV trung gian rồi mới mã hoá MP3 như cũ. MP3 nén mất dữ liệu; chọn WAV để giữ đầu ra API.
- Timeout tối đa 15 phút/lượt, danh sách giọng 30 giây, kết quả tối đa 64 MiB; tiếp tục kiểm tra audio/thời lượng hiện có (tối đa 300 giây/cảnh). Không tự retry POST tạo giọng; polling chỉ kiểm tra tiến độ.
- **Dừng** hủy tác vụ/kết nối local. API không có endpoint hủy job cloud; job đã nhận có thể tiếp tục và kết quả được giữ tối đa 7 ngày theo tài liệu. Không tự nối lại job cloud sau khi tắt server; tạo lại có thể phát sinh job mới cho lượt chưa cache.

Cache SHA-256 theo endpoint, model/tham số có tác dụng, text và bytes giọng mẫu, không chứa key. Audio ở `data/uploads/`, chỉ mục ở `.cache/tts/`, thiết lập trong workspace dự án. Đổi key không làm mất cache. Quản lý dung lượng hiện có tiếp tục thống kê/dọn các nhóm này.

## Mã nguồn và xác minh

Adapter `scripts/vieneu.mjs` đi qua `scripts/tts.mjs`. Backend thêm GET `/api/tts/vieneu/config` và POST `/api/tts/vieneu/voices`; giữ các route tạo voice/upload/căn phụ đề/xuất hiện có. Schema/provider/ngôn ngữ trong `src/auto/tts.ts`; UI dùng `TtsPanel`, `TtsPresetVoice`, `NarrationPanel`.

Theo yêu cầu người dùng: không dựng mock, chạy bộ test, gọi GPU/API thật hoặc tải model/thư viện. Chỉ build và lint/TypeScript kiểm tra mã. Chưa xác nhận key, định dạng danh sách giọng hoặc chất lượng audio của deployment thực tế. Dựa trên tài liệu API người dùng cung cấp ngày 28/10/2026.
