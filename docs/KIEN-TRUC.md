# Kiến trúc editor

## Phạm vi

Đầu ra đã được người dùng xác nhận: ghép ảnh tĩnh thành video. Đây là editor cho video từ ảnh, chưa phải công cụ chỉnh sửa video nguồn hoặc chỉnh ảnh chuyên sâu.

Chỉ hai tỷ lệ: dọc 9:16 (mặc định 1080×1920) và ngang 16:9 (1920×1080). Bộ kiểm tra JSON từ chối các tỷ lệ khác.

## Luồng thao tác

Nhập ảnh → thêm vào danh sách cảnh → sắp xếp và chỉnh thời lượng → chỉnh ảnh/chữ/chuyển động/chuyển cảnh → xem trước → lưu dự án hoặc xuất MP4.

## Thành phần

- React + TypeScript: giao diện editor.
- Remotion Player: xem trước với cùng composition dùng để render.
- Remotion Renderer và Bundler: xuất H.264 MP4 cục bộ.
- Node HTTP server: phục vụ giao diện, nhận file ảnh và quản lý tác vụ xuất.
- esbuild: build giao diện; không cần framework ứng dụng khác cho bản cục bộ này.
- Dữ liệu dự án JSON: lưu cấu hình, danh sách cảnh và các lớp chữ. Tài nguyên được lưu trên máy trong `data/`.

## Mô hình

- Project: tên, chiều rộng/cao, FPS, màu nền, danh sách cảnh, thư viện ảnh và font.
- Asset: ID, tên, đường dẫn ảnh và kích thước gốc.
- Scene: ảnh, thời lượng, bố cục, bộ lọc, preset/keyframe, mặt nạ, chuyển cảnh, các lớp chữ, stack effect chính thức và lớp phủ.
- Text: nội dung, font, bố cục, màu/viền/bóng, thời gian, animation vào/ra/lặp, cung chữ và số đếm.
- EffectSpec: factory ID, tham số đúng schema, khoảng thời gian và automation cho tham số số.
- FontAsset: tên, ID riêng và đường dẫn file cục bộ.

Thời lượng cảnh tính bằng frame nguyên khi dựng video. Chuyển cảnh sử dụng phần chồng lấn; thời lượng tổng trừ phần chồng lấn đó.

## Lưu và xuất

- Tự lưu cấu hình vào trình duyệt; tải JSON để sao lưu hoặc chuyển dự án.
- Ảnh nhập được lưu vào `data/uploads/`, không lưu ảnh nhị phân trong localStorage.
- Xuất MP4 có tiến độ, huỷ, báo lỗi và tải file khi hoàn thành.
- Server chỉ lắng nghe loopback. Chưa có đăng nhập, chia sẻ hoặc triển khai công khai.

## Hiệu ứng và font v0.2

- `scripts/sync-effects.mjs` đọc exports của package đã ghim, tạo metadata/schema và import registry tĩnh cho đủ 81 factory. `npm run sync:effects` dùng để đồng bộ lại sau khi chủ động nâng phiên bản.
- `src/effects/runtime.ts` tạo descriptor gốc và tính tham số theo frame; `CanvasImage` áp dụng stack lên ảnh đúng kích thước composition.
- `TextRender.tsx`, `Overlays.tsx` và `animation.ts` dựng các animation CSS/SVG từ frame và FPS. Không có CSS animation, setInterval hay random theo thời gian thực trong composition.
- Font riêng lưu trong `data/fonts/`. `FontLoader` dùng FontFace và delayRender để nạp font cần dùng. Backend chuyển URL thành tuyệt đối khi render.
- Tài nguyên ảnh/font/mẫu cho phép CORS từ hai cổng render loopback 3231/3232 để canvas đọc pixel và font nạp được; API vẫn từ chối origin ngoài editor. Không tắt web security của Chromium.
- Các lớp có offset/span nguồn để chia cảnh giữ tiến trình chữ, effect và chuyển động ảnh. Keyframe ảnh dùng thời gian nguồn khi đã chia.
- `panels/TextPanel.tsx`, `EffectsPanel.tsx` và `Controls.tsx` tách bảng thuộc tính khỏi App. Các nhóm nâng cao thu gọn, có tìm kiếm và lọc nhóm cho effect.

## Mở rộng sau

Âm thanh và phụ đề; timeline nhiều track; keyframe chữ; video nguồn; GPT; shader/3D/animation tuỳ biến khác. Đây là các mục dự kiến.

## Dựng tự động v0.3

- `src/auto/config.ts` chuẩn hoá/kiểm tra config v1, registry mẫu có phiên bản và tạo config từ cảnh mẫu.
- `src/auto/compile.ts` là bộ dựng dùng chung, nhận config và danh sách Asset đã biết kích thước. Tạo Project và báo cáo; ID dựa trên tên, chuyển động/lớp phủ dựa trên seed. Kiểm tra bằng `parseProject` trước khi xuất.
- Project v1 thêm trường `automation` tuỳ chọn chứa config và danh sách cảnh giữ. Dự án cũ vẫn đọc được. Lịch sử của editor giữ cả dữ liệu này; dựng lại là một lần commit.
- `src/editor/AutoPanel.tsx` nhận bộ ảnh/config, ghi config dùng lại, dựng xem trước hoặc gọi thẳng API xuất hiện có với Project vừa dựng.
- `QuickPanel.tsx` phục vụ thao tác cơ bản ở dải dưới. `PreviewEditor.tsx` đặt vùng chọn/kéo ngoài composition, không lọt vào MP4.
- `scripts/auto-edit.mjs` đọc thư mục/captions, lưu ảnh theo hash và gọi cùng compiler. Hàng đợi chạy tuần tự, có báo cáo/tiếp tục theo hash. `--plan` không tạo server hoặc Chromium.
- `scripts/render-project.mjs` dùng chung bởi server và CLI. CLI chỉ bật server tài nguyên tạm trong lúc render và đóng sau đó; web vẫn dùng server loopback của editor. Bundle tách theo PID để hai tiến trình không cùng ghi một thư mục.
- `scripts/image-info.mjs` đọc kích thước PNG/JPG/WebP từ header, giới hạn kích thước trước khi đưa vào renderer. Việc giải mã đầy đủ được thực hiện khi render/preview.

Xem [cấu hình và quy tắc phân bổ thời lượng](TU-DONG-HOA.md), gồm giới hạn focus khi kết hợp native effect.
