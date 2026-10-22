# Kết quả kiểm tra và giới hạn

## Kiểm tra v0.1 trước lần mở rộng

- ESLint, TypeScript và build giao diện.
- 9 bài kiểm tra model: thời lượng chồng lấn, giới hạn chuyển cảnh, đổi FPS, chia cảnh, đổi thứ tự, lưu/mở JSON và từ chối dữ liệu sai.
- API cục bộ: nhận ảnh, từ chối file không phải ảnh, từ chối dự án rỗng, nguồn yêu cầu không hợp lệ, xuất MP4 và huỷ tác vụ.
- Xuất thực tế H.264/yuv420p, 360×640, 30 fps, đúng 3,5 giây.
- Xuất từ giao diện ở 1080×1920, 30 fps, đúng 11 giây. Kiểm tra metadata bằng Remotion Renderer.
- Trên trình duyệt: nhập JPG từ máy, sửa chữ, nhân bản, hoàn tác, đổi sang video ngang, tải file JSON và xuất MP4.
- Bố cục desktop và khung rộng 390 px. Ảnh chụp: [khung hẹp](images/editor-mobile.png).

Ảnh chụp và kết quả render trên thuộc bản cơ bản v0.1, không phải bằng chứng render các shader mới.

## Kiểm tra v0.2

- ESLint, TypeScript và build giao diện.
- 16 bài kiểm tra logic: model cũ, 81 bộ tham số mặc định của hiệu ứng chính thức, nâng cấp dự án cũ, lưu/mở kiểu chữ/font/keyframe, tự động hoá tham số, thời gian bật/tắt, chia cảnh giữ đồng hồ nguồn, mọi kiểu chuyển động/chuyển cảnh/easing trả kết quả hữu hạn và từ chối dữ liệu sai.
- Kiểm tra effect factory chỉ tạo descriptor và xác thực tham số, không khởi tạo GPU.
- Theo yêu cầu người dùng, không chạy server, không kiểm thử giao diện và không render video ở lần mở rộng này. Người dùng tự kiểm tra preview, font, hiệu ứng GPU và MP4 trên máy thực tế.

## Giới hạn hiện tại

- Chỉ ảnh JPG, PNG, WebP; chưa có video nguồn, âm thanh, phụ đề tự động hoặc GPT.
- Một dải cảnh nối tiếp; chữ thuộc từng cảnh. Có keyframe ảnh, chưa có timeline nhiều track hoặc keyframe tự do cho mọi thuộc tính chữ.
- Chưa có animation nhân vật.
- Thư viện tối đa 300 ảnh, 300 cảnh, 30 lớp chữ mỗi cảnh; ảnh tối đa 25 MB và 30.000 pixel mỗi chiều.
- Tối đa 24 effect gốc, 8 lớp phủ và 100 keyframe ảnh mỗi cảnh; 30 font mỗi dự án. Font tối đa 5 MB, LUT inline tối đa 2 MB.
- Thời lượng cảnh 0,5–300 giây, video tối đa một giờ; dự án JSON gửi lên server tối đa 16 MB. localStorage có giới hạn riêng của trình duyệt: dự án nhiều LUT có thể phải lưu JSON thay vì tự lưu.
- Hoàn tác giữ tối đa khoảng 80 thay đổi. Kéo slider nhiều bước được ghi thành nhiều thay đổi.
- JSON không chứa file ảnh/font. Cần giữ `data/uploads/` và `data/fonts/` để mở lại đầy đủ. LUT inline có trong JSON.
- Mỗi lần chạy server chỉ xuất một video; sau khi huỷ có thể cần đợi vài giây để giải phóng tác vụ.
- Tốc độ preview/render phụ thuộc kích thước ảnh, độ phân giải và máy. Chưa đánh giá tải dài hoặc triển khai công khai.
- Chưa có đóng gói desktop, tài khoản người dùng hoặc cộng tác nhiều người. Server chỉ phục vụ cục bộ.

## Tương thích hiệu ứng và chữ

- 81 factory chính thức gồm 11 Canvas 2D, 67 WebGL2 và 3 WebGPU (`cylinder`, `sphere`, `pageTurn`). WebGL2/WebGPU phụ thuộc trình duyệt, GPU và driver. Giao diện khoá nút thêm WebGPU nếu trình duyệt không công bố API; có API không có nghĩa driver chắc chắn hỗ trợ.
- Renderer được cấu hình OpenGL `angle` cho WebGL2. Ba hiệu ứng WebGPU có thể báo không hỗ trợ trong môi trường render; không tự thay thế bằng hiệu ứng khác hoặc bỏ qua.
- Hiệu ứng gốc áp dụng lên ảnh, không tự áp lên chữ. Chữ dùng CSS/SVG và bộ animation riêng, tránh phụ thuộc HTML-in-canvas. Lớp phủ nằm trên ảnh và dưới chữ; chuyển cảnh áp lên cả cảnh.
- Các hiệu ứng gốc chạy theo thứ tự trong danh sách, sau đó bộ chỉnh màu cơ bản và biến đổi bố cục ảnh được áp dụng. Các mặt nạ cắt vùng khung ảnh.
- Chữ cong là một dòng theo cung SVG; dùng animation cho cả đường chữ. Các animation từng ký tự/từ được dùng với chữ thẳng. Khối 3D chữ là các lớp bóng giả chiều sâu, không phải mô hình 3D.
- Bộ mẫu chuyển cảnh của editor được dựng bằng CSS/SVG và công thức theo frame; không tuyên bố là toàn bộ presentation của gói `@remotion/transitions`.
- Font hệ thống có thể khác giữa các máy. Dùng font nhập từ máy để giữ cùng tài nguyên font cho preview và render.
- Remotion cho phép viết hiệu ứng tuỳ biến không giới hạn. Danh mục hiện tại bao phủ toàn bộ effect factory công khai của package đã ghim phiên bản; không bao gồm mọi shader/animation tưởng tượng được, JavaScript tuỳ ý, morph glyph, text theo đường SVG tự vẽ hoặc 3D scene tuỳ biến.

## Các lệnh người dùng có thể tự chạy

```sh
npm run dev
npm run lint
npm test
```

Khi server đang chạy, có thể dùng `node scripts/smoke.mjs` để chạy kiểm tra tích hợp có xuất video thật. Script tạo file trong `data/` và `test-results/`, đều đã được bỏ qua trong Git.
