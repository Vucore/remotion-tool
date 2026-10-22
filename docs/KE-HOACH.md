# Kế hoạch xây dựng web editor

## Yêu cầu đã xác nhận

- Thay toàn bộ nội dung thử nghiệm trong thư mục này bằng một công cụ web.
- Giao diện trực quan, tiếng Việt, ưu tiên thao tác dễ hiểu.
- Tập trung ảnh tĩnh và các tính năng cơ bản trước.
- Mọi kế hoạch, quyết định kỹ thuật và tiến độ nằm trong `docs/`.
- Chưa triển khai GPT, lồng tiếng hoặc animation nhân vật.

## Phạm vi đã chốt

Người dùng chọn **ghép ảnh thành video**. Editor nhận ảnh tĩnh, chỉnh từng cảnh, thêm chữ, chuyển động, chuyển cảnh và xuất MP4. Chưa có video nguồn, âm thanh hoặc timeline nhiều track.

### Tính năng bản đầu

- Nhập PNG/JPG/WebP từ máy và kéo thả vào thư viện.
- Thêm cảnh, đổi thứ tự bằng kéo thả hoặc nút, nhân bản, xoá và chia cảnh tại vạch phát.
- Chỉnh thời lượng, lấp đầy/giữ toàn ảnh, vị trí, tỷ lệ, xoay và lật ngang.
- Nhiều lớp chữ mỗi cảnh: nội dung, màu chữ/nền, cỡ, vị trí, đậm/thường và căn lề.
- Đứng yên, zoom vào/ra, lướt trái/phải.
- Cắt thẳng, mờ chuyển, trượt ngang và quét ngang.
- Bộ lọc màu, độ sáng, tương phản và bão hoà.
- Chỉ hai tỷ lệ **9:16 và 16:9**, theo yêu cầu mới nhất; FPS và màu nền.
- Xem trước, tua, từng frame, phát/dừng và toàn màn hình.
- Hoàn tác/làm lại, tự lưu trong trình duyệt, lưu/mở JSON.
- Xuất MP4 cục bộ, tiến độ, huỷ và tải file.

## Các bước thực hiện

1. Xoá mã, tài nguyên và sản phẩm video thử nghiệm; giữ lịch sử Git và các công cụ có thể tái sử dụng.
2. Chốt đầu ra, viết phạm vi tính năng và kiến trúc trong tài liệu này.
3. Xây giao diện chỉnh sửa với thư viện tài nguyên, vùng xem trước và bảng thuộc tính.
4. Kết nối thao tác chỉnh sửa, hoàn tác/làm lại, lưu và mở dự án.
5. Hoàn thiện xuất kết quả đúng với đầu ra đã chọn.
6. Kiểm tra thao tác thực tế trên trình duyệt và kiểm tra file xuất.
7. Ghi kết quả kiểm tra, giới hạn và hướng mở rộng trong `docs/`.

## Nguyên tắc triển khai

- Chỉ hiển thị điều khiển đã hoạt động.
- Lỗi phải có thông báo và hướng xử lý rõ ràng.
- Xem trước phải khớp với kết quả xuất.
- Không cài đặt dịch vụ cloud hoặc kết nối tài khoản ngoài trong bản đầu.
- Phân biệt tính năng đã có và dự kiến, không dùng nút giả.

## Tiến độ

- [x] Kiểm tra dự án thử nghiệm và tài liệu nền tảng.
- [x] Ghi nhận yêu cầu mới: ưu tiên ảnh tĩnh.
- [x] Dọn nội dung thử nghiệm.
- [x] Xác nhận đầu ra.
- [x] Xây editor.
- [x] Kiểm tra model thời gian, dữ liệu và API xuất video.
- [x] Kiểm tra giao diện desktop và khung rộng 390 px.
- [x] Xuất MP4 ở độ phân giải mặc định 1080×1920 thành công trước khi dừng kiểm thử tương tác.
- [x] Thu hẹp giao diện và kiểm tra dữ liệu dự án còn hai tỷ lệ 9:16 / 16:9.
- [x] Hoàn thiện mã, tài liệu và bàn giao để người dùng tự test.

Theo yêu cầu mới nhất, dừng kiểm thử tương tác; chỉ chạy kiểm tra mã và build trước khi bàn giao.

## Các giai đoạn sau (chưa triển khai)

1. Nhạc nền, fade âm thanh, nhập phụ đề, thêm mẫu chữ.
2. Timeline nhiều track, keyframe cho lớp chữ và mở rộng tích hợp.
3. Nhập video nguồn, cắt/trim, tốc độ phát.
4. GPT tạo/sửa storyboard bằng cấu trúc dự án JSON.
5. Animation nhân vật và các tích hợp Remotion nâng cao theo nhu cầu thực tế.

## Mở rộng v0.2

Đã triển khai thư viện 81 hiệu ứng gốc của `@remotion/effects` 4.0.537, tham số và xếp chồng/tự động hoá, mở rộng chữ và font riêng, lớp phủ, chuyển động, mặt nạ, chuyển cảnh và keyframe ảnh. Xem [kế hoạch chi tiết](MO-RONG-CHU-HIEU-UNG.md) và [danh mục](DANH-MUC-CHU-HIEU-UNG.md). Người dùng tự test preview/render; lần mở rộng này không khởi động server.

## Dựng tự động và UX v0.3

Luồng chính chuyển thành bộ ảnh + config → tự dựng và xuất MP4. Dùng chung bộ dựng cho web/CLI/hàng đợi. Tinh chỉnh cơ bản chuyển xuống dải cảnh; bảng phải đóng mặc định và chỉ phục vụ nâng cao. Xem [kế hoạch/tiến độ](TRIEN-KHAI-TU-DONG-UX.md) và [hướng dẫn thực tế](TU-DONG-HOA.md).
