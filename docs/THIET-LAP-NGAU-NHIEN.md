# Ngẫu nhiên chuyển động, chuyển cảnh và vị trí phụ đề

Cập nhật 25/10/2026. Mở **Thiết lập nhanh** bên phải hoặc tab **Sửa** trên điện thoại.

## Thiết kế và triển khai

1. Giữ cách chọn tự động và từng kiểu của bản cũ; thêm chế độ ngẫu nhiên từ các kiểu do người dùng chọn.
2. Dùng mã ngẫu nhiên lưu cùng dự án/mẫu, không gọi `Math.random()` trong composition. Preview và export cùng kết quả; hai nhóm chuyển động/chuyển cảnh có mã riêng.
3. Giữ phạm vi **Toàn video / Cảnh đang xem**, tương thích mẫu/dự án cũ. Lựa chọn riêng của cảnh được lưu trong config để mở lại không mất thiết lập ngẫu nhiên.
4. Đưa vị trí phụ đề ra gần đầu tab, có đặt nhanh và khung kéo/tọa độ thu gọn. Giữ timing voice, cue đã căn và cache TTS/alignment.

## Cách dùng

### Chuyển động và chuyển cảnh

- **Luân phiên / Tự động:** quy tắc mặc định như trước.
- **Chọn một:** bấm một ô để dùng một kiểu.
- **Ngẫu nhiên:** bấm các ô để thêm/bỏ kiểu trong danh sách được dùng. Có thể mở **Tất cả chuyển động / Tất cả chuyển cảnh** để chọn toàn bộ danh mục. Phải giữ ít nhất một kiểu; ô cuối cùng đang chọn không thể bỏ cho đến khi chọn thêm kiểu khác.
- **Chọn tất cả** chọn cả danh mục, gồm Đứng yên/Cắt thẳng. Bấm bỏ các kiểu không muốn dùng.
- Nút biểu tượng **Đảo lại** đổi cách phân bổ cho nhóm đang chỉnh; không thay đổi nhóm còn lại. Có thể ngẫu nhiên trùng lại một phần kết quả cũ. Với hai kiểu và tránh lặp liên tiếp, số chuỗi khác nhau có thể rất ít.
- Hệ thống tránh chọn cùng một kiểu ở hai cảnh liền nhau nếu còn kiểu khác trong danh sách. Cảnh bị chỉnh riêng/khóa vẫn giữ lựa chọn của người dùng; một danh sách chỉ có một kiểu sẽ luôn dùng kiểu đó.
- Chọn lại kiểu, đổi mã hay chỉnh vị trí không cần tạo lại voice. Khi export, hệ thống vẫn kiểm tra cache căn phụ đề theo audio/TXT/model như trước.

### Phụ đề

- **Trên / Giữa / Dưới** đặt tâm ngang 50%, tâm dọc lần lượt 14%, 50%, 87%.
- Mở **Kéo vị trí & tọa độ** để bấm/kéo trên khung minh họa đúng tỷ lệ 9:16 hoặc 16:9, hoặc nhập **Ngang/Dọc phụ đề (%)** từ 0–100.
- Khung hỗ trợ phím mũi tên dịch 1%, Shift + mũi tên dịch 5%. Điểm đặt là tâm lớp chữ; đặt sát mép có thể khiến một phần chữ vượt khung.
- Đổi kiểu chữ hoặc đặt lại thông số nâng cao giữ vị trí đã chọn. Vị trí áp dụng theo phạm vi toàn video/cảnh đang xem.
- Khung minh họa dùng asset mẫu; preview chính hiển thị kết quả trên video khi playhead nằm trong thời gian của cue.

## Dữ liệu và tương thích

- `StoryOptions.motion/transition`: thêm giá trị `random`.
- `motionRandom` và `transitionRandom`: `{ presets, seed }`, lưu cùng workspace/mẫu; mặc định lần lượt Zoom vào/ra + lướt trái/phải, và Fade/Slide/Wipe/Zoom, mã 42.
- `AutoConfig.motion`: dùng policy `seeded`, thêm seed riêng; `transition`: thêm policy/presets/seed. Config cũ tự nhận giá trị mặc định và giữ hành vi cũ.
- Compiler chọn theo seed, vị trí cảnh và kiểu liền trước, lưu kết quả thành kiểu cụ thể trong `Scene`; Remotion chỉ render dữ liệu này. Cache compile có khóa kiểu chuyển cảnh liền trước để không dùng nhầm kết quả khi chỉnh cảnh trước.
- `AutoConfig.overrides` có cấu hình ngẫu nhiên riêng của cảnh. Khi mở lại Project JSON, `optionsFromProject` khôi phục cả danh sách và mã thay vì chỉ các kiểu đã chọn ra.
- Vị trí phụ đề dùng trường `caption.advanced.x/y` hiện có, không tạo thêm định dạng tọa độ hay sửa thời gian cue.

## Kiểm tra

- Năm nhóm regression: cùng kết quả preview/build ở hai tỷ lệ; tránh lặp và danh sách một kiểu; đảo độc lập; round-trip workspace/Project JSON và override từng cảnh; toàn bộ danh mục/validation/mẫu cũ; tọa độ giữ cue, thời lượng voice và khóa TTS.
- Chạy `npm run build`, `npm run lint`, `node --test tests/random-settings.test.mjs tests/story.test.mjs tests/auto.test.mjs`.
- Browser dùng dự án thử riêng, không sửa dữ liệu thật; kiểm tra nhóm chọn/đảo/chọn tất cả, vị trí đặt nhanh, kéo và bàn phím, bố cục desktop/mobile. Không gọi TTS/Whisper hay tải model/thư viện để kiểm tra.

Kết quả: lint/TypeScript và build qua; **42/42 test** trong các nhóm random/story/auto/hiệu năng qua. Detector giao diện không báo lỗi; rà soát UX độc lập: **ship**, trong phạm vi tính năng mới và giao diện hiện có. Server thử cổng 3212 và dữ liệu thử đã được dọn; không thay đổi dữ liệu dự án thật.

Ảnh kiểm tra giao diện (nguồn là screenshot local của workspace thử, đã nhúng provenance): [chuyển động](images/random-motion-desktop.jpg), [chuyển cảnh](images/random-transitions-desktop.jpg), [vị trí phụ đề](images/caption-position-desktop.jpg), [điện thoại — phụ đề](images/caption-position-mobile.jpg), [điện thoại — chuyển động](images/random-motion-mobile.jpg).

Không thêm dependency. Khởi động lại server và tải lại trang sau khi cập nhật.
