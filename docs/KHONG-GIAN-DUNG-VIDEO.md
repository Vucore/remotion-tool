# Không gian dựng video và thiết lập nhanh

## Yêu cầu

Không gian kiểu editor: tài nguyên bên trái, preview giữa, thiết lập nhanh bên phải, timeline rộng phía dưới với thước thời gian, playhead và ba hàng ảnh/voice/phụ đề. Giữ tự động dựng và ghép số; giảm đoạn hướng dẫn dài trên màn hình.

## Triển khai

1. Preview tạm tự sinh từ bộ đầu vào, phát ảnh/WAV ngay; cue ước lượng được ghi rõ và không thay kết quả căn câu khi xuất.
2. Timeline dùng chính Project đang preview: vị trí/độ dài theo thời gian, waveform từ envelope WAV thật, clip từng câu phụ đề, click/drag thước để tua, zoom và chạy thử.
3. Bốn tab thiết lập toàn video: chuyển động ảnh, chuyển cảnh, lớp phủ, phụ đề. Gallery mẫu và preview trực tiếp; thông số ít dùng đặt trong mục mở rộng.
4. Toàn bộ catalog lớp phủ hiện có trong engine được đưa vào gallery; chọn nhiều lớp, tối đa tám lớp theo schema hiện tại. Không tuyên bố bao phủ mọi hiệu ứng có thể lập trình thêm bằng Remotion.
5. Lưu/mở mẫu bao gồm thiết lập mới, đọc được mẫu cũ. Thay hiệu ứng giữ timing căn sẵn khi còn khớp lời đọc, không bắt chạy lại model khi chỉ xem thử.
6. Xuất vẫn kiểm tra ghép số và chạy căn câu theo WAV/TXT bằng backend hiện có. Không cài môi trường mới hoặc render demo dài trong lượt triển khai.

## Hoàn thành

Đã thay giao diện, thêm `QuickSettings.tsx` và `Timeline.tsx`, bỏ `Storyboard.tsx` không còn dùng. Preview dùng cùng composition với export; Project tạm chỉ để chạy thử. Đủ catalog 20 loại lớp phủ, 28 chuyển cảnh, 24 chuyển động ảnh. Tám lớp tối đa theo schema, không phải tám loại trong gallery. Caption có bốn kiểu, màu/cỡ/font/vị trí và năm kiểu xuất hiện.

Build/TypeScript/lint và sáu kiểm tra tập trung đã qua. Đã kiểm tra trong trình duyệt bằng bộ 3 ảnh + 3 WAV + TXT, phát/dừng, cue-seek, đổi kiểu phụ đề và ghép hai lớp phủ; desktop và khung 390px. Detector không có phát hiện. Không chạy model voice hoặc render lại MP4; không cài thêm dependency.

## Bỏ bộ chọn phong cách và rà soát thông số (trước v0.8)

Rà soát bên dưới là trạng thái trước lượt mở rộng. Xem [thiết lập và layout v0.8](MO-RONG-THIET-LAP-VA-LAYOUT.md) cho phần đã bổ sung.

Theo yêu cầu tiếp theo, bỏ ba phong cách trên preview và CSS liên quan. Người dùng chọn trực tiếp ở bốn tab. Giữ trường style trong bộ đọc mẫu cũ để không làm hỏng dự án/mẫu đã lưu; không còn nút chọn style trên giao diện. Chế độ Tự động vẫn đọc giá trị cũ nếu có; chọn một kiểu cụ thể để ghi đè.

Đủ danh mục không đồng nghĩa đủ mọi thông số. Đối chiếu `QuickSettings.tsx` với `model.ts`, `catalog.ts` và `auto/story.ts`:

| Nhóm | Đang có trên web | Thông số engine chưa mở trên web |
| --- | --- | --- |
| Chuyển động ảnh | 24 lựa chọn, luân phiên tự động, mức chuyển động, fit, thời lượng ảnh không voice | Tốc độ, easing, mốc bắt đầu/kết thúc chuyển động, keyframe và tâm ảnh riêng |
| Chuyển cảnh | 28 lựa chọn, tự động, hướng, thời gian | Easing; ghi đè từng điểm nối |
| Lớp phủ | 20 loại, tối đa 8 loại khác nhau, cường độ/màu/tốc độ/kích thước | Bật/tắt giữ lớp, thứ tự lớp, seed, mốc bắt đầu/kết thúc/offset riêng |
| Phụ đề | 4 kiểu, bật/tắt, màu/nền/cỡ/font/vị trí, 5 animation xuất hiện, giới hạn ký tự câu | Toàn bộ animation chữ, animation biến mất, easing/thời gian/stagger/loop, căn lề/giãn dòng/giãn chữ, viền/đổ bóng/độ trong và các thông số TextLayer còn lại |

Một số thanh kéo web cũng có khoảng giá trị hẹp hơn schema: mức chuyển động 0–30 so với 0–100; thời lượng ảnh 1–15 giây so với 1–300; tốc độ/kích thước lớp phủ tới 3 so với 5; cỡ chữ 24–80 so với 20–100; độ dài câu 40–140 so với 40–240. Chưa bổ sung các điều khiển này trong lượt bỏ phong cách. Các thiết lập hiện áp dụng toàn video, chưa chỉnh riêng theo cảnh/câu/lớp có timing.
