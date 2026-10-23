# Khung v0.6 — chỉ dựng video kể chuyện tự động

## Mục tiêu

Một bộ ảnh + WAV + TXT đánh số → ghép cảnh, lấy thời lượng từ voice, căn phụ đề từng câu, thêm chuyển động/nhân vật/lớp phủ theo mẫu → xem trước và xuất MP4. Chỉ 9:16 và 16:9. Không cần mở JSON hoặc chỉnh từng cảnh.

## Thực hiện

1. Thay editor nhiều bảng bằng một màn hình: đầu vào, mẫu dựng, kết quả.
2. Nhập riêng ảnh, WAV và một TXT bằng ba ô chọn/kéo thả. Asset nhân vật nhập tại mục tuỳ chọn. Kiểm tra ghép số trước khi dựng; lỗi không làm mất bộ đầu vào hiện tại.
3. Giữ lựa chọn ít: tỷ lệ, nhịp kể, lớp phủ và có/không nhân vật. Các thiết lập dùng lại nằm trong mục thu gọn và lưu được thành mẫu.
4. Nút Tạo video chạy căn câu → biên dịch → xuất MP4. Có lựa chọn chỉ xem trước, huỷ tác vụ, lưu/mở dự án và tải kết quả.
5. Xoá UI timeline, cắt/tách/nhân bản cảnh, chỉnh ảnh/màu/keyframe, biên tập chữ/lớp hiệu ứng và kéo thả từng vật thể. Giữ runtime Remotion và định dạng dự án để video cũ vẫn xem/xuất được; CLI tiếp tục dùng engine chung.
6. Cập nhật tài liệu, build/kiểm tra kiểu và một số kiểm tra đúng luồng mới. Không cài thêm môi trường, không chạy lại bộ render demo dài.

## Phạm vi thực tế

- Tự động animation cơ bản từ asset được nhập; không tạo chuyển động diễn xuất mới từ một PNG nguyên khối.
- WAV + TXT dùng forced alignment local hiện có; Python/model do người dùng cài bằng uv. Không có voice thì không cần Python và phụ đề chia câu theo thời gian đọc ước lượng.
- Chuyển cảnh phải giữ trọn voice. Không thêm video nguồn, chỉnh âm thanh, timeline đa track, kho filter/text như editor thông thường.
- Giữ dữ liệu `data/` để không làm mất tài nguyên người dùng. Theo yêu cầu dọn dẹp mới, bỏ các bộ demo cũ và thay bằng bộ mẫu nhỏ trong `test/`.

## Đã triển khai

- `src/App.tsx` thay toàn bộ giao diện editor bằng form tự dựng và kết quả.
- `src/auto/story.ts` chuyển mẫu đơn giản thành AutoConfig; kiểm tra ghép đầu vào, tạo phụ đề ước lượng khi không có voice và hoàn thiện Project.
- `src/editor/story-import.ts` nhập theo loại ảnh/WAV/TXT/characters; chỉ cập nhật loại đã chọn sau khi nhập thành công, giữ nguyên các loại còn lại. `StoryInput.tsx` cung cấp ba ô nhập riêng.
- Xoá chín component editor không dùng và CSS cũ; không chỉ giấu chúng sau một nút.
- Tự tiếp tục theo dõi xuất khi tải lại trang nếu server còn giữ tác vụ; huỷ được căn câu/xuất.
- Lưu/mở mẫu `.khung-preset.json` bằng nút riêng. Không yêu cầu người dùng viết JSON.
- Dự án v0.5 vẫn mở/xuất được nếu giữ tài nguyên media trong `data/`, không tự ép dựng lại. Demo cũ trong workspace đã được dọn theo yêu cầu mới.

## Kiểm tra trong lượt triển khai

Dải ảnh trực quan: ảnh vừa nhập xuất hiện ngay dưới preview theo thứ tự tên/số, có thumbnail lớn, tên tệp, thời lượng theo WAV hoặc ước lượng, nhãn voice và dấu chuyển cảnh. Chọn ảnh để xem trước khi dựng; sau dựng chọn cảnh hoặc kéo thanh tua. Nút Thêm ảnh bổ sung vào bộ hiện có, không thay ảnh cũ; từ chối tên trùng trước khi upload. Ba ô ảnh/WAV/TXT vẫn độc lập, việc dựng và xuất vẫn tự động.

Điều chỉnh đầu vào: bỏ upload thư mục gộp, thay bằng ba ô Ảnh bối cảnh (nhiều PNG/JPG/WebP), Voice WAV (nhiều WAV), Lời đọc TXT (một TXT chứa toàn bộ lời đọc theo định dạng đánh số hiện tại). Từng ô hỗ trợ chọn, kéo thả, thay/bỏ riêng và từ chối tệp sai loại. Engine ghép số và căn phụ đề giữ nguyên.

Build và TypeScript/ESLint của code mới; bốn kiểm tra tập trung vào ghép số, phụ đề ước lượng, thời lượng WAV và tự chọn animation. Trình duyệt đã nhập hai ảnh thật và dựng bản xem trước thành công. Không chạy cài đặt môi trường voice hoặc render video demo dài. Phần kiểm tra voice dùng mốc alignment giả lập để xác minh pipeline, không thay thế kiểm tra model thực tế của người dùng.

Lượt v0.7 thay form/dải thẻ bằng workspace và timeline ba hàng; xem [kế hoạch hiện tại](KHONG-GIAN-DUNG-VIDEO.md). Ảnh giao diện: `docs/images/workspace-desktop.png`, `docs/images/workspace-mobile.png`. Các ảnh wizard/dải thẻ và trang kiểm tra tạm đã bỏ. Không có thư viện mới.
