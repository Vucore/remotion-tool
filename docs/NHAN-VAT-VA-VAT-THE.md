# Nhân vật, vật thể và xem thử animation — v0.5

## Cách làm việc

Tự động hoá các việc lặp lại: ghép ảnh/WAV/TXT theo số thứ tự, lấy thời lượng voice, căn phụ đề, chuyển cảnh và xuất video. Với phần mang tính đặc thù của từng ảnh, người dùng đặt nhân vật/vật thể và chọn động tác. Công cụ hỗ trợ PNG/WebP tách nền, bộ phận tách rời và sprite dựng sẵn; không cần thêm thư viện cho phần animation này.

1. Ở **Dựng tự động**, nhập ảnh, WAV và TXT nếu có; dựng để có các cảnh.
2. Trong **Nhân vật & vật thể**, chọn **Thêm PNG / sprite** hoặc **Thêm thư mục**. Thêm asset chỉ nhập vào thư viện; không tự đặt lên mọi ảnh.
3. Bấm **Xem động tác** cạnh asset. Khung xem thử có phát/tạm dừng, tua, lặp và tốc độ 0,5×–2×. Chọn động tác để phát lại từ đầu; thay đổi ở đây không sửa video.
4. Bấm **Đặt nhân vật / vật thể vào ảnh**, chọn cảnh trên timeline. Bảng **Nhân vật & vật thể** nằm dưới preview.
5. Chọn asset rồi **Thêm vào ảnh này**. Kéo trực tiếp đối tượng để đặt vị trí; kéo nút tròn ở góc trên bên phải để đổi kích thước. Phím mũi tên di chuyển 1%, Shift + mũi tên 5%; Delete xoá lớp khi khung đối tượng có focus.
6. Chọn **Vào cảnh**, **Ra cảnh**, **Cử động chính**. Bấm **Xem trong cảnh** để phát từ cảnh đang chọn cùng ảnh, chữ và voice. Khi dừng ở bảng này, đối tượng hiển thị tư thế đặt để dễ kéo; bấm Phát sẽ dùng chuyển động thật.
7. Có thể mở **Xem động tác** ngay trong bảng này rồi **Dùng động tác này trong cảnh**. Thao tác dùng động tác mới thay cử động chính, hoặc thay kiểu vào/ra tương ứng. **Đứng yên** xoá chuyển động của đối tượng. Trạng thái chờ và nói minh hoạ chỉ dùng để xem thử.

Mặc định chỉ hiện vị trí, kích thước và lựa chọn chuyển động. **Thời gian, lớp & hiệu ứng vật thể** thu gọn các mục xuất hiện từ/đến, độ rõ, thứ tự lớp, bóng, phát sáng, cường độ và cử động theo voice.

**Dùng vị trí & chuyển động này cho mọi cảnh** sao chép asset đang chọn cùng vị trí, kích thước và hiệu ứng. Thời gian động tác được đổi theo tỷ lệ thời lượng cảnh đích. Nếu cảnh đã có cùng asset, cập nhật một instance hiện có; nếu chưa có thì thêm lớp. Cảnh đủ 4 lớp sẽ được bỏ qua và báo số lượng. Đây là lựa chọn rõ ràng của người dùng, không tự ghi đè khi nhập asset.

## Chuẩn bị 3 loại đầu vào

### 1. PNG/WebP tách nền

Chọn một hoặc nhiều ảnh. Mỗi ảnh thành một asset. Có trượt vào/ra, hiện/mờ dần, bật/thu nhỏ, đung đưa, rung, nhảy, di chuyển qua lại, xoay, lơ lửng, giật mình và vui mừng. Đối tượng chuyển động nguyên khối; không tự tách tay/chân từ ảnh phẳng. Dùng được cho nhân vật, điện thoại, xe, đám mây…

### 2. Bộ phận tách rời

Chọn thư mục một nhân vật, ví dụ:

```text
characters/nhan-vat-a/
  head.png
  body.png
  arm_left.png
  arm_right.png
  leg_left.png
  leg_right.png
  eyes_open.png
  eyes_closed.png
  mouth_open.png
  mouth_closed.png
```

Tối thiểu cần `head` và `body`. Tay, chân, mắt và miệng là tuỳ chọn. Mắt/miệng cần đủ một cặp đóng/mở. Nhận cả tên `dau`, `than`, `tay_trai`, `tay_phai`, `chan_trai`, `chan_phai`, `mat_mo`, `mat_nham`, `mieng_mo`, `mieng_dong`.

Cách chuẩn bị tốt nhất: mọi PNG có cùng kích thước canvas, nền trong suốt, bộ phận ở đúng vị trí như khi ghép nhân vật hoàn chỉnh. Công cụ dùng chung canvas và gán khớp mẫu. Với phần cắt rời kích thước khác nhau, công cụ xếp theo mẫu người; cần xem trước và chỉnh lại bố cục nếu hình thể khác mẫu. Có thể chọn cách xếp trong **Loại tài nguyên & cách chuẩn bị** và sửa vị trí/kích thước/khớp ở **Chỉnh bố cục bộ phận**.

Ngoài chuyển động nguyên khối: có gật đầu khi có đầu; vẫy/chỉ tay khi có tay; đi/chạy khi có đủ hai chân. Có cặp mắt thì chớp mắt; có cặp miệng thì đóng/mở theo năng lượng WAV khi bật **Cử động theo voice cảnh**. Đây là nhịp âm lượng, chưa phải khớp khẩu hình theo âm vị.

### 3. Sprite sheet hoặc chuỗi frame

Tên sheet có thể chứa thông tin để tự nhận:

```text
characters/nhan-vat-b/
  idle_4x2_12fps.png
  walk_6x2_12fps.png
  wave_4x2_12fps.png
  talk_4x2_12fps.png
```

`4x2` = 4 cột × 2 hàng, `12fps` = tốc độ 12 frame/giây. Đọc từ trái sang phải, trên xuống dưới. Các ô phải đều nhau, kích thước ảnh chia hết cho hàng/cột. Nếu tên sheet chưa chứa thông tin, chọn **Sprite sheet / chuỗi frame** và điền hàng/cột/FPS trước khi nhập; số frame 0 dùng hết ô.

Hoặc dùng chuỗi ảnh:

```text
characters/nhan-vat-b/
  idle/001.png
  idle/002.png
  walk/001.png
  walk/002.png
```

Frame được xếp theo số. Một thư mục chỉ gồm `001.png`, `002.png` hoặc `frame_001.png`… cũng được nhận là chuỗi chờ. Tránh trộn nhiều sheet với chuỗi ảnh cho cùng một động tác. Các clip/frame cần cùng tỷ lệ để đổi động tác không bị méo.

Các tên clip hỗ trợ: `idle`, `talk`, `walk`, `run`, `wave`, `point`, `nod`, `jump`, `happy`, `surprised`, `shake`, `float`, `spin`, `enter`, `exit`, `sway`, `move`. Clip có sẵn được phát theo frame; gật/vẫy/chỉ tay/đi/chạy chỉ xuất hiện trong lựa chọn khi asset hỗ trợ. Có thể dùng thêm các chuyển động toàn đối tượng như trượt và rung.

## Xem thử và dùng lại bộ asset

Khung **Xem động tác** dùng chung renderer với video. PNG được chuyển động nguyên khối; rig chuyển động từng phần; sprite phát clip tương ứng hoặc clip chờ đi kèm chuyển động toàn đối tượng. Với clip có sẵn, khung xem hiển thị số frame, FPS và thời lượng gốc. Clip không lặp được co thời gian vào khoảng cử động đã đặt trong cảnh. Bản xem riêng không phát WAV của dự án; mục **Nói · nhịp minh hoạ** dùng nhịp giả để xem miệng/clip talk. Muốn kiểm tra theo voice thật, dùng **Xem trong cảnh**.

Sau khi chỉnh rig hoặc nhập sheet bằng hàng/cột thủ công, chọn **Lưu mô tả bộ để dùng lại → Tải mô tả bộ**. Công cụ sinh `character.json`; đặt vào thư mục gốc của bộ, giữ nguyên cấu trúc file nguồn. Lần sau chọn thư mục là nhận lại thông tin. Người dùng không cần tự viết file này. Mỗi thư mục bộ chỉ có một `character.json`; không lồng các mô tả vào nhau.

Trong gói đầu vào đầy đủ, đặt asset dưới thư mục `characters/`, `actors/` hoặc `nhan-vat/` để tách khỏi ảnh cảnh. Nếu nhập asset riêng bằng nút trong thư viện thì không cần tên thư mục đặc biệt.

## Tự động hoá tuỳ chọn

**Tự thêm theo mẫu khi dựng** mặc định tắt. Bật khi nhiều cảnh dùng một bố cục tương tự: chọn asset, mức cử động, phân vai, người nói; vị trí/kích thước/kiểu vào được thu gọn. Có thể chỉ định cảnh, câu và động tác bằng form; mốc câu lấy từ phụ đề đã căn. Đây là planner theo quy tắc và seed, chưa có GPT đọc nội dung để hiểu ý nghĩa cảnh.

Cảnh chỉnh tay được đánh dấu giữ. Khi dựng lại với **Giữ cảnh đã chỉnh**, cả vị trí/động tác đã đặt và thao tác cố ý xoá hết đối tượng được giữ. Nếu bỏ giữ, cảnh sẽ được tạo lại theo mẫu hiện tại. Nhập một bộ ảnh mới thay toàn bộ cảnh thì cần bố trí lại các chi tiết riêng của bộ ảnh mới.

Chọn mẫu dựng bằng các lựa chọn thông thường, dùng **Lưu mẫu dựng này** và **Mở mẫu đã lưu** để tái sử dụng. JSON nằm trong **Thiết lập bổ sung → Dành cho kỹ thuật**. Mẫu lưu thiết lập dựng, không gói ảnh/voice/asset hay các vị trí riêng của từng cảnh. **Lưu dự án** giữ toàn bộ vị trí, asset, voice và các chỉnh sửa; cần giữ cả thư mục `data/` chứa file media.

CLI/hàng đợi dùng cùng compiler và nhập các bộ từ `characters.directories`. [Config CLI mẫu](examples/characters-edit.config.json) bật chế độ tự thêm theo mẫu. Đường dẫn tương đối tính từ thư mục chứa config; giữ nguyên cấu trúc các bộ như trên. Web không cần dùng JSON mẫu này.

## Cài và tự kiểm tra

Phần asset dùng các thư viện Node/Remotion đã có, không thêm gói mới. Nếu chưa cài dự án:

```sh
npm install
npm run dev
```

Voice tự căn câu dùng môi trường Python riêng do uv quản lý:

```sh
npm run setup:voice
```

Xem [hướng dẫn uv đầy đủ](VOICE-VA-PHU-DE.md). Không dùng voice thì không cần cài Python/model. Dừng server bằng `Ctrl+C`.

Theo yêu cầu chỉ code, v0.5 chưa chạy lint/TypeScript/build/test, cài môi trường, server hoặc render. Khi tự test, thử một asset mỗi loại: xem thử động tác; thêm/kéo/đổi kích thước một cảnh; sao chép sang cảnh khác thời lượng; lưu/mở dự án; dựng lại với giữ cảnh; xuất một video ngắn ở cả 9:16 và 16:9. Có thể dùng `npm run lint`, `npm run build` và `npm test` để kiểm tra mã sau khi cài.

Giới hạn: 20 bộ asset, 1.200 ảnh/frame tổng thư viện, 4 đối tượng/cảnh; tối đa 240 frame/clip; PNG/WebP tối đa 25 MB/ảnh. Chưa có auto-rig từ ảnh phẳng, mesh deformation, xương/IK, nhập atlas không đều, điều khiển keyframe tự do cho mọi thuộc tính hoặc sinh animation mới bằng AI. Không chia đôi cảnh đã có voice/đối tượng; chỉnh thời lượng hoặc dùng hai cảnh riêng.
