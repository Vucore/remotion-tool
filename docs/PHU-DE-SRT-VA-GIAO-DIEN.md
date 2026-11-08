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

Mở **SRT** → chọn từ bản dựng hoặc nhập SRT → chọn ngôn ngữ gốc → tích các ngôn ngữ cần dịch → **Dịch N ngôn ngữ**.
Không cần API key. Nút **Tải đầy đủ ngôn ngữ** lấy danh sách từ thư viện Python;
các ngôn ngữ thông dụng giữ tên tiếng Việt trên giao diện.
Có thể tải SRT gốc, dịch hoặc song ngữ. Tên như `video_en_tienganh.srt`.
SRT nhập ngoài phục vụ dịch/xuất, chưa thay lớp chữ trên video.

Nội dung gửi tới Google qua Internet bằng `deep-translator.GoogleTranslator` miễn phí, không cần API key. Có thể chọn **Tự nhận diện** ngôn ngữ gốc.

Cơ chế cũ gửi từng câu, cách nhau 1,5 giây và chờ dài khi bị chặn. Cơ chế mới gom các câu chưa có cache thành batch tối đa 3.000 ký tự (tính cả dấu phân cách ` \n@@@\n `), nghỉ ít nhất 0,5 giây giữa các lượt gọi. Bộ dịch trong `scripts/srt_translator.py` thử mỗi request tối đa 3 lần, chờ 2/4/6 giây sau lỗi. Nếu Google làm mất dấu phân cách hoặc trả sai số câu, công cụ chuyển sang dịch riêng từng câu, mỗi câu cũng có retry. Câu dài được chia nhỏ để mỗi request không quá 3.000 ký tự. Câu có sẵn `@@@` được dịch riêng để không tách nhầm.

Nếu từng câu vẫn lỗi, giữ nguyên nội dung gốc ở đúng vị trí và timestamp, đồng thời hiển thị số câu chưa dịch. File xuất có thể chứa các câu gốc này; hãy kiểm tra cảnh báo trước khi sử dụng. **Dịch tiếp** thử lại các câu đó. Chỉ câu dịch thành công được ghi cache `.cache/translations/`; giữ cache theo câu để tái sử dụng qua các file. Tính năng nhiều file, nhiều ngôn ngữ và ZIP vẫn dùng bộ đọc/ghi SRT hiện có; không thêm thư viện parser `srt` hoặc đổi quy tắc tên file.

Không tự dịch lại các ký tự HTML entity do kết quả thư viện đã là văn bản.

Không cài dependency/model và không gọi Google thật khi sửa mã. Kiểm tra dịch
bằng backend giả lập xác nhận timestamp/cache/lỗi/hủy; người dùng tự `uv sync`.

Tham khảo [deep-translator GoogleTranslator](https://deep-translator.readthedocs.io/en/latest/usage.html).

## Chọn nhiều ngôn ngữ và tải xuống

- Tìm và tích nhiều ngôn ngữ đích; ngôn ngữ gốc không nằm trong danh sách dịch.
- Dịch lần lượt, hiển thị tiến độ và lỗi riêng từng ngôn ngữ. Bấm Dừng vẫn giữ các bản đã hoàn thành trong cửa sổ. Bấm dịch lại bỏ qua các bản đã có cho cùng nội dung và ngôn ngữ gốc.
- Chọn ngôn ngữ để xem trước. Bỏ tích bản không cần tải. **Tải N bản đã chọn (.zip)** gộp các bản đã chọn và dịch thành công vào ZIP; không chứa bản lỗi hay chưa dịch.
- Bật **Song ngữ** để mỗi SRT chứa lời gốc và bản dịch. Tắt để chỉ xuất lời dịch. SRT gốc vẫn tải riêng.
- Timestamp giữ nguyên; đổi nội dung/ngôn ngữ gốc sẽ không dùng nhầm bản dịch cũ.
- Lựa chọn và bản dịch trong giao diện tồn tại khi cửa sổ đang mở; backend vẫn giữ cache trên ổ đĩa khi đóng cửa sổ.

## Nhiều file và tiếp tục sau lỗi

- Chọn **Nhập SRT có sẵn → Chọn nhiều file SRT**. Có thể thêm tiếp bằng **Thêm SRT**; tối đa 50 file, 2 MB/file và tổng 10 MB mỗi lượt. Các file trong một lượt dùng chung ngôn ngữ gốc; nhóm các file khác ngôn ngữ riêng.
- Chọn nhiều ngôn ngữ rồi bấm **Dịch N file × M ngôn ngữ**. Chạy tuần tự; tối đa 1.000 bản dịch mỗi lượt. Menu **File xem trước** đổi file đang xem, không đổi hàng đợi.
- Khi Google trả 429/chuyển sang trang chặn, tự chờ lần lượt 1, 2, 5 và 10 phút. Lỗi kết nối thử lại sau 3, 10 và 30 giây. Có thể **Dừng dịch** cả khi đang chờ. Nếu vẫn bị chặn/mất mạng, hàng đợi tạm dừng; không tiếp tục gửi toàn bộ các ngôn ngữ còn lại.
- Bấm **Dịch tiếp** để bỏ qua các bản đã xong và dùng cache các câu đã thành công. Đóng dialog sẽ dừng tác vụ; mở lại và chọn lại SRT vẫn dùng được cache backend.
- ZIP gồm các kết quả đủ số câu và đúng từng timestamp. Theo chế độ fallback, có thể có câu giữ nguyên bản gốc nếu dịch thất bại; giao diện báo số câu đó. Mất kết nối tạm thời khi tạo/poll tác vụ có thử nối lại, dùng cùng ID để tránh tạo hai tác vụ.
- Google miễn phí có thể chặn kéo dài; cơ chế chờ không bảo đảm dịch luôn thành công. Kiểm tra số câu/timestamp không bảo đảm nghĩa chính xác: cần rà lại tên riêng, thành ngữ và thuật ngữ.
