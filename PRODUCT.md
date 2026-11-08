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

SRT nhập nhiều file dùng chung ngôn ngữ gốc, hàng đợi file × ngôn ngữ chạy tuần tự; cache ngay từng câu, có khoảng nghỉ và chờ tăng dần khi Google chặn. Dừng/tiếp tục giữ cache, ZIP chỉ xuất bản đủ câu và đúng timestamp; không cam kết chất lượng nghĩa hoặc luôn vượt được giới hạn của Google miễn phí.

Ghép MP4 H.264 thành tối đa 100 lần xuất hiện theo thời gian toàn video; nhập kéo thả, dùng lại cùng clip tại nhiều thời điểm mà không nhân đôi file, mỗi lần chỉnh vị trí/kích thước/thời gian riêng. Nhận giây hoặc phút:giây; chỉ áp dụng thời điểm đã nhập xong và hợp lệ. Preview kéo vị trí/đổi kích thước giữ tỷ lệ, cắt đầu/thời lượng, tắt tiếng mặc định và chroma key nền xanh. Lớp nằm trên bản dựng, được lưu cùng dự án và giữ qua dựng lại/xuất; không làm dài video chính. Không tải model hoặc chuyển mã tự động; tối đa 200 MB/file.

v0.8 có không gian editor toàn cửa sổ: tài nguyên trái, preview giữa, thiết lập nhanh phải và timeline rộng phía dưới. Ba hàng thời gian ảnh/voice/phụ đề, waveform thật, playhead, Play, zoom và tua. Ba ô đầu vào độc lập; không upload thư mục gộp. Preview chạy ảnh/WAV ngay; cue chưa căn phải ghi rõ ước tính.

Bốn tab thiết lập: chuyển động ảnh, chuyển cảnh, lớp phủ và phụ đề. Có 20 loại lớp phủ xếp tối đa 8 lớp, 38 chuyển cảnh, 33 lựa chọn chuyển động ảnh, 14 kiểu chữ, toàn bộ 29 lựa chọn animation vào/ra và 12 lựa chọn lặp hiện có. Tham số ảnh/keyframe và trình bày phụ đề mở rộng, đóng mặc định. Ba nhóm ảnh/chuyển cảnh/phụ đề có phạm vi toàn video hoặc cảnh đang xem; lớp phủ vẫn chung. Ngoại lệ lưu theo tên ảnh. Demo dùng hình minh họa A/B cố định, không lấy ảnh dự án; chỉ chạy ô đang tương tác. Thay hiệu ứng giữ timing căn sẵn còn khớp, không bắt chạy lại model chỉ để xem thử.

Chuyển động ảnh và chuyển cảnh có ba chế độ tự động, chọn một hoặc ngẫu nhiên từ danh sách người dùng chọn. Chế độ ngẫu nhiên hiện số kiểu đã chọn, chọn tất cả và đảo lại riêng từng nhóm; luôn giữ ít nhất một kiểu, tránh lặp liền nhau khi có lựa chọn khác. Danh sách và mã ngẫu nhiên riêng được lưu cùng dự án/mẫu, áp dụng toàn video hoặc từng cảnh, cho preview và export cùng kết quả. Vị trí phụ đề có đặt nhanh Trên/Giữa/Dưới và khung kéo đúng tỷ lệ, tọa độ phần trăm thu gọn, hỗ trợ phím mũi tên; đổi kiểu chữ vẫn giữ vị trí.

Kéo đổi độ rộng hai cột bên và chiều cao timeline, hỗ trợ bàn phím, tự giới hạn theo viewport, lưu kích thước trong trình duyệt và khôi phục mặc định. Mobile dùng tab panel và đổi được chiều cao timeline.

Một cảnh = một ảnh + WAV + mục TXT cùng số. WAV quyết định thời lượng, forced alignment local căn câu và giữ trọn voice qua chuyển cảnh. Xuất tự động kiểm tra/căn/dựng/render. Python/model do người dùng cài bằng uv. Không voice thì timing ước lượng. PNG biến đổi nguyên khối, rig/sprite dùng động tác có sẵn; không tự vẽ tư thế mới. Chưa có GPT hoặc cảnh dùng video làm nguồn chính. Lớp MP4 ghép thêm có cắt đầu/thời lượng và âm thanh tùy chọn, chưa có timeline chỉnh/mix nhiều audio track riêng.

Menu Tệp lưu/mở mẫu không cần người dùng viết JSON; giữ tương thích mẫu/dự án cũ. `data/` chứa tài nguyên người dùng; giữ nguyên. `test/` có 3 ảnh + 3 WAV tiếng Việt + TXT; `tests/` dùng kiểm tra mã nguồn. Kế hoạch và hướng dẫn trong `docs/`. Không cài môi trường hoặc render dài nếu không cần; kiểm tra tập trung vào thay đổi.

Lời đọc & giọng gộp chỉnh TXT/nguồn voice/thiết lập TTS trong một dialog. Hồ sơ người nói preset/clone và phân vai từng lượt cho phép nhiều giọng nối tiếp trong một cảnh. Chọn lượt/cả cảnh/tất cả, gán hàng loạt, thêm/tách lượt, thu gọn thiết lập. Cache mỗi lượt, ghép WAV trung gian rồi mới mã hóa MP3; voice/cảnh tiếp tục qua căn phụ đề hiện có. Không tự nhận diện người nói hoặc trộn tiếng đồng thời.

Xử lý ảnh gộp LaMa local (vùng chữ nhật kéo/thay đổi kích thước và điều chỉnh ratio/padding/feather/context) với Real-ESRGAN 2×/4×. Xem thử không đổi dự án, chạy toàn bộ, tự xử lý ảnh nhập mới, cache, hủy, khôi phục nguồn. Giữ ID/tên ảnh và metadata original; xử lý lại từ nguồn. Cần thư viện trong uv .venv và trọng số local; không tự tải model khi mở UI.

Thư viện Dự án ở header cho phép tìm, mở lại, tạo mới và nhân bản video; tự lưu bản đang làm trước khi rời đi. Mỗi dự án giữ Workspace riêng trong `data/projects/` bằng snapshot và journal thay đổi, dùng chung media để tránh nhân đôi. Tệp JSON là bản sao cấu hình để tải về/nhập thành dự án riêng; dữ liệu draft trình duyệt cũ được chuyển một lần sau khi server xác nhận lưu thành công.

Thư viện cho phép xóa dự án đã lưu cùng tệp riêng và bản xuất liên quan; tài nguyên còn được dự án khác dùng được giữ lại. Xác nhận hiện tên dự án, số tệp, dung lượng và cảnh báo không thể hoàn tác; nút Giữ lại nhận focus trước. Xóa dự án đang mở sẽ chuyển sang dự án còn lại hoặc tạo bản trống nếu đây là dự án cuối.

Lịch sử xuất cho đổi tên trực tiếp từng bản, lưu tên tải MP4/SRT và giữ hậu tố ngôn ngữ. Xóa bản xuất cần xác nhận, dọn MP4/SRT/snapshot và metadata riêng, giữ ảnh/voice/dự án nguồn; chỉ thao tác khi tác vụ đã dừng hẳn. Dự án mở lại đối chiếu trạng thái bản xuất với server để bỏ liên kết đã xóa hoặc cập nhật tên.

Đổi tên góc trái là đổi metadata, giữ bản dựng và tác vụ hiện tại; khi tự lưu, đồng bộ tên tải MP4/SRT cho lịch sử cùng projectId, kể cả tác vụ đang xuất. Tên riêng từng bản không bị các lần lưu thông thường ghi đè; đổi tên dự án lần nữa sẽ cập nhật các bản thuộc dự án đó.

Nút Dung lượng ở header mở dialog thống kê theo nhóm bằng MB, hiện đường dẫn tuyệt đối của kho đang đọc; chỉ quét khi mở, Kiểm tra lại hoặc sau khi dọn. Tổng `.cache` riêng gồm model và mọi thư mục con, không cộng trùng vào tổng đã quét. Hiện số tệp, phân biệt kích thước nội dung với dung lượng chiếm trên đĩa gồm metadata thư mục; block hardlink chỉ tính một lần, bỏ qua symlink. Xóa từng nhóm cần xác nhận số tệp, dung lượng và tác động; dọn bản xuất đồng bộ MP4/SRT/snapshot/metadata và liên kết trong các dự án, cache đã xóa được đồng bộ giữa các tab. `.git`, `.venv`, cấu hình và nhóm chưa nhận diện chỉ xem; giữ ảnh, voice và dự án nguồn.

VieNeu v3 Turbo là dịch vụ TTS tiếng Việt tùy chọn bên cạnh Chatterbox; dự án cũ thiếu provider vẫn dùng Chatterbox. API key chỉ ở `.env` backend, không lưu trong dự án hoặc frontend. Preset cho tải danh sách giọng khi bấm hoặc nhập ID; clone dùng WAV/MP3 3–8 giây, tối đa 10 MiB, có tùy chọn lọc nhiễu. Mỗi lượt tối đa 2.000 ký tự; clone chạy tác vụ nền theo từng lượt. WAV giữ bytes API, MP3 mã hóa một lần ở 320 kbps. Dùng chung giọng mặc định, phân vai nhiều người nói, cache từng lượt và pipeline voice/preview/xuất hiện có; phụ đề VieNeu căn bằng Whisper local với `vi`.
