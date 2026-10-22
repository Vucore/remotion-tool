# Thiết kế giao diện

## Mục tiêu

Editor vận hành: nhìn rõ video đang dựng, biết đang chỉnh cảnh nào, điều khiển có nhãn tiếng Việt. Ưu tiên desktop; màn hình hẹp xếp bảng điều khiển xuống dưới.

## Bố cục

- Thanh đầu: tên dự án, lưu/mở, hoàn tác/làm lại và xuất video.
- Bên trái: thư viện ảnh với nút nhập ảnh và ảnh thu nhỏ; thêm cảnh bằng một lần nhấn.
- Giữa: video xem trước, lựa chọn tỷ lệ và điều khiển phát.
- Bên phải: thuộc tính của cảnh đang chọn, chia thành Ảnh / Chữ / Hiệu ứng.
- Phía dưới: dải cảnh có ảnh thu nhỏ, số thứ tự, thời lượng, đánh dấu cảnh hiện tại. Kéo sắp xếp, có nút di chuyển để dùng bằng bàn phím.

Trong v0.2, tab Chữ dùng danh sách lớp và các nhóm thu gọn cho nội dung/font, màu, bố cục, timing và số đếm. Tab Hiệu ứng có nhóm chuyển động/chuyển cảnh, tìm kiếm và lọc thư viện gốc, stack tham số, lớp phủ và keyframe ảnh. Chỉ mở thuộc tính lớp đang chọn; điều khiển không áp dụng cho một kiểu lớp phủ được ẩn.

## Ngôn ngữ hình ảnh

Nền trắng xám ấm cho thao tác lâu; vùng xem trước màu than để tách ảnh khỏi công cụ. Điểm nhấn xanh teal cho hành động và cảnh đang chọn. Không dùng hình minh hoạ thay nội dung thật. Bắt đầu bằng trạng thái trống có hướng dẫn nhập ảnh, có ví dụ bằng hình SVG cục bộ để thử luồng.

## Trạng thái bắt buộc

Chưa có ảnh, đang tải, đang lưu, đang xuất, xuất hoàn tất, file sai định dạng, ảnh không còn trên máy, dự án JSON không hợp lệ. Có focus bàn phím rõ ràng, nhãn cho input, tooltip cho nút biểu tượng và hỗ trợ giảm chuyển động giao diện.
