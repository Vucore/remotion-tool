# Mở rộng Chữ và Hiệu ứng

## Phạm vi

Giữ editor ảnh thành video, chỉ 9:16 và 16:9. Người dùng tự test giao diện; không khởi chạy server hoặc tự render khi triển khai lần này.

Remotion là nền tảng lập trình nên không có tập hữu hạn của mọi hiệu ứng có thể viết. Bản mở rộng bao phủ toàn bộ effect factory công khai trong gói `@remotion/effects` cùng phiên bản 4.0.537, cộng thư viện chữ, chuyển động, chuyển cảnh và lớp phủ của editor. Không gọi các hiệu ứng tuỳ biến chưa được viết là tính năng đã hoàn thành.

## Các phần triển khai

1. Sinh danh mục effect từ exports/schema của package chính thức. Giao diện có tìm kiếm, nhóm, chỉnh tham số đúng kiểu và xếp chồng có thứ tự. Giữ nguyên factory gốc, không giả lập hiệu ứng gốc bằng CSS.
2. Thời gian bắt đầu/kết thúc hiệu ứng và chuyển động của tham số số theo thời gian.
3. Chữ: quản lý lớp, kiểu chữ, font cục bộ, nền/gradient/viền/bóng, khoảng cách, bố cục, thời gian, animation vào/ra/lặp, chia theo chữ/từ, chữ cong và số đếm.
4. Thêm font từ máy, dùng cùng font trong preview và renderer, lưu tham chiếu trong JSON.
5. Mở rộng chuyển động ảnh, chuyển cảnh có hướng, mặt nạ, lớp phủ ánh sáng/thời tiết/hạt.
6. Tách các bảng thuộc tính ra component riêng; mặc định thu gọn phần nâng cao để giữ giao diện dễ đọc.
7. Chuẩn hoá dữ liệu cũ: thêm giá trị mặc định cho dự án đã lưu, kiểm tra kiểu và giới hạn dữ liệu mới.
8. Cập nhật hướng dẫn, danh mục chính xác và giới hạn tương thích. Chạy kiểm tra TypeScript, ESLint và build.

## Nguyên tắc

- Mọi animation dựa trên frame và FPS, không dùng CSS animation hoặc thời gian thực trong composition.
- Bật/tắt hoặc đổi thứ tự có tác dụng thật; dữ liệu lưu được vào JSON và được backend xác thực.
- WebGL2 và WebGPU được ghi rõ. Lỗi phần cứng/trình duyệt hiển thị để người dùng biết; không âm thầm bỏ hiệu ứng.
- Dùng effect trực tiếp trên ảnh. Chữ dùng CSS/SVG và các animation riêng, không phụ thuộc tính năng HTML-in-canvas còn yêu cầu hỗ trợ trình duyệt.
- Không tự thêm AI, âm thanh, 3D scene, video nguồn hoặc dịch vụ ngoài vào phạm vi lần này.

## Kết quả v0.2

- [x] Đồng bộ và tích hợp đủ 81 factory công khai của package 4.0.537, gồm 11 Canvas 2D, 67 WebGL2 và 3 WebGPU.
- [x] Thư viện có tìm kiếm/nhóm, đúng kiểu tham số, bảng màu mảng, toạ độ UV, nhánh lựa chọn và LUT.
- [x] Xếp chồng, đổi thứ tự, nhân bản, bật/tắt, giới hạn thời gian và tự động hoá nhiều tham số số.
- [x] 12 mẫu chữ; 29 lựa chọn vào/ra và 12 lựa chọn lặp (bao gồm tuỳ chọn không animation).
- [x] Font hệ thống và font nhập từ máy; định dạng, màu/gradient/viền/bóng/khối, chữ cong và số đếm.
- [x] 24 lựa chọn chuyển động ảnh, 28 kiểu nối cảnh, 9 lựa chọn mặt nạ và 20 lớp phủ.
- [x] Keyframe ảnh và đồng hồ nguồn để chia cảnh giữ chuyển động, lớp chữ và hiệu ứng.
- [x] Nạp dự án cũ, kiểm tra dữ liệu mới và cập nhật tài liệu.

Kiểm tra logic/build không chứng minh mọi shader chạy trên mọi GPU. Theo yêu cầu người dùng, không mở server, không kiểm thử tương tác và không render video trong lần mở rộng này.
