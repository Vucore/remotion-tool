# Kiểm tra và giới hạn hiện tại

## Code và giao diện

- Build, TypeScript và ESLint phần code mới đã qua ở lượt triển khai giao diện tự động.
- Chín kiểm tra tại `tests/story.test.mjs` và bảy kiểm tra `tests/advanced.test.mjs` đã qua: các luồng ghép/cue/voice cũ; toàn bộ 33 motion/38 transition/easing có kết quả hữu hạn; schema nâng cao, tất cả animation/loop chữ, lưu/mở và scoped override qua cả preview/bản dựng voice fixture. Danh mục lớp phủ vẫn 20 loại.
- Mười hai kiểm tra `tests/auto.test.mjs` cũng qua sau khi mở rộng AutoConfig.overrides.textStyle; tổng 28 kiểm tra. Không cài dependency hoặc chạy model/render dài.
- v0.8 đã xác nhận kéo/đổi kích thước bằng bàn phím, giữ kích thước qua reload, demo dùng hình A/B cố định, phạm vi cảnh không đổi cảnh khác và console không có lỗi. Desktop/mobile dùng cùng app.
- Trình duyệt đã nhập bộ ba PNG/WAV/TXT trong `test/`, phát/dừng preview, click cue tua đúng câu, đổi kiểu chữ, bật đồng thời sao + tối góc và thấy waveform thật cùng ba hàng thời gian. Đã xem desktop và khung 390px chạy cùng app. Ảnh: `docs/images/workspace-desktop.png`, `docs/images/workspace-mobile.png`.
- Ảnh giao diện hiện tại nằm trong `docs/images/`; các ảnh chụp editor cũ đã bỏ.

## Hỗ trợ WAV và MP3

Build, TypeScript, ESLint và toàn bộ 41 kiểm tra đã qua. Bốn kiểm tra mới ở `tests/voice-input.test.mjs` chạy FFmpeg thật với MP3 CBR/VBR, mono/stereo; xác nhận giữ nguyên byte nguồn, đúng số sample/sample rate/kênh, waveform, giới hạn và cleanup WAV tạm. Fixture căn voice trộn WAV/MP3 giữ nguyên đường dẫn nguồn qua compile và JSON round-trip.

Đã kiểm tra API upload/tải lại cả MP3 và WAV: dữ liệu giống từng byte với nguồn, MIME đúng, HTTP Range 206 và waveform có tín hiệu; MP3 hỏng bị từ chối. Không chạy model căn phụ đề hoặc render MP4; không cài dependency mới. File thử đã dọn và server kiểm tra đã dừng. [Phạm vi và chất lượng](HO-TRO-MP3.md).

## Tạo voice từ TXT

Build, TypeScript, ESLint và toàn bộ 47 kiểm tra đã qua sau tích hợp Chatterbox. Sáu nhóm mới tại `tests/tts.test.mjs` kiểm tra hai model/23 ngôn ngữ, payload clone, WAV/MP3 giữ byte nguồn, cache từng cảnh, tiếp tục sau lỗi, phản hồi sai, hủy/timeout và ghép vào bản dựng. Có kiểm tra giữ riêng ngôn ngữ voice tải lên khi bật/tắt TTS và khi mở lại dự án.

Đã xem giao diện desktop/viewport 390px và thao tác đổi nguồn/model/ngôn ngữ/định dạng, thu gọn cấu hình, kiểm tra trạng thái thiếu mẫu. Review phần mở rộng đã sửa lỗi ghi đè ngôn ngữ upload; verdict xác nhận finding đó resolved, không mở rộng thành chứng nhận toàn ứng dụng. Không gọi Modal thật, không chạy Whisper thực tế, không render MP4 hoặc cài thêm môi trường. [Chi tiết triển khai](TICH-HOP-TTS.md).

## Bộ minh hoạ để người dùng thử

`test/` có ba PNG 720×1280, ba WAV tiếng Việt PCM 16-bit/mono/24 kHz và một TXT. Đã kiểm tra header ảnh, WAV hợp lệ/có tín hiệu, ba cặp ảnh–voice–TXT ghép đúng theo số. Voice lần lượt dài khoảng 10,99 / 11,50 / 13,19 giây, tổng 35,68 giây.

WAV là lời đọc tổng hợp bằng giọng Linh trên macOS, cùng nội dung TXT. Không dùng tiếng bíp hoặc WAV im lặng. Bộ này chưa chạy qua model forced alignment trong lượt tạo dữ liệu; người dùng cần cài môi trường bằng uv và tự kiểm tra kết quả phụ đề khi dựng.

## SRT và dialog tài nguyên

Build, lint/TypeScript và 52 kiểm tra đã qua; sau sửa nhãn mốc ước tính đã chạy lại 5 nhóm SRT và lint. Các nhóm mới xác nhận xuất SRT theo timeline toàn cục, UTF-8/ngắt dòng/overlap, tên mã + tên ngôn ngữ, song ngữ, payload Google, cache không chứa key và lỗi/hủy qua API giả lập. Giao diện desktop và 390×844 đã mở dialog, đóng bằng Escape và tải SRT 12 cue/1.064 byte tại Downloads. Không gọi Google/Modal thật hoặc render MP4 kiểm chứng sidecar; chưa chạy model Whisper.

Ảnh mới: `docs/images/resources-desktop.png`, `subtitles-desktop.png`, `subtitles-mobile.png`. [Cách dùng và giới hạn](PHU-DE-SRT-VA-GIAO-DIEN.md); [dung lượng](DUNG-LUONG-SRT.md).

## Giới hạn

Chỉ ảnh → video, không video nguồn hoặc GPT. Voice tải WAV/MP3 + TXT theo số hoặc tạo bằng Chatterbox từ TXT. Bộ căn local mặc định small, CPU; upload mặc định tiếng Việt, TTS theo ngôn ngữ model. TTS chưa có tiếng Việt, không tự dịch/phát hiện ngôn ngữ, chưa gọi cloud để đo chất lượng thực tế. Không có voice thì cue phụ đề là ước lượng. Animation PNG biến đổi nguyên khối; bộ phận/sprite chỉ dùng động tác mà asset hỗ trợ, không tự tạo diễn xuất mới.

Runtime effect cũ còn để đọc/xuất dự án tương thích; một số effect phụ thuộc GPU. Có timeline ba hàng để xem/tua và thiết lập toàn video, không cắt/trim/mix nhiều track hoặc chỉnh mốc voice/cue bằng tay. Chưa chạy model alignment thực tế hoặc render lại MP4 ở lượt thay workspace này; không cài thêm thư viện.
