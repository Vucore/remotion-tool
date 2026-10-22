# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Web editor tiếng Việt để người dùng ghép ảnh tĩnh thành video, dựa trên Remotion.

## Capabilities and Constraints

Ưu tiên nhập ảnh, sắp xếp cảnh, thời lượng, chữ, chuyển động cơ bản, chuyển cảnh, xem trước và xuất MP4. Chưa có GPT. Kế hoạch và tài liệu dự án đặt trong `docs/` theo yêu cầu người dùng.

v0.3 ưu tiên bộ ảnh + config để tự dựng và xuất MP4 hoàn toàn; cùng engine dùng cho web, CLI và hàng đợi. Editor dành cho tinh chỉnh ngoại lệ, điều khiển cơ bản ở dải cảnh và bảng nâng cao đóng mặc định. Chỉ tỷ lệ 9:16/16:9.

v0.4 thêm đầu vào ảnh + nhiều WAV + một TXT đánh số mục. Một cảnh = một ảnh/WAV/mục text cùng số. WAV quyết định thời lượng; forced alignment local căn phụ đề từng câu. Giữ trọn lời đọc qua chuyển cảnh, chạy cùng luồng trên web và CLI. Người dùng tự cài môi trường Python bằng uv và tự kiểm tra kết quả video.

v0.5 thêm nhân vật/vật thể từ PNG/WebP tách nền, bộ phận và sprite. Tự động hoá tác vụ lặp lại; người dùng kéo vị trí, đổi kích thước và chọn chuyển động riêng trong từng cảnh. Có xem thử animation độc lập trước khi áp dụng, phát cả cảnh, sao chép giữa cảnh và giữ chỉnh tay khi dựng lại. Tự thêm/phân vai theo mẫu là tuỳ chọn, mặc định tắt. Người không biết kỹ thuật dùng form và mẫu đã lưu; JSON thu gọn. Không cài môi trường hoặc chạy kiểm tra/server/render trong lượt triển khai theo yêu cầu người dùng.
