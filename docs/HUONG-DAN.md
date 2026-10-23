# Dùng Khung v0.8

## Không gian làm việc

Tài nguyên bên trái, preview ở giữa, thiết lập nhanh bên phải và timeline phía dưới. Không cần cuộn một form dài. Trên màn hình nhỏ dùng ba nút **Tệp · Video · Sửa** để đổi vùng; timeline luôn nằm dưới.

1. **Ảnh bối cảnh**: chọn nhiều PNG/JPG/WebP.
2. **Voice**: chọn nhiều WAV/MP3, có thể trộn hai loại (tuỳ chọn).
3. **Lời đọc TXT**: chọn một TXT đánh số 1., 2., 3.… chứa toàn bộ lời đọc.

Ba ô nhận tệp riêng, có kéo thả/thay/bỏ độc lập. Ảnh 01 ghép với WAV 01 và mục TXT 1. Dùng **Thêm ảnh** để bổ sung vào bộ đang có. [Bộ mẫu để thử](../test/README.md).

Phần **Voice** có hai nguồn: **Tải voice** để dùng WAV/MP3 sẵn, hoặc **Tạo từ TXT** để Chatterbox Modal tự đọc từng mục. Chọn model, ngôn ngữ, giọng preset/giọng mẫu và định dạng WAV/MP3; tham số sâu/URL nằm trong mục thu gọn. **Tạo voice** để nghe trước, hoặc bấm thẳng **Xuất video** để tự tạo rồi ghép/căn/xuất. TTS trong tài liệu chưa có tiếng Việt. [Hướng dẫn TTS](TICH-HOP-TTS.md).

Voice 01 có thể là `01.wav` hoặc `01.mp3`; tên/số ghép không đổi. Giữ nguyên file nguồn ở cả hai định dạng cho preview/xuất. Mỗi file 0,5–300 giây, tối đa 100 MB; không dùng đồng thời WAV và MP3 có cùng số cảnh. [Chi tiết voice và chất lượng](HO-TRO-MP3.md).

## Chạy thử và timeline

Ảnh vừa nhập sẽ tạo bản xem thử ngay. Có WAV thì phát cả voice và lấy đúng độ dài WAV; có TXT thì chia câu phụ đề. Khi chưa căn câu, nhãn **Phụ đề ước tính** luôn được hiển thị. Không cần cài Python để chỉ chạy bản xem thử.

- Nút Play dưới preview hoặc phím Space để chạy/dừng. Bấm vào video cũng phát/dừng; có nút tắt tiếng và toàn màn hình.
- Timeline có thước thời gian và ba hàng: ảnh, waveform voice, từng câu phụ đề. Độ rộng clip theo thời gian, không phải các thẻ cùng kích thước.
- Click/drag thước hoặc vạch phát để tua. Phím mũi tên khi focus thước đi một frame; Shift đi một giây.
- Click ảnh để chọn cảnh, click câu phụ đề để tua đến câu và mở tab Phụ đề. Nút giữa hai cảnh mở tab Chuyển cảnh.
- Dùng thanh zoom, nút +/− hoặc **Vừa khung** để xem timeline dài. Waveform lấy từ envelope WAV đã nhập, không dùng dữ liệu ngẫu nhiên.

Timeline phục vụ xem/tua và thiết lập tự động. Không cắt, kéo dài hay xê dịch voice/câu bằng tay, nên quy tắc ghép số vẫn được giữ.

## Thiết lập nhanh

Sidebar thu gọn: bấm ô **Chatterbox TTS** để mở thiết lập giọng; **Sửa lời đọc** và **Nhân vật & vật thể** cũng mở dialog. Nút **SRT** trên preview hoặc **Phụ đề & SRT** ở tài nguyên mở công cụ tải SRT gốc, nhập SRT bên ngoài, dịch và tải bản dịch/song ngữ. MP4 xuất xong có thêm liên kết SRT. [Hướng dẫn SRT](PHU-DE-SRT-VA-GIAO-DIEN.md).

Chọn trực tiếp trong bốn tab bên phải. Thay đổi xuất hiện ngay trong preview, không cần chạy lại model để xem hiệu ứng. Không còn bộ chọn ba phong cách ở trên preview.

| Tab | Có thể chọn |
| --- | --- |
| Chuyển động | 33 lựa chọn, gồm đường cong, zigzag, hình số 8, zoom kết hợp và đàn hồi; mức/tốc độ/đường cong/thời gian, tâm zoom, khung ảnh và keyframe |
| Chuyển cảnh | 38 lựa chọn, gồm lật trang, zoom xuyên cảnh, uốn ngang, hoán đổi phối cảnh, xoay khối; thời gian, hướng, đường cong |
| Lớp phủ | Đủ 20 loại hiện có; chọn nhiều, tối đa 8 lớp theo schema; lọc/tìm kiếm, chỉnh cường độ, màu, tốc độ, kích thước |
| Phụ đề | Bật/tắt, 14 kiểu chữ, 29 lựa chọn animation vào/ra, 12 lựa chọn lặp; font/màu/cỡ/vị trí, viền/bóng/màu chuyển và độ dài câu |

Các mẫu phổ biến hiện trước; phần còn lại và thông số chi tiết đặt trong mục mở rộng. Mặc định áp dụng toàn video; ba nhóm ảnh/chuyển cảnh/phụ đề có thể đổi sang phạm vi cảnh như hướng dẫn bên dưới. Danh mục lớp phủ này là toàn bộ loại đang có trong engine, không phải giới hạn những gì có thể lập trình thêm bằng Remotion.

Rê chuột hoặc focus bằng Tab vào ô chuyển động/chuyển cảnh/kiểu chữ để xem demo. Trên màn hình cảm ứng, chạm ô sẽ chọn và phát demo. Demo dùng hình minh họa cố định A/B, không lấy ảnh dự án, và dùng cùng hàm animation với video; chỉ ô đang tương tác chạy, không tải nhiều Player. Hệ điều hành bật giảm chuyển động thì demo đứng yên. Ảnh dự án chỉ hiện ở preview chính và bộ chọn tâm zoom.

Mục **Tâm zoom và khung ảnh** cho phép bấm vào ảnh để đặt tâm, hoặc nhập tọa độ. **Đường đi tùy chỉnh** thêm mốc thời gian theo giây với vị trí/tỷ lệ/góc/độ hiện, tối đa 100 mốc. Mốc được kết hợp với kiểu chuyển động đã chọn; chọn Đứng yên nếu chỉ muốn chạy đường đi. Cảnh ngắn hơn mốc cuối sẽ kết thúc trước mốc đó.

Phụ đề có nhóm thu gọn **Animation và thời gian**, **Bố cục và kiểu chữ**, **Viền, bóng và màu chuyển**. Có animation ra, thời gian vào/ra, trễ ký tự/từ, loop, căn lề, độ đậm/nghiêng, giãn dòng/chữ, nền trong suốt, gradient, glow, chữ cong. Thời gian vào/ra được giới hạn theo độ dài từng cue để không tràn sang câu tiếp theo. Tô sáng từng từ là animation trình bày trong cue, không phải alignment từng từ từ WAV.

## Đổi kích thước không gian

Kéo thanh dọc hai bên preview để đổi độ rộng tài nguyên/thiết lập; kéo thanh ngang trên timeline để đổi chiều cao. Kích thước được lưu trong trình duyệt, tự giới hạn khi cửa sổ nhỏ. Tab đến thanh kéo rồi dùng mũi tên (Shift để đi nhanh), Home/End để đến giới hạn. Nhấp đúp thanh kéo để đặt lại vùng đó, hoặc **Tệp → Khôi phục bố cục** để đặt lại cả ba vùng.

Trên điện thoại, hai cột chuyển thành tab Tệp/Video/Sửa; vẫn kéo được chiều cao timeline.

## Thiết lập riêng một cảnh

Chọn cảnh trên timeline, đổi **Toàn video → Cảnh N** ở đầu bảng thiết lập. Chuyển động, khung ảnh, chuyển cảnh sau cảnh đó và trình bày phụ đề sẽ chỉ áp dụng cho cảnh đang xem. Đổi sang phạm vi cảnh sẽ tạm dừng video để tránh sửa nhầm cảnh khi đang phát. Nút **Dùng chung** bỏ thiết lập riêng của cảnh; **Bỏ chỉnh riêng** tại phạm vi toàn video bỏ tất cả ngoại lệ.

Lớp phủ vẫn áp dụng toàn video. Thời lượng ảnh không voice và ký tự/câu là thiết lập chung; timing voice/cue giữ nguyên. Ngoại lệ lưu theo tên file ảnh trong dự án/mẫu, nên giữ tên file khi muốn dùng lại. Parallax tách tiền cảnh/hậu cảnh cần thêm các lớp ảnh riêng, chưa nằm trong đầu vào một ảnh/cảnh này.

Nếu timing đã căn và text/WAV còn khớp, preview dùng lại cue cũ khi đổi hiệu ứng. Nếu thay text/độ dài câu thì cue tạm được tính lại và gắn nhãn ước tính.

## Căn phụ đề và xuất

- **Căn phụ đề**: chạy model với WAV/TXT để có mốc từng câu chính xác hơn, chưa xuất MP4.
- **Xuất video**: kiểm tra ghép số, căn câu nếu cần, dựng và xuất MP4 tự động. Có tiến độ và nút Dừng; khi xong có nút Tải video.
- Căn câu thực tế cần môi trường uv/model cài một lần bằng `npm run setup:voice`. Cấu hình model/ngôn ngữ/chất lượng nằm trong menu **Tệp**.
- Không có WAV vẫn xuất ảnh + chữ; thời lượng/phụ đề là ước lượng theo độ dài lời đọc.

## Lưu và dùng lại

Menu **Tệp** có mở/lưu dự án, mở/lưu mẫu và câu chuyện mới. Mẫu `.khung-preset.json` giữ toàn bộ thiết lập nhanh, không chứa tài nguyên. Dự án giữ bản dựng đã căn; giữ thư mục `data/` để còn ảnh/voice. Dự án và mẫu cũ vẫn đọc được. Bản draft ước lượng không thay bản đã căn khi lưu/xuất.

Nhân vật nhập riêng tại mục thu gọn bên trái. PNG chuyển động nguyên khối; rig/sprite dùng các động tác mà asset hỗ trợ. [Chuẩn bị asset](NHAN-VAT-VA-VAT-THE.md).

```sh
npm run dev
# Chỉ cài một lần nếu cần căn phụ đề theo voice:
npm run setup:voice
```

Mở địa chỉ công cụ in ra, mặc định `http://127.0.0.1:3210`. Dừng bằng Ctrl+C. [Cài voice chi tiết](VOICE-VA-PHU-DE.md).

### Lời đọc và nhiều giọng

Mở **Lời đọc & giọng** để chỉnh lời theo cảnh, thêm người nói preset/clone, tách lượt và gán giọng cho từng lượt hoặc chọn tất cả để áp dụng. Model và thông số chung nằm trong mục thu gọn. [Hướng dẫn chi tiết](LOI-DOC-NHIEU-GIONG.md).
