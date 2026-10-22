# Triển khai dựng tự động và chỉnh nhanh

Ngày bắt đầu: 22/10/2026. Theo yêu cầu thực hiện của người dùng sau bản đề xuất.

- [x] Bộ kiểm tra config v1 và bộ dựng dùng chung; kết quả ổn định theo seed, sắp xếp tên tự nhiên, hai tỷ lệ, thời lượng theo ảnh/tổng, chữ/màu/chuyển động/chuyển cảnh/effect và ngoại lệ.
- [x] Lưu config và cảnh giữ chỉnh sửa trong dự án, đọc được dự án cũ, hoàn tác cả lần dựng.
- [x] CLI nhận bộ ảnh + config, nối engine xuất MP4, ghi dự án/báo cáo; hàng đợi và tiếp tục theo hash. Đã kiểm tra lập bản dựng, chưa chạy xuất thật trong lượt này.
- [x] Luồng web nhập ảnh/config → tạo và xuất video, hoặc dựng để xem trước; lưu config dùng lại và lấy thiết lập từ cảnh mẫu.
- [x] Chỉnh nhanh ảnh/chữ/chuyển động/hiệu ứng trên dải dưới; nút chuyển cảnh thực sự tương tác; kéo đổi thời lượng, kéo preset vào cảnh, chọn/kéo ảnh và chữ ở preview; nâng cao đóng mặc định.
- [x] Lint, TypeScript, build và 28 kiểm tra logic đã qua. Không chạy server thường trực hoặc render video trong phiên này; người dùng sẽ tự test giao diện/video theo yêu cầu trước đó.

Giữ ngôn ngữ hình ảnh của editor hiện tại. Không thêm dịch vụ GPT/API bên ngoài; cấu trúc config là đầu vào để có thể nối GPT sau.

Hướng dẫn và giới hạn thực tế: [Tự động hoá](TU-DONG-HOA.md), [kiểm tra](KIEM-TRA.md). Đây là dải cảnh có chỉnh nhanh, chưa phải timeline nhiều track/keyframe hay giao diện chọn nhiều cảnh. Có áp dụng cho một cảnh hoặc mọi cảnh.
