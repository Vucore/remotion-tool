# Đầu vào voice WAV và MP3

## Quyết định

Người dùng chọn trực tiếp WAV/MP3, có thể trộn hai loại trong một bộ. **Giữ nguyên từng byte của cả WAV và MP3**, giữ đuôi nguồn trong `data/uploads/`, Project, preview và nguồn audio gửi vào renderer. Tên nguồn giữ nguyên để ghép cảnh theo số.

MP3 được giải mã tạm để đọc thời lượng theo sample và tạo waveform. Bộ căn phụ đề nhận WAV tạm riêng, được dọn khi xong/lỗi/huỷ. Bản phân tích dùng PCM 24-bit, giữ sample rate/số kênh, không dùng filter âm lượng/tốc độ, không thay thế MP3 nguồn trong video. FFmpeg đi kèm hiện có encoder PCM 16/24-bit; không cần float 32-bit cho bản phân tích. Việc xử lý này không phục hồi chi tiết MP3 đã mất.

MP4 là đầu ra đã mã hóa: renderer dùng AAC 320 kbps ở chất lượng cao, 192 kbps ở tiêu chuẩn; không tuyên bố MP4 giữ nguyên bitstream MP3 hay là lossless. Nguồn nhập vẫn nguyên vẹn. Dùng FFmpeg đi kèm Remotion đã cài, không cần thêm Python/model để nhập MP3 hoặc chạy preview; căn phụ đề thật vẫn cần môi trường uv/model.

## Triển khai

1. `scripts/voice-input.mjs`: xác thực WAV/MP3, trả nguồn nguyên vẹn cùng bản phân tích riêng, kiểm tra thời lượng theo sample, giới hạn thời gian chạy và dọn file tạm khi xong/lỗi/huỷ.
2. API upload và CLI cùng dùng hàm này; lưu nguồn nguyên định dạng, đúng MIME và HTTP Range cho phát/tua. Schema cho phép đường dẫn `.wav` và `.mp3`, giữ tương thích dự án WAV cũ.
3. Web nhận cả hai đuôi, dùng nhãn Voice/WAV · MP3, giữ ba đầu vào riêng.
4. Giữ giới hạn 100 MB đầu vào, 0,5–300 giây/voice, tối đa 300 file; không nhận phần âm thanh bị cắt để lách giới hạn thời lượng.
5. Build/kiểm tra tập trung bằng MP3 thật; không cài thư viện hoặc chạy model alignment.

## Kiểm tra

- WAV đầu vào giữ nguyên byte. MP3 CBR/VBR, mono/stereo, 24/44,1/48 kHz đã kiểm tra; số sample sau bỏ encoder delay/padding, số kênh và sample rate khớp nguồn fixture có metadata gapless.
- Bản phân tích có payload sample giống giải mã FFmpeg thông thường, có waveform thật; MP3 nguồn vẫn nguyên byte. File hỏng/quá ngắn/quá dài bị từ chối; không nhận một phần file dài đã cắt.
- Fixture căn phụ đề trộn MP3/WAV xác nhận Project/lưu–mở giữ đúng nguồn, hash theo nguồn, chỉ aligner nhận WAV tạm, file tạm dọn cả khi thành công và lỗi. Không chạy Whisper thật.
- Đã upload MP3 và WAV qua API, tải lại và so sánh từng byte; MIME `audio/mpeg`/`audio/wav`, Range 206 và waveform đúng. MP3 hỏng trả 400. File thử và server kiểm tra được dọn/dừng.
