# Mở rộng thiết lập và layout

## Phạm vi

Mở toàn bộ danh mục animation chữ hiện có, thêm chuyển động theo đường cong/phối hợp/đàn hồi và các chuyển cảnh phối cảnh. Các tham số ảnh, chuyển cảnh và trình bày phụ đề được chỉnh trực tiếp, nâng cao thu gọn. Giữ WAV/TXT sở hữu timing phụ đề; không biến công cụ thành trình cắt voice thủ công.

Ô tính năng chạy demo bằng chính hàm render của video khi rê chuột hoặc focus bàn phím. Theo yêu cầu cập nhật, dùng hình minh họa cố định A/B, không lấy ảnh dự án. Chuyển động giảm khi hệ điều hành yêu cầu reduced motion. Demo không chạy hàng chục Player cùng lúc.

Kéo ranh giới tài nguyên/preview/thiết lập và chiều cao timeline. Có giới hạn kích thước, hỗ trợ bàn phím, lưu kích thước trong trình duyệt và khôi phục mặc định. Trên màn hình nhỏ tiếp tục đổi panel bằng tab.

## Thực hiện

1. Mở rộng catalog và renderer, giữ định dạng dự án cũ.
2. Mở rộng StoryOptions và nối cùng cấu hình cho preview, căn phụ đề và export.
3. Gallery demo và thiết lập nâng cao theo nhóm.
4. Layout có thanh kéo, bàn phím và lưu trạng thái.
5. Build/kiểm tra tập trung và một lượt kiểm tra giao diện; không cài môi trường/model hoặc render dài.

“Đầy đủ” trong bản này là danh mục và thông số được công cụ công bố; Remotion vẫn có thể lập trình thêm hiệu ứng mới, không có danh sách mọi hiệu ứng hữu hạn.

## Kết quả v0.8

- 33 lựa chọn ảnh: thêm đường cong, zigzag, số 8, zoom + pan, zoom + xoay, đàn hồi, nhấn tâm. Mở tốc độ/easing/bắt đầu/độ dài/lệch pha, vị trí/tỷ lệ/góc/lật/opacity/mask và tối đa 100 keyframe. Chọn tâm zoom trực tiếp trên ảnh thật.
- 38 lựa chọn chuyển cảnh: thêm lật trang, cross-zoom, crosswarp, swap, blur slide, cube, dreamy zoom, zoom in/out, dissolve, push cut. Renderer nội bộ dùng cặp style incoming/outgoing; đây là các biến thể CSS của công cụ, không phải tuyên bố giống hệt shader/presentation chính thức của Remotion.
- 14 kiểu chữ (12 preset engine cộng nền tối và chữ đơn giản), toàn bộ 29 lựa chọn animation vào/ra và 12 lựa chọn lặp. Mở các tham số trình bày TextLayer: timing animation, stagger/easing, font/màu/cỡ, bố cục, gradient, viền/bóng/glow, chữ cong. Đồng hồ cue và nội dung vẫn do WAV/TXT quyết định, không có bộ đếm số thay lời đọc.
- Phạm vi Toàn video/Cảnh N cho ba nhóm trên. Ngoại lệ theo tên ảnh, lưu trong preset và chuyển sang AutoConfig.overrides (scene + textStyle) để preview, căn voice, xuất và mở lại dự án cùng dùng được. Lớp phủ, độ dài câu và thời lượng mặc định vẫn chung.
- Demo A/B tự vẽ bằng SVG tại `public/samples/demo-a.svg`, `demo-b.svg`; chữ chạy cùng TextAtFrame. Không thêm thư viện hoặc tạo asset bằng AI cho ô minh họa.
- Ba thanh kéo, giới hạn theo viewport, bàn phím/nhấp đúp, lưu kích thước và menu khôi phục bố cục. Mobile dùng tab panel và vẫn đổi chiều cao timeline.

Parallax tiền cảnh/hậu cảnh thật cần nhiều lớp nguồn hoặc tách nền; bản một ảnh/cảnh không giả vờ tự tách chiều sâu. Tô sáng từng từ là animation trong cue, không phải kết quả căn WAV ở mức từng từ.

## Kiểm tra

Build, TypeScript, ESLint và 28 kiểm tra story/advanced/auto đã qua. Fixture alignment kiểm tra style theo cảnh cùng cue và thời lượng voice, không chạy model thực tế. Đã kiểm tra desktop và khung điện thoại 390px, drag ba thanh kéo, đổi kích thước bằng bàn phím, lưu kích thước qua reload, chọn animation chữ/chuyển cảnh mới, tách thiết lập cảnh 1 khỏi cảnh 2, phát/dừng preview. DOM gallery chỉ dùng demo-a/demo-b; console không có lỗi. Ảnh giao diện cập nhật trong `docs/images/`. Không cài thêm thư viện hoặc render MP4; server kiểm tra đã dừng.
