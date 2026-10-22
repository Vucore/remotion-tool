# Hướng dẫn sử dụng

## Chạy công cụ

Yêu cầu Node.js 22.13 trở lên (Node 24 đã được kiểm tra).

```sh
npm install
npm run dev
```

Mở <http://127.0.0.1:3210>. Bản phát triển theo dõi thay đổi giao diện; tải lại trình duyệt sau khi sửa mã. Sửa model/backend thì khởi động lại lệnh dev.

Để chạy bản build:

```sh
npm run build
npm start
```

Dừng bằng `Ctrl+C` trong terminal. Nếu cổng đang dùng, chạy `PORT=3211 npm run dev` rồi mở địa chỉ được in ra.

## Dựng tự động: luồng chính v0.3

Chọn **Dựng tự động** → nhập bộ ảnh và config → **Tạo và xuất MP4**. Không cần tạo/chỉnh từng cảnh. Có ba mẫu dựng để bắt đầu; config lưu lại dùng được với bộ ảnh khác. **Chỉ dựng để xem trước** không xuất video. JSON và các thiết lập nâng cao đóng mặc định.

Xem [hướng dẫn config, nội dung chữ, CLI và hàng đợi](TU-DONG-HOA.md).

## Tinh chỉnh bằng tay

1. Nhấn **Nhập ảnh** hoặc kéo ảnh vào ô nhập bên trái. Hỗ trợ JPG, PNG và WebP, mỗi ảnh tối đa 25 MB.
2. Nhấn ảnh thu nhỏ để thêm một cảnh. Cảnh mới mặc định dài 4 giây.
3. Chọn cảnh trong dải phía dưới. Kéo cảnh để đổi thứ tự, hoặc dùng hai nút mũi tên. Các nút kéo, chia, nhân bản và xoá có chú thích khi rê chuột.
4. Thanh công cụ trên dải dưới có **Ảnh**, số giây, **Chuyển động**, **Chữ**, **Hiệu ứng**. Chỉ hiện nhóm đang cần. Kéo mép phải cảnh để đổi thời lượng; bấm số giây để nhập chính xác. **Giữ toàn ảnh** giúp xem đủ ảnh gốc, phần trống dùng nền video.
5. Bấm nút nằm giữa hai cảnh để chọn chuyển cảnh/thời lượng/hướng. Bấm nhãn chuyển động hoặc hiệu ứng trên cảnh để chọn preset; có thể kéo preset thả vào cảnh khác. Chọn **Áp dụng cho mọi cảnh** nếu muốn dùng chung.
6. Bấm lớp chữ trên cảnh hoặc vùng chữ ở preview để sửa nội dung, font, cỡ, màu, timing và animation cơ bản. Kéo vùng chữ để đổi vị trí; chọn ảnh rồi kéo để đổi vị trí ảnh. Bấm **Nâng cao** mới mở bảng bên phải với đầy đủ kiểu chữ, 81 effect, keyframe và tham số chi tiết. **Lưu mẫu config** lấy thiết lập cảnh đang chọn để dùng cho bộ ảnh khác.
7. Chọn một trong hai tỷ lệ video phía trên vùng xem trước: **9:16 dọc (1080×1920)** hoặc **16:9 ngang (1920×1080)**. Mặc định 9:16. Nhấn phát hoặc kéo vạch phát để kiểm tra.
8. Nhấn **Xuất video**, chọn chất lượng và bắt đầu xuất. Khi hoàn thành, nhấn **Tải video MP4**. File cũng nằm trong `data/exports/`.

**Thử với ảnh mẫu** tạo một video ba cảnh bằng các ảnh SVG cục bộ, giúp khám phá công cụ mà không cần nhập file. Đây là nội dung khởi đầu của editor mới, không dùng lại tài nguyên video test cũ.

## Hiểu thời lượng

Chuyển cảnh chồng hai cảnh lên nhau. Ví dụ ba cảnh dài 4 giây, hai lần nối 0,5 giây sẽ tạo video dài 11 giây.

Chuyển cảnh được đặt trên cảnh đi trước. Ở cảnh cuối, tuỳ chọn này chỉ có hiệu lực sau khi thêm cảnh tiếp theo. Thời gian nối không vượt quá một nửa mỗi cảnh liên quan.

Để chia cảnh, đưa vạch phát vào bên trong cảnh đang chọn, cách mép và đoạn chuyển cảnh ít nhất 0,5 giây, rồi nhấn nút kéo. Các phần giữ thời gian gốc của chuyển động và nội dung có thời gian riêng, giúp tiếp tục chuyển động thay vì bắt đầu lại.

## Lưu và mở dự án

- Cấu hình tự lưu trong trình duyệt sau khi thay đổi. Dùng cùng địa chỉ `127.0.0.1:3210` để thấy bản đang làm; `localhost` là một vùng lưu khác của trình duyệt.
- Nút **Lưu dự án** tải file `.khung.json`; nút thư mục mở lại file JSON.
- Dự án tự động giữ cả config và danh sách cảnh **Đang giữ**. Chỉnh tay đánh dấu cảnh được giữ khi dựng lại; bỏ giữ trên cảnh hoặc trong màn hình tự động để tái dựng toàn bộ.
- JSON chứa cấu hình và LUT dạng văn bản, không nhúng ảnh/font. Giữ `data/uploads/` và `data/fonts/` khi sao lưu hoặc di chuyển dự án sang máy khác.
- Nếu thiếu ảnh, nhập lại ảnh rồi chọn nó ở **Ảnh → Thay ảnh** cho cảnh tương ứng.
- Tạo dự án mới/xoá cảnh không xoá file gốc trong `data/uploads`, để những dự án đã lưu trước đó còn mở được.

## Phím tắt

| Phím               | Thao tác             |
| ------------------ | -------------------- |
| Space              | Phát / tạm dừng      |
| ← / →              | Lùi / tiến một frame |
| ⌘/Ctrl Z           | Hoàn tác             |
| ⌘/Ctrl Shift Z     | Làm lại              |
| ⌘/Ctrl S           | Tải file dự án       |
| Delete / Backspace | Xoá cảnh đang chọn   |

Phím tắt chỉnh sửa không chạy khi đang gõ trong một ô nhập hoặc đang mở hộp xuất video.

## Chữ nâng cao

Mở **Nâng cao → Chữ** để dùng các mục dưới đây; chúng không xuất hiện lúc đầu.

- **Mẫu chữ**: thêm lớp với kiểu dựng sẵn hoặc áp mẫu lên lớp đang chọn; có thể hoàn tác.
- Danh sách lớp có nút ẩn/hiện, đưa trước/sau, nhân bản và xoá. Lớp ở cuối được vẽ trên các lớp phía trước.
- **Nội dung & font**: font hệ thống hoặc font từ máy (WOFF/WOFF2/TTF/OTF, tối đa 5 MB); cỡ, đậm, nghiêng, gạch và đổi hoa/thường.
- **Màu sắc & trang trí**: một màu, gradient, chữ rỗng, nền, bo góc, đệm, viền, bóng, phát sáng và độ dày khối giả 3D.
- **Vị trí & bố cục**: phần trăm vị trí, độ rộng tối đa, giãn chữ/dòng, xoay/nghiêng, hướng viết và cong lên/xuống. Chữ cong dùng một dòng SVG và animation cả đường chữ.
- **Thời gian & chuyển động**: khoảng xuất hiện, kiểu vào/ra, thời lượng, độ trễ ký tự/từ, easing và chuyển động lặp. Nút xem từ đầu chữ tua tới lớp và phát.
- **Số đếm động**: giá trị đầu/cuối, số lẻ, tiền tố/hậu tố. Số định dạng theo tiếng Việt.

## Hiệu ứng nâng cao

Mở **Nâng cao → Hiệu ứng** để dùng thư viện đầy đủ và các tham số dưới đây.

- **Chuyển động ảnh**: chọn preset, mức/tốc độ, easing, mặt nạ và độ hiện.
- **Chuyển cảnh**: kiểu nối, thời lượng, easing; hướng áp dụng cho các kiểu trượt/đẩy/quét/rèm.
- **Thư viện Remotion**: tìm theo tên tiếng Việt hoặc tên API, lọc nhóm rồi thêm. Mỗi hiệu ứng dùng factory chính thức; tham số được sinh từ schema cùng phiên bản package.
- Hiệu ứng được tính từ trên xuống. Dùng nút đổi thứ tự, bật/tắt, nhân bản hoặc xoá. Mở một hiệu ứng để chỉnh thời gian và tham số.
- Bật **Chuyển động** bên dưới tham số số để đặt giá trị đầu/cuối và easing. Nó diễn ra trong khoảng thời gian của hiệu ứng. Giá trị tĩnh chỉ dùng khi bỏ chuyển động.
- **LUT**: nhập nội dung hoặc file `.cube` tối đa 2 MB. Nội dung được giữ trong JSON.
- **Lớp phủ**: thêm tối đa 8 lớp; chỉnh màu, mức, cỡ/tốc độ, seed, thời gian và thứ tự. Lớp phủ được vẽ trên ảnh, dưới chữ.
- **Keyframe ảnh**: đặt giá trị ảnh rồi ghi tại vạch phát, hoặc chỉnh từng mốc trực tiếp. Các mốc được nội suy và cộng với preset. Cảnh đã chia giữ các mốc theo thời gian chuyển động gốc để không nhảy hình.
- Nếu preview báo lỗi GPU/tài nguyên, tắt hiệu ứng vừa thêm hoặc chọn ảnh/font khác rồi nhấn **Tải lại xem trước**.

Xem [danh mục đầy đủ](DANH-MUC-CHU-HIEU-UNG.md) và [giới hạn tương thích](KIEM-TRA.md).
