# Không gian dựng video v0.8

Giữ nhận diện Khung: nền trắng ngà, chữ xanh tối, nút xanh lá. Chuyển từ form dài sang không gian editor toàn cửa sổ để xem video và timeline cùng lúc.

- Header: tên dự án, tỷ lệ, menu Tệp, một nút Xuất video.
- Trái: ba đầu vào riêng, gallery ảnh, TXT và nhân vật trong mục mở rộng.
- Giữa: preview lớn, trạng thái timing, căn phụ đề, tiếng/toàn màn hình. Không có bộ chọn phong cách; chọn hiệu ứng trực tiếp tại bốn tab bên phải.
- Phải: bốn tab Chuyển động, Chuyển cảnh, Lớp phủ, Phụ đề; các mẫu trực quan và thông số chi tiết thu gọn.
- Dưới: timeline rộng, thời gian, playhead, Play, zoom và ba hàng ảnh/voice/text. Clip theo đúng độ dài thời gian; ảnh xanh, voice xanh lá, câu text vàng nhạt.

Ít câu hướng dẫn trên màn hình; nhãn ngắn, tooltip cho icon, lỗi đầu vào nằm cạnh tài nguyên. Thay đổi mẫu có hiệu lực ngay trong preview, không bắt bấm dựng. Cue chưa căn được đánh dấu ước tính; xuất vẫn chạy pipeline căn thật.

Tab lớp phủ có đủ 20 loại hiện có trong engine, tìm kiếm/lọc và danh sách các lớp đang dùng. Tối đa 8 lớp; bấm một lớp đã chọn để bỏ, chọn tên lớp đang dùng để chỉnh cường độ. Màu/tốc độ/kích thước thu gọn. Không mở sẵn một bảng dài tham số.

Ảnh/voice/TXT ghép theo số. Timeline dùng để xem/tua và mở đúng tab thiết lập, không yêu cầu chỉnh từng clip. Không thêm cut/trim/mix nhiều track. Nhân vật và menu mẫu/dự án vẫn được giữ.

Ở màn hình nhỏ, ba nút Tệp/Video/Sửa đổi panel; timeline luôn hiển thị. Panels cuộn độc lập, không đẩy preview/timeline ra ngoài cửa sổ.

Hai thanh kéo dọc và một thanh kéo ngang có con trỏ đúng hướng, hỗ trợ bàn phím/nhấp đúp đặt lại. Kích thước lưu riêng khỏi nội dung dự án. Cột hẹp tự xếp nút upload xuống hàng; cửa sổ nhỏ tự giới hạn kích thước để preview còn dùng được.

Ô chuyển động/chuyển cảnh/chữ có demo khi hover hoặc focus, dùng hình minh họa A/B cố định thay vì ảnh dự án. Chỉ ô đang tương tác chạy requestAnimationFrame; reduced motion dùng hình tĩnh. 33 lựa chọn chuyển động, 38 chuyển cảnh, 14 kiểu chữ, 29 lựa chọn animation chữ vào/ra và 12 lựa chọn lặp. Điều khiển ảnh/timing/keyframe, kiểu chữ/viền/bóng được nhóm trong details đóng mặc định. Trường số đi kèm slider để chọn chính xác. Chọn phạm vi toàn video/cảnh ở đầu bảng; tên file giúp tránh sửa nhầm cảnh, có nút quay lại thiết lập chung.
