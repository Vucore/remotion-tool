# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Khung dùng Remotion để dựng video kể chuyện từ ảnh, voice WAV, TXT đánh số và asset nhân vật. Ưu tiên tự động hoá việc lặp lại, thao tác ít, chỉ 9:16 và 16:9.

Voice nhận cả WAV/MP3 trong cùng bộ, giữ nguồn nguyên byte và nguyên định dạng cho preview/xuất; MP3 chỉ có bản giải mã tạm cho phân tích/aligner. Nhập MP3 dùng FFmpeg đã đi kèm Remotion, không cần cài Python/model cho preview. Đầu ra MP4 dùng AAC 320 kbps (cao) hoặc 192 kbps (tiêu chuẩn).

Nguồn voice có hai lựa chọn Tải voice/Tạo từ TXT. Chatterbox Modal tạo WAV/MP3 theo mục TXT bằng Turbo (en) hoặc Multilingual (23 ngôn ngữ đã công bố, không vi), preset hoặc WAV/MP3 giọng mẫu. Cấu hình model/giọng/định dạng hiện trước; sampling và URL thu gọn. Xuất tự tạo voice khi cần, có cache từng mục, tiến độ/hủy, nghe/tải audio; không tải model Chatterbox về máy. Phụ đề vẫn căn bằng Whisper local, nay chọn đủ 23 ngôn ngữ TTS và vi cho voice tải lên.

## Capabilities and Constraints

SRT dùng cue của bản dựng và timeline chung; xuất kèm MP4 trên web hoặc tải riêng. Công cụ SRT nhập file ngoài, dịch Google Translate miễn phí qua deep-translator, xuất gốc/bản dịch/song ngữ giữ timestamp và tên mã_ngônngữ. Không thêm model dịch local; không cần API key. Sidebar ưu tiên đầu vào/thumbnail; cấu hình giọng/TXT/nhân vật/phụ đề mở dialog. SRT nhập/dịch phục vụ xuất file, chưa thay layer chữ trên video.

v0.8 có không gian editor toàn cửa sổ: tài nguyên trái, preview giữa, thiết lập nhanh phải và timeline rộng phía dưới. Ba hàng thời gian ảnh/voice/phụ đề, waveform thật, playhead, Play, zoom và tua. Ba ô đầu vào độc lập; không upload thư mục gộp. Preview chạy ảnh/WAV ngay; cue chưa căn phải ghi rõ ước tính.

Bốn tab thiết lập: chuyển động ảnh, chuyển cảnh, lớp phủ và phụ đề. Có 20 loại lớp phủ xếp tối đa 8 lớp, 38 chuyển cảnh, 33 lựa chọn chuyển động ảnh, 14 kiểu chữ, toàn bộ 29 lựa chọn animation vào/ra và 12 lựa chọn lặp hiện có. Tham số ảnh/keyframe và trình bày phụ đề mở rộng, đóng mặc định. Ba nhóm ảnh/chuyển cảnh/phụ đề có phạm vi toàn video hoặc cảnh đang xem; lớp phủ vẫn chung. Ngoại lệ lưu theo tên ảnh. Demo dùng hình minh họa A/B cố định, không lấy ảnh dự án; chỉ chạy ô đang tương tác. Thay hiệu ứng giữ timing căn sẵn còn khớp, không bắt chạy lại model chỉ để xem thử.

Kéo đổi độ rộng hai cột bên và chiều cao timeline, hỗ trợ bàn phím, tự giới hạn theo viewport, lưu kích thước trong trình duyệt và khôi phục mặc định. Mobile dùng tab panel và đổi được chiều cao timeline.

Một cảnh = một ảnh + WAV + mục TXT cùng số. WAV quyết định thời lượng, forced alignment local căn câu và giữ trọn voice qua chuyển cảnh. Xuất tự động kiểm tra/căn/dựng/render. Python/model do người dùng cài bằng uv. Không voice thì timing ước lượng. PNG biến đổi nguyên khối, rig/sprite dùng động tác có sẵn; không tự vẽ tư thế mới. Chưa có GPT, video nguồn, cut/trim hoặc mix nhiều audio track.

Menu Tệp lưu/mở mẫu không cần người dùng viết JSON; giữ tương thích mẫu/dự án cũ. `data/` chứa tài nguyên người dùng; giữ nguyên. `test/` có 3 ảnh + 3 WAV tiếng Việt + TXT; `tests/` dùng kiểm tra mã nguồn. Kế hoạch và hướng dẫn trong `docs/`. Không cài môi trường hoặc render dài nếu không cần; kiểm tra tập trung vào thay đổi.

Lời đọc & giọng gộp chỉnh TXT/nguồn voice/thiết lập TTS trong một dialog. Hồ sơ người nói preset/clone và phân vai từng lượt cho phép nhiều giọng nối tiếp trong một cảnh. Chọn lượt/cả cảnh/tất cả, gán hàng loạt, thêm/tách lượt, thu gọn thiết lập. Cache mỗi lượt, ghép WAV trung gian rồi mới mã hóa MP3; voice/cảnh tiếp tục qua căn phụ đề hiện có. Không tự nhận diện người nói hoặc trộn tiếng đồng thời.
