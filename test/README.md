# Bộ đầu vào minh hoạ — Ba trò nghịch tuổi thơ

Ba ảnh hoạt hình dọc 720×1280, ba voice WAV tiếng Việt và một TXT chứa đúng toàn bộ lời đọc. Ảnh lấy từ artwork demo nội bộ đã tạo; voice tổng hợp bằng giọng Linh có sẵn trên macOS.

Voice PCM 16-bit, mono, 24 kHz; thời lượng lần lượt khoảng **10,99 / 11,50 / 13,19 giây**, tổng **35,68 giây**. Đã kiểm tra format WAV, có tín hiệu và ghép đúng ba mục TXT.

| Cảnh | Ảnh | Voice | Mục TXT |
| --- | --- | --- | --- |
| Ngủ nướng | `images/01_ngu-nuong.png` | `voices/01_ngu-nuong.wav` | 1 |
| Nói vào quạt | `images/02_noi-vao-quat.png` | `voices/02_noi-vao-quat.wav` | 2 |
| Trùm chăn | `images/03_trum-chan.png` | `voices/03_trum-chan.wav` | 3 |

Trong Khung:

1. **Chọn ảnh**: chọn cả ba PNG trong `test/images/`.
2. **Chọn voice**: chọn cả ba WAV trong `test/voices/`. Ô này cũng nhận MP3 hoặc bộ trộn WAV/MP3 của bạn.
3. **Chọn TXT**: chọn `test/script.txt`.
4. Timeline hiện ba hàng ảnh/voice/phụ đề; chọn 9:16 rồi nhấn **Chạy thử**. **Căn phụ đề** chạy model thật; **Xuất video** tự căn và xuất MP4.

Không upload cả thư mục. Giữ nguyên số 01/02/03 để ghép đúng; thứ tự chọn file không ảnh hưởng. Có thể chọn cả ba WAV một lần bằng Cmd+A trong cửa sổ chọn tệp.

Cần cài môi trường căn phụ đề một lần bằng `npm run setup:voice` (dùng uv). Bộ này không kèm timing giả; mốc từng câu được tìm từ WAV khi bạn dựng. Đầu vào là ảnh tĩnh, chưa chứa sprite nhân vật.

`test/` là dữ liệu để bạn thử công cụ; `tests/` là các bài kiểm tra mã nguồn và vẫn cần được giữ.
