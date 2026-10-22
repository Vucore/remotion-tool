# Triển khai nhân vật và tự dựng dễ dùng — v0.5

## Phạm vi đã nhận

Hỗ trợ ba đầu vào: PNG/WebP tách nền; nhân vật tách bộ phận; sprite sheet hoặc chuỗi frame dựng sẵn. Tự động hoá ưu tiên việc lặp lại; chi tiết đặc thù do người dùng đặt vào từng ảnh. Người dùng không cần viết JSON. Theo yêu cầu hiện tại, chỉ sửa code/tài liệu; không cài thư viện, chạy test, server hay render.

## Kế hoạch

1. Thêm schema thư viện nhân vật, instance trong cảnh, action và thiết lập tự động; giữ tương thích dự án cũ.
2. Nhập PNG, nhận diện tên bộ phận và animation sprite từ thư mục; hỗ trợ sheet bằng lựa chọn hàng/cột/FPS nếu tên chưa chứa thông tin. Dùng cùng parser cho web và CLI.
3. Chỉnh vị trí/kích thước bằng chuột ngay trên preview; chọn chuyển động vào/ra và cử động riêng cho mỗi cảnh ở bảng dưới timeline. Nâng cao thu gọn. Sao chép sang mọi cảnh và giữ vị trí khi dựng lại để giảm thao tác lặp.
4. Renderer theo frame cho cả ba loại, thêm tài nguyên vào luồng export; giữ nguyên voice/subtitle.
5. Xem động tác độc lập cho từng asset bằng Remotion Player: phát/tạm dừng, tua, lặp, tốc độ và chọn động tác trước khi áp dụng; thêm xem trong cảnh với voice thật. Nạp/lưu mẫu bằng nút, JSON chỉ ở phần dành cho kỹ thuật.
6. CLI và batch dùng thư mục `characters`; tài liệu hướng dẫn chuẩn bị từng loại tài nguyên và người dùng tự kiểm tra.

Planner tự phân vai, đặt vị trí theo tỷ lệ và chọn động tác theo cue vẫn có dưới dạng **Tự thêm theo mẫu khi dựng**, mặc định tắt. Nhập asset không tự bật planner. Rig có chớp mắt và miệng theo năng lượng WAV; sprite dùng clip dựng sẵn. Chi tiết triển khai và thao tác xem [Nhân vật & vật thể](NHAN-VAT-VA-VAT-THE.md).

## Trạng thái bàn giao code

Đã viết schema tương thích dự án cũ, importer chung web/CLI, planner tuỳ chọn, renderer theo frame, thư viện có xem thử, chỉnh đối tượng bằng chuột ở cảnh, bảo toàn chỉnh tay, mẫu form và tài liệu. Chưa xác nhận chạy thực tế; người dùng tự cài và kiểm tra theo yêu cầu.

Các động tác là thư viện có quy tắc; chưa bổ sung GPT, sinh rig từ ảnh phẳng hoặc sinh video bằng AI. Asset phải đáp ứng cấu trúc tương ứng. Không gán động tác tay/chân cho ảnh PNG nguyên khối.
