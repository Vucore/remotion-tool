# Tạo voice từ TXT bằng Chatterbox

## Kế hoạch triển khai

- Giữ hai nguồn voice: tải WAV/MP3 hoặc tạo từ TXT. Ảnh/TXT vẫn nhập riêng và ghép theo số.
- Thêm thiết lập Chatterbox: URL Modal, Turbo/Multilingual, ngôn ngữ, WAV/MP3, preset hoặc giọng mẫu; tham số nâng cao thu gọn.
- Backend gọi `/api/cli` ở chế độ `single` cho từng mục TXT theo thứ tự, nhận audio trực tiếp. Không cần giải nén ZIP, không đọc số mục thành tiếng.
- Tạo tác vụ có tiến độ/hủy, timeout, kiểm tra audio và cache từng cảnh. Không tự lặp request lỗi để tránh sinh thêm chi phí.
- Gắn voice đã tạo vào Project; tiếp tục dùng luồng duration/waveform/căn câu/xuất MP4 hiện có. Đổi TXT/tham số phải cập nhật voice; đổi hiệu ứng không sinh voice lại.
- Mở rộng ngôn ngữ căn phụ đề để bao phủ 23 ngôn ngữ trong tài liệu; giữ tiếng Việt cho voice tải lên. Không tự thêm tiếng Việt vào TTS.
- Kiểm tra bằng API giả lập và các kiểm tra mã nguồn cần thiết; không gọi GPU thật hoặc cài thêm môi trường/model trong quá trình code.

## Cách dùng

1. Nhập bộ ảnh và một TXT UTF-8 đánh số `1.`, `2.`, `3.`… như hiện tại. Tên ảnh phải có số tương ứng.
2. Tại **Voice**, chọn **Tạo từ TXT**. **Tải voice** vẫn nhận nhiều WAV/MP3 như cũ; hai nguồn dùng chung luồng dựng.
   Bấm ô **Chatterbox TTS** để mở dialog cấu hình; sidebar chỉ hiện tóm tắt model/định dạng/trạng thái.
3. Chọn **Turbo** cho tiếng Anh, hoặc **Multilingual** và ngôn ngữ lời đọc. Không có tiếng Việt trong API TTS được cung cấp.
4. Chọn **Preset** rồi nhập tên giọng đã có trên server, hoặc **Giọng mẫu** và chọn một WAV/MP3 (tối đa 25 MB, khuyến nghị 5–15 giây rõ tiếng). Để trống preset sẽ để server chọn mặc định; server phải có giọng mặc định. Tài liệu không cung cấp endpoint liệt kê giọng nên công cụ không tự đoán danh sách preset.
5. Chọn **WAV** hoặc **MP3**. Nút **Tạo voice / Cập nhật voice** tạo audio để nghe thử; không cần cài Whisper cho riêng bước này.
6. Có thể bỏ bước 5 và bấm thẳng **Xuất video**. Công cụ tự tạo voice còn thiếu, căn phụ đề bằng bộ local đã cài, rồi render. Nếu chưa cài bộ căn, voice đã tạo vẫn được giữ để nghe/tải và tiếp tục sau.

**Thông số giọng đọc** thu gọn mặc định, gồm:

| Chung | Riêng Turbo | Riêng Multilingual |
| --- | --- | --- |
| temperature, repetition_penalty, top_p, seed | top_k, norm_loudness | language_id, exaggeration, cfg_weight, min_p |

**Kết nối API** chứa URL ứng dụng Modal; mặc định `https://emsimv10--chatterbox-multi-tts-web.modal.run`. Chấp nhận URL gốc hoặc URL kết thúc `/api/cli`, dùng HTTPS trên miền `*.modal.run`. Không cần API key theo tài liệu hiện tại. Nếu server bổ sung xác thực, cần mở rộng cấu hình theo cơ chế mới.

Các thiết lập TTS được lưu cùng workspace/mẫu dựng; dự án đã tạo voice cũng giữ thiết lập và dấu nhận diện bộ lời đọc. Mẫu chỉ giữ đường dẫn giọng mẫu trong `data/`, không nhúng audio. Khi chuyển máy phải giữ tài nguyên hoặc chọn lại file mẫu.

## Luồng xử lý

```text
Ảnh + TXT + thiết lập TTS
  → kiểm tra đủ số cảnh
  → /api/tts (tác vụ local)
  → POST Modal /api/cli, mode=single cho từng mục, bỏ số mục
  → kiểm tra audio trả về, lưu WAV/MP3 nguyên byte
  → gắn voice theo 01, 02, 03… và tính waveform/thời lượng
  → căn câu bằng Stable-ts/Whisper local
  → preview / xuất MP4 bằng Remotion
```

- Gửi nội dung từng mục và giọng mẫu (nếu chọn) đến Modal. Không tải model Chatterbox về Mac.
- Không dùng ZIP/multi; gửi lần lượt để giữ thứ tự, báo tiến độ rõ và dùng lại từng mục khi lỗi. Các đoạn giống nhau có thể dùng chung audio cache nhưng có ID/cảnh riêng.
- Cache SHA-256 theo nội dung, tham số thực sự được gửi, URL và bytes giọng mẫu. Đổi hiệu ứng/chuyển cảnh/font không tạo voice mới. Đổi một mục TXT chỉ gọi lại mục đó; mục đã có được dùng lại.
- Cache ở `.cache/tts/`; audio tạo ra ở `data/uploads/`. Không xóa `data/` nếu muốn mở lại dự án.
- Nút **Dừng** hủy tác vụ local và kết nối đang chờ. Công việc GPU đã được máy chủ tiếp nhận có thể vẫn chạy; API chưa có endpoint hủy phía Modal. Các mục hoàn tất vẫn được cache để dùng khi thử lại.
- Chờ tối đa 10 phút mỗi request, bao gồm cold start. Không tự retry request lỗi. Khi lỗi, hiện mục bị lỗi và thông tin HTTP để người dùng sửa/thử lại.
- Có thể nghe từng cảnh và tải WAV/MP3 tại **Nghe và tải voice**. Nút xuất vẫn tạo MP4 H.264/AAC, không đổi định dạng video sang audio.
- Các thẻ Turbo `[laugh]`, `[chuckle]`, `[sigh]`, `[gasp]`, `[cough]` gửi nguyên cho TTS; loại khỏi chữ hiển thị/căn câu. Không tự sinh chỉ dẫn cảm xúc từ nội dung.

## Phụ đề và ngôn ngữ

Ngôn ngữ căn phụ đề tự lấy từ model/ngôn ngữ TTS để không dùng nhầm tiếng Việt cho voice tiếng khác. Menu căn phụ đề và Python nhận đủ 23 mã TTS cùng `vi` cho voice tải lên. Turbo luôn dùng `en`; Multilingual theo lựa chọn người dùng. Không tự phát hiện hoặc dịch TXT, không hỗ trợ nhiều ngôn ngữ khác nhau cho từng cảnh trong một lượt.

Tạo voice là bước cloud; căn phụ đề vẫn là bước local cần `npm run setup:voice` (uv) một lần. Model Whisper `small` mặc định, CPU như trước. API TTS không trả timestamp phụ đề nên vẫn cần đối chiếu audio/TXT sau khi tạo.

## Kiểm tra

- Build, ESLint/TypeScript và 47 kiểm tra mã nguồn (41 hiện có + 6 nhóm TTS).
- API giả lập kiểm tra payload hai model, 23 ngôn ngữ, clone giọng, WAV/MP3 giữ nguyên bytes, ghép số, đưa vào bản dựng/phụ đề, cache, tiếp tục sau lỗi, hủy, timeout và phản hồi sai định dạng.
- Kiểm tra giao diện desktop và viewport điện thoại 390px: chuyển nguồn voice, model/ngôn ngữ/định dạng, giọng mẫu, mở/đóng nâng cao, chặn thao tác khi thiếu mẫu. Ảnh trong `docs/images/tts-*.png`.
- Không gọi API Modal thật, không phát sinh lượt GPU thử, không cài thêm thư viện/model và chưa đo chất lượng giọng/timing thực tế.
