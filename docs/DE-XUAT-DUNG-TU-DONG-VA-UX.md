# Đề xuất: đưa bộ ảnh + config vào, nhận video hoàn chỉnh

Ngày: 22/10/2026. Đây là **bản đề xuất ban đầu**. Người dùng đã yêu cầu thực hiện; xem [triển khai v0.3](TU-DONG-HOA.md) và [tiến độ](TRIEN-KHAI-TU-DONG-UX.md) cho tính năng, cách dùng và giới hạn thực tế.

## Mục tiêu được xác nhận

Người dùng chuẩn bị một bộ ảnh và một file config. Công cụ tự sắp xếp ảnh, tạo cảnh, chia thời lượng, áp dụng bố cục/chuyển động/chuyển cảnh/chữ/hiệu ứng theo config rồi xuất MP4. Không có bước bắt buộc phải mở từng cảnh để chỉnh.

Chỉ hỗ trợ hai tỷ lệ 9:16 và 16:9. Editor là nơi xem kết quả, sửa ngoại lệ hoặc tạo một config dùng lại. Dựng tự động là luồng chính.

## Luồng chính

```text
Bộ ảnh + auto-edit.config.json
               ↓
Kiểm tra ảnh, font, config và đường dẫn đầu ra
               ↓
Tạo bản dựng hoàn chỉnh theo quy tắc
               ↓
Remotion xuất MP4
               ↓
Video + dự án có thể mở lại + báo cáo lần chạy
```

Trong web: thả cả bộ ảnh và file config → nhấn **Tạo video** → nhận kết quả. Có tiến độ, huỷ và thông báo lỗi cụ thể. Không bắt người dùng duyệt bản xem trước mới được xuất.

Trong CLI: truyền đường dẫn bộ ảnh/config/đầu ra để chạy không cần mở editor. Cùng một cấu hình có thể áp dụng cho các bộ ảnh khác nhau. Chạy hàng loạt dùng danh sách công việc, mỗi công việc chỉ đổi đầu vào/đầu ra hoặc một số biến.

Lần đầu chưa có config: chọn mẫu và chỉnh vài giá trị chung, sau đó tải config để dùng lại. Mẫu không yêu cầu viết riêng cấu hình cho từng ảnh.

## Cấu hình cần mô tả những gì

File ví dụ: [auto-edit.example.json](examples/auto-edit.example.json). Định dạng này hiện đã được v0.3 hỗ trợ; xem [hướng dẫn thực thi](TU-DONG-HOA.md).

| Nhóm | Quy tắc |
| --- | --- |
| Đầu vào | Thư mục ảnh; định dạng được nhận; sắp xếp tự nhiên theo tên, ví dụ `2` đứng trước `10`. |
| Đầu ra | Tỷ lệ, FPS, tên file, chất lượng xuất. |
| Thời lượng | Số giây mỗi ảnh hoặc tổng thời lượng mong muốn; có giới hạn ngắn/dài khi dùng tổng thời lượng. |
| Bố cục | Lấp đầy hoặc giữ trọn ảnh; điểm lấy khung mặc định và ngoại lệ nếu cần. |
| Chuyển động | Một preset hoặc danh sách được luân phiên; mức độ; tránh lặp liên tiếp. |
| Chuyển cảnh | Preset chung hoặc luân phiên theo quy tắc; thời gian chồng lấn. |
| Chữ | Không dùng, dùng nội dung chung, hoặc lấy từ file nội dung; mẫu chữ và animation áp dụng tự động. |
| Hiệu ứng | Mẫu màu/lớp phủ/stack effect đã định nghĩa; tham số chung và ngoại lệ tuỳ chọn. |
| Khả năng lặp lại | Phiên bản config, phiên bản mẫu và seed để dựng lại cùng kết quả. |

Ví dụ: 3 ảnh, mỗi ảnh 4 giây, hai chuyển cảnh chồng lấn 0,5 giây → video dài 11 giây. Bộ 20 ảnh dùng lại config này → tự tạo 20 cảnh, không cần thêm 20 mục cấu hình.

Config mẫu không tạo chữ. Khi cần chữ theo từng ảnh, có thể bổ sung `captions.json` ánh xạ tên ảnh sang nội dung; công cụ tự đặt chữ và animation theo mẫu. GPT có thể tạo file nội dung/config sau này qua cùng bộ kiểm tra, nhưng không phải điều kiện để luồng này hoạt động.

Ngoại lệ là tuỳ chọn: chỉ ảnh cần khác quy tắc chung mới có override theo tên ảnh hoặc ID ổn định. Khi đổi thứ tự, override vẫn đi theo đúng ảnh.

## Bố cục web đề xuất

### Khi mở công cụ: Dựng tự động

- Đầu vào: vùng thả bộ ảnh và file config, hiển thị số ảnh và tên config.
- Thiết lập nhanh: mẫu, 9:16/16:9, thời lượng. Các giá trị này được đọc từ config; thay đổi ở đây tạo bản config mới có thể lưu lại.
- Một hành động chính: **Tạo video**. Công cụ tự dựng và xuất, sau đó hiện video và nút tải MP4/dự án.
- JSON, đường cong, tham số effect và tuỳ chọn xuất chi tiết nằm trong **Nâng cao**, đóng lúc đầu.
- **Tinh chỉnh** là hành động phụ trên kết quả đã dựng.

### Khi cần tinh chỉnh

```text
Tên dự án          Dựng tự động | Tinh chỉnh          Xuất MP4
────────────────────────────────────────────────────────────
Thư viện ảnh       Xem trước lớn, chọn ảnh/chữ trực tiếp
                   Bảng nâng cao chỉ mở khi được yêu cầu
────────────────────────────────────────────────────────────
Cảnh đang chọn     Thời lượng | Chuyển động | Chữ | Hiệu ứng
Ảnh                 [ Cảnh 1 ] [chuyển] [ Cảnh 2 ] [chuyển] …
Chữ (khi có)        [ Dòng chữ tương ứng cảnh/lớp ]
────────────────────────────────────────────────────────────
Vạch phát, thời gian, thu/phóng dải cảnh
```

Giữ màu nền sáng và điểm nhấn teal hiện tại. Diện tích bên phải trả cho preview khi không mở nâng cao. Không chuyển nguyên danh sách 81 hiệu ứng thành một bảng lớn ở phía dưới.

| Thao tác | Kết quả ngay tại vị trí làm việc |
| --- | --- |
| Bấm cảnh | Chọn cảnh, tua preview tới cảnh đó, hiện thanh công cụ ngắn. |
| Kéo cảnh | Đổi thứ tự; có nút di chuyển tương đương bằng bàn phím. |
| Kéo mép cảnh | Đổi thời lượng; cũng nhập được số giây chính xác. |
| Bấm nút giữa hai cảnh | Mở bộ chọn chuyển cảnh có hình xem trước; chỉnh thời lượng và áp dụng cho tất cả nếu muốn. |
| Bấm nhãn chuyển động/hiệu ứng trên cảnh | Chọn preset từ bảng ngắn; có kéo preset thả vào cảnh và chọn nhiều cảnh để áp dụng cùng lúc. |
| Bấm/nhấp đúp chữ trên preview | Chọn/sửa nội dung, kéo vị trí; thanh nổi chỉ hiện nội dung, font, cỡ, màu và căn lề. |
| Bấm lớp chữ trên dải dưới | Chọn đúng lớp, kéo đầu/cuối để chỉnh thời điểm xuất hiện. |
| Bấm Nâng cao | Mở bảng thuộc tính theo đối tượng đang chọn: X/Y, keyframe, easing, stack effect, schema tham số gốc, kiểu chữ chi tiết. |

Hiệu ứng đi theo cảnh dưới dạng nhãn, không tạo một track riêng cho mỗi effect. Chỉ hiện track chữ khi có chữ. Bộ chọn nhanh chỉ đưa vài preset dễ hiểu; thư viện đầy đủ vẫn truy cập được qua Nâng cao. Thanh mức độ chỉ xuất hiện với preset có ánh xạ tham số phù hợp.

Chuột phải là lối tắt, không phải cách duy nhất tìm được thao tác. Nút chuyển cảnh/hiệu ứng luôn nhìn thấy, có nhãn và trạng thái đang áp dụng. Ở màn hình hẹp, bảng ngắn xếp xuống dưới thay vì che preview.

## Tái dựng và chỉnh ngoại lệ

- Chỉnh một cảnh bằng tay tạo override gắn với ID cảnh/ảnh, không làm mất config gốc.
- Nút **Giữ chỉnh sửa** khoá cảnh khi chạy lại. Có thể bỏ khoá để trở về quy tắc tự động.
- **Dựng lại** hiển thị phạm vi trước khi chạy: toàn bộ hoặc phần chưa khoá. Thay config không âm thầm ghi đè phần đã khoá.
- Lưu cả config, override và trạng thái khoá cùng dự án; mở lại vẫn tái dựng được.
- Mỗi lần dựng là một thao tác hoàn tác. Không thay dự án hiện tại nếu kiểm tra/lập bản dựng thất bại.

## Kiến trúc triển khai

Hiện tại Remotion đã dựng từ `Project` JSON; phần còn thiếu là bộ tạo `Project` tự động từ bộ ảnh và quy tắc cấp cao.

```text
UI / CLI / danh sách công việc
             ↓
Ảnh đã nhận diện + AutoEditConfig + override/khoá
             ↓
validate → plan → tạo Project → parseProject
                                  ↓
                        Preview / render hiện có
```

Đề xuất tách `src/auto/` gồm schema/kiểm tra config, sắp xếp đầu vào, registry mẫu, bộ tính thời lượng, bộ tạo cảnh và báo cáo. Không sinh mã React cho từng video.

- Bộ lập bản dựng là hàm dùng chung cho web và CLI. Không phụ thuộc UI và không có random theo thời gian thực.
- Mẫu là tập quy tắc/config có phiên bản, dùng các preset đang có. Mẫu đơn giản không tự bật hiệu ứng GPU nặng.
- Thời lượng tính bằng frame; tính cả chồng lấn chuyển cảnh. Chế độ tổng thời lượng phải giải được với các giới hạn và cảnh bị khoá; nếu không, trả lỗi cùng khoảng khả thi.
- Cùng nội dung ảnh, config, phiên bản mẫu và seed tạo cùng bản dựng. Báo cáo ghi manifest/hash tài nguyên và phiên bản engine để truy vết; không cam kết MP4 giống từng byte trên mọi phần cứng.
- Web nhận ảnh từ thao tác chọn/thả và ánh xạ đường dẫn logic trong config; trình duyệt không tự đọc một thư mục bất kỳ trên máy.
- CLI đọc đường dẫn tương đối từ vị trí config, nhận diện kích thước ảnh/font và dùng lại engine xuất. Tiến trình phục vụ tài nguyên cục bộ phục vụ render được đóng khi công việc kết thúc.
- File dự án editor mới bọc `Project` cùng recipe/config và override; vẫn đọc được Project v1. Composition/API render tiếp tục nhận `Project` đã chuẩn hoá.
- Kết quả gồm MP4, dự án đã dựng và báo cáo. Lỗi chỉ rõ file hoặc đường dẫn trường config cần sửa; không bỏ qua lỗi để xuất video thiếu cảnh.

## Thứ tự làm

1. **Bộ dựng tự động và CLI trước:** nhận bộ ảnh + config, validate, tạo Project, render đến MP4, lưu kết quả/báo cáo, chạy lại ổn định. Đây là tiêu chí cốt lõi.
2. **Màn hình Dựng tự động:** thả ảnh/config, vài thiết lập nhanh, một nút chạy, tiến độ/kết quả/huỷ, lưu lại config. Dùng đúng bộ dựng ở bước 1.
3. **Tinh chỉnh trên dải cảnh:** nút chuyển cảnh thật, preset chuyển động/FX, thời lượng kéo mép, sửa chữ trực tiếp, nâng cao đóng mặc định; override và khoá cảnh khi tái dựng.
4. **Chạy nhiều bộ ảnh:** hàng đợi, config chung + biến từng công việc, báo cáo riêng, tiếp tục công việc lỗi mà không dựng lại các công việc đã xong.

Các bước trên là một phạm vi triển khai; không coi luồng tự động hoàn tất nếu mới chỉ thêm nút áp dụng preset trong editor.

## Tiêu chí nghiệm thu

- Từ bộ ảnh chưa có scene và một config hợp lệ, một lần chạy tạo MP4 hoàn chỉnh; không cần chọn/sửa từng ảnh trong UI.
- Đổi sang bộ ảnh khác, giữ config → tự tạo đúng số cảnh, thứ tự và quy tắc. Không cần code thêm.
- Cả 9:16 và 16:9 dùng chung pipeline, bố cục chữ có vùng an toàn và ảnh theo đúng quy tắc lấy khung.
- Lưu/mở dự án không mất recipe, override hoặc khoá; Project cũ vẫn mở được.
- Dựng lại cùng đầu vào giữ nguyên bản dựng; cảnh bị khoá không thay đổi. Thao tác có thể hoàn tác.
- Kiểm tra lỗi file thiếu, font thiếu, config sai, tên trùng, không đủ điều kiện đạt tổng thời lượng và effect không được hỗ trợ trước khi xuất.
- Kiểm tra có ý nghĩa cho sắp xếp tự nhiên, chia frame/chồng lấn, seed, override/khoá, tương thích dự án và một ca render tích hợp khi triển khai. Chưa chạy server/render trong lượt đề xuất này.

## Phạm vi bản phác trong cuộc trò chuyện

Bản phác tương tác dùng ba ảnh mẫu của dự án để minh hoạ chuyển giữa Dựng tự động/Tinh chỉnh, áp dụng config mẫu, chọn cảnh và chỉnh nhanh chuyển cảnh/hiệu ứng. Bản phác không xuất MP4 và không phải thay đổi đã tích hợp vào editor.
