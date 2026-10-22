# Đề xuất animation nhân vật/vật thể — chưa triển khai

> Bản đề xuất lịch sử, viết trước v0.5. Phạm vi mới ưu tiên chỉnh vị trí/động tác đặc thù bằng tay và tự động hoá việc lặp lại. Xem [kế hoạch triển khai](TRIEN-KHAI-NHAN-VAT.md) và [hướng dẫn code hiện tại](NHAN-VAT-VA-VAT-THE.md).

## Mục tiêu

Mở rộng luồng ảnh + WAV + TXT + config thành video kể chuyện có nhân vật và vật thể chuyển động độc lập. Người dùng cung cấp bộ đầu vào một lần, hệ thống chọn động tác theo quy tắc/kịch bản và tự căn theo voice; không yêu cầu chỉnh keyframe từng cảnh hoặc viết lại code cho từng video.

Hiện tại Scene chứa một ảnh chính, chuyển động ảnh, lớp phủ, chữ và voice. Chưa có mô hình nhiều nhân vật, bộ phận cơ thể hoặc thư viện hành động nhân vật.

## Hướng đề xuất

Thêm các lớp nền, nhân vật và vật thể trong mỗi cảnh. Một engine dùng chung xử lý tài nguyên, vị trí/điểm xoay, thứ tự trước sau và các hành động từ thư viện. Mỗi hành động khai báo khả năng cần thiết: tài nguyên không có mắt/miệng/tay riêng thì không nhận động tác tương ứng.

| Cấp độ | Tài nguyên đầu vào | Chuyển động có thể xây |
| --- | --- | --- |
| Vật thể/nhân vật nguyên khối | PNG/WebP tách nền và ảnh nền riêng | Đi vào/đi ra bằng trượt, di chuyển theo đường, xoay, rung, nhún, bật nảy, rơi, bay, đổi kích thước/độ mờ. Chưa có cử động tay/chân độc lập. |
| Nhân vật tách bộ phận | Đầu, thân, mắt, miệng, các đoạn tay/chân; điểm khớp chuẩn | Chớp mắt, gật/nghiêng đầu, vẫy/chỉ tay, nói bằng các hình miệng, chu kỳ đi bộ đã thiết kế. Cử động bị giới hạn bởi phần đã vẽ và rig. |
| Animation dựng sẵn | Rive/Lottie hoặc chuỗi khung hình/sprite có các clip hành động | Phát hành động đi/chạy/ngồi/biểu cảm đã có, ghép và căn theo thời gian cảnh. Cần chuẩn bị đúng hành động trong tài nguyên. |

Remotion có thể tính biến đổi theo frame và nhúng Rive/Lottie. Tích hợp phát animation không tự tạo ra tài nguyên, rig hay mọi động tác từ một ảnh.

## Đầu vào cho tự động hoá

- Nền từng cảnh, WAV và TXT đánh số như hiện tại.
- Thư viện nhân vật/vật thể dùng lại: ảnh hoặc các bộ phận, điểm neo/khớp, hướng nhìn, động tác hỗ trợ và bố cục mặc định cho 9:16/16:9.
- Config chọn nhân vật, vật thể và quy tắc hành động. Nếu không chỉ định riêng từng cảnh, dùng mẫu: vào cảnh → trạng thái chờ → hành động theo cue → ra cảnh.
- Chỉ định người nói nếu muốn miệng nhân vật chuyển động. Voice kể chuyện ngoài hình không mặc định khiến mọi nhân vật cùng nói.

Bộ nhân vật được chuẩn bị một lần, có thể thay màu/trang phục/biểu cảm khi tài nguyên hỗ trợ. Mỗi video chủ yếu thay nền, WAV, lời đọc và kịch bản hành động.

## Căn hành động với voice

1. Dùng pipeline WAV/TXT hiện tại để lấy thời lượng và cue phụ đề.
2. Lập danh sách nhân vật/vật thể xuất hiện trong cảnh.
3. Quy tắc hoặc planner tạo các hành động tham chiếu cue, ví dụ bắt đầu ở cue 2 cộng 0,1 giây. Khi voice thay đổi, hệ thống tính lại mốc.
4. Engine kiểm tra hành động có trong thư viện, giới hạn tư thế/khung hình, độ dài, xung đột và thứ tự trước sau rồi render cùng ảnh/chữ/voice.

Mặc định cho nhân vật có đủ bộ phận: thở/chớp mắt nhẹ, thỉnh thoảng gật đầu. Động tác có ý nghĩa câu chuyện như chỉ vào điện thoại hoặc nhặt vật cần có lệnh trong kịch bản/config hoặc planner chọn từ thư viện. Không suy luận hành động chỉ bằng việc thấy từ khoá trong câu.

Miệng đóng/mở theo cường độ WAV là mức cơ bản; không tương đương khớp khẩu hình theo âm vị. Lip-sync âm vị cần thêm bước tạo mốc âm vị/viseme và bộ hình miệng phù hợp. Cue từng câu hiện tại chưa đủ cho mức này.

## Ví dụ một cảnh

Nền căn phòng, nhân vật An, một điện thoại, voice cảnh 01 và text cảnh 01:

- Đầu cảnh: An trượt vào vị trí đứng rồi thở/chớp mắt nhẹ.
- Khi cue đầu bắt đầu: điện thoại rung; nếu An là người nói thì miệng mở/đóng theo âm lượng.
- Khi cue tiếp theo bắt đầu: An gật đầu hoặc giơ tay nếu rig hỗ trợ.
- Cuối cảnh: giữ tư thế kết thúc, chuyển cảnh vẫn giữ trọn voice như luồng hiện tại.

## Trường hợp chỉ có một ảnh phẳng

Ảnh chứa cả nền và nhân vật chỉ đủ cho chuyển động toàn ảnh đang có. Muốn nhân vật chuyển động riêng cần có lớp nhân vật tách nền; nền gốc phải xoá vị trí nhân vật để tránh thấy bản nhân vật cũ khi lớp mới di chuyển. Muốn cử động tay/chân còn cần tách bộ phận, điểm khớp và phần hình bị che.

Có thể bổ sung một pipeline AI chuẩn bị những tài nguyên này. Đây là bước xử lý tài nguyên riêng, kết quả cần kiểm tra; không hứa ảnh bất kỳ sẽ tự thành rig hoặc chuyển động cơ thể tự nhiên. Nếu muốn biến đổi tư thế lớn trực tiếp từ ảnh phẳng, hướng sinh clip bằng mô hình image-to-video là một nhánh riêng; Remotion đảm nhiệm ghép, voice, chữ, hiệu ứng và xuất video.

## Phạm vi nên làm theo giai đoạn

1. **Lớp đối tượng độc lập và thư viện chuyển động nguyên khối.** Nền + nhiều nhân vật/vật thể, bố cục mẫu, khoảng 10–15 hành động, hành động bám cue, dùng cùng compiler cho web/CLI. UI chủ yếu nhận bộ đầu vào, chọn mẫu và hiển thị các tài nguyên thiếu.
2. **Một chuẩn nhân vật có khớp.** Chuẩn hoá các bộ phận/điểm khớp, thêm chớp mắt/gật đầu/vẫy/chỉ tay, biểu cảm và miệng theo WAV. Chỉ làm các động tác có tài nguyên hỗ trợ. Có thể bổ sung adapter Rive/Lottie khi cần dùng animation đã thiết kế.
3. **Planner từ kịch bản.** GPT đọc nội dung và đề xuất nhân vật, hành động, thời điểm theo cue dưới dạng dữ liệu có schema. Engine chỉ nhận ID/động tác hợp lệ; không chạy JavaScript tuỳ ý. Lưu kế hoạch đã sinh để render lại ổn định. Người dùng không cần code riêng từng video.

Ưu tiên giai đoạn 1 rồi giai đoạn 2, chuẩn bị một bộ nhân vật mẫu trước. Cách này mở rộng trực tiếp công cụ tự dựng hiện tại và giữ số thao tác thấp.

## Tài liệu đối chiếu

- [Remotion: animating properties](https://www.remotion.dev/docs/animating-properties)
- [Remotion: Rive](https://www.remotion.dev/docs/rive/remotionrivecanvas)
- [Remotion: Lottie và các giới hạn](https://www.remotion.dev/docs/lottie)

Đây là đề xuất thiết kế, không phải tính năng đã được thêm vào code hoặc tài nguyên đã được tạo. Chưa cài thư viện, chạy server, test hoặc render cho đề xuất này.
