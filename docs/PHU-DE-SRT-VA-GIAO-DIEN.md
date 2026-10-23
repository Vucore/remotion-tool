# Phụ đề SRT và dịch miễn phí

## Kế hoạch và kết quả

Đã thay Google Cloud Translation v2 bằng `deep-translator` / `GoogleTranslator`.
Bỏ API key, billing và biến GOOGLE_TRANSLATE_API_KEY. Giữ xuất SRT gốc,
bản dịch, song ngữ, timestamp, cache, tiến độ và hủy tác vụ.

## Cài đặt chung bằng uv

```sh
uv sync
npm run build
npm start
```

Tất cả thư viện Python khai báo tại `pyproject.toml`, dùng chung `.venv`:
Whisper/Stable-ts, soundfile, scipy và deep-translator. Không tạo venv dịch riêng.
Node/Remotion vẫn do npm quản lý vì đó là thư viện JavaScript, không thể cài vào Python venv.
Model Whisper là dữ liệu, lưu tại `.cache/whisper`; không tải model dịch.
`npm run setup:python` tương đương `uv sync`, không tải trọng số Whisper.
Muốn tải trọng số căn voice: `npm run setup:voice -- --model small`.
Không còn dùng `.venv-voice` hay KHUNG_VOICE_PYTHON.

## Sử dụng

Mở **SRT** → chọn từ bản dựng hoặc nhập SRT → chọn ngôn ngữ gốc/đích → **Dịch phụ đề**.
Không cần API key. Nút **Tải đầy đủ ngôn ngữ** lấy danh sách từ thư viện Python;
các ngôn ngữ thông dụng giữ tên tiếng Việt trên giao diện.
Có thể tải SRT gốc, dịch hoặc song ngữ. Tên như `video_en_tienganh.srt`.
SRT nhập ngoài phục vụ dịch/xuất, chưa thay lớp chữ trên video.

Nội dung gửi tới Google qua Internet. Đây là dịch vụ Google Translate miễn phí
qua deep-translator, có thể bị giới hạn hoặc tạm chặn; ứng dụng hiển thị lỗi,
không tự gửi lại liên tục. Cache `.cache/translations/` giữ từng câu thành công
để lần thử sau dùng lại. Mỗi yêu cầu tối đa khoảng 4.500 ký tự; câu dài được chia
và ghép lại trong cùng cue, không đổi timestamp. Mỗi batch tối đa 10 câu.
Không tự dịch lại các ký tự HTML entity do kết quả thư viện đã là văn bản.

Không cài dependency/model và không gọi Google thật khi sửa mã. Kiểm tra dịch
bằng backend giả lập xác nhận timestamp/cache/lỗi/hủy; người dùng tự `uv sync`.

Tham khảo [deep-translator GoogleTranslator](https://deep-translator.readthedocs.io/en/latest/usage.html).
