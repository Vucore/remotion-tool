# Quản lý dung lượng

## Mục tiêu và phạm vi

Thêm nút **Dung lượng** mở cửa sổ theo giao diện editor hiện tại. Mỗi nhóm hiện đường dẫn tương đối, nội dung, số file, dung lượng MB và tác động khi xóa. Quét bằng worker, không đọc nội dung ảnh/audio hay tải model, không quét thư mục cache ngoài dự án.

Đầu cửa sổ hiện đường dẫn tuyệt đối của kho đang quét để phân biệt với checkout khác. Tổng `.cache` riêng gồm tất cả thư mục con, cả model Whisper/ảnh, các thư mục chưa nhận diện và file trực tiếp; không cộng trùng với từng nhóm bên dưới. **1 MB = 1.000.000 byte**. Số chính dùng dung lượng chiếm trên đĩa (`stat.blocks × 512`), gồm metadata thư mục; số nội dung tệp dùng `stat.size` và được ghi riêng. Hardlink cùng inode/device chỉ tính block một lần trong lượt quét, ở nhóm đầu tiên gặp; không đi theo symlink. Nếu không đọc đủ thư mục, giao diện báo thống kê chưa đầy đủ. Hai số có thể khác nhau do block cấp phát/nén/APFS. Tổng đã quét chỉ gồm các nhóm liệt kê, không phải toàn bộ source code hoặc ổ đĩa.

Chỉ quét khi mở cửa sổ Dung lượng, bấm Kiểm tra lại hoặc sau khi xóa trong cửa sổ này. Không tự quét khi khởi động app, không có interval/polling kiểm tra dung lượng, không quét định kỳ khi đóng cửa sổ.

- `.cache`: tách ảnh proxy, bundle render, cache TTS/căn phụ đề/dịch/xử lý ảnh và các model Whisper/LaMa/Real-ESRGAN.
- Các thư mục ẩn khác: cho xem dung lượng; chỉ cho dọn các cache công cụ đã biết. `.git`, `.venv`, tệp cấu hình và thư mục không nhận diện chỉ đọc.
- Bản xuất: gộp MP4/SRT trong `data/exports` và metadata/snapshot trong `data/jobs`. Dùng chung cơ chế đồng bộ với thao tác xóa từng video trong lịch sử.
- Không có thao tác xóa ảnh/voice nguồn, toàn bộ `data`, thư viện Python/JS hoặc lịch sử Git.

## Xóa và đồng bộ

1. Quét thật trên đĩa; không đi theo symlink. Xác nhận hiện rõ nhóm, số file, dung lượng và ảnh hưởng. Nút Giữ lại được focus trước.
2. Khi xác nhận, đối chiếu lại danh sách/kích thước/mtime. Không cho dọn khi có upload, TTS, căn phụ đề, xử lý ảnh hoặc xuất video đang chạy. Chặn tác vụ mới trong lúc dọn.
3. Chỉ xóa file trong nhóm được quản lý; không nhận đường dẫn tùy ý từ trình duyệt. Không xóa đệ quy thư mục bảo vệ hoặc đi qua symlink. File mới xuất hiện không bị xóa theo danh sách cũ.
4. Cache có thể tái tạo. Xóa model cần tải/đặt model lại khi muốn dùng. Xóa cache TTS không xóa audio đã gắn vào video; xóa cache căn phụ đề không xóa timing hiện tại.
5. Xóa bản xuất phải bỏ MP4/SRT/snapshot/metadata của đúng bản, xóa liên kết bản xuất trong mọi dự án đã lưu; không xóa ảnh/voice trong snapshot.
6. Dọn tham chiếu cache đã xóa trong metadata tài nguyên; đồng bộ tab hiện tại và các tab khác, làm mới thống kê sau thao tác. Mở/lưu dự án cũ không được phục hồi liên kết bản xuất đã xóa.
7. Nếu file bản xuất đã mất ngoài app, lịch sử bỏ nút tải tương ứng và cho xuất lại từ snapshot còn giữ.

## Kiểm tra có giới hạn

Các kiểm tra xóa trước đó chỉ dùng fixture riêng; theo yêu cầu sau đó của người dùng, đã dừng mock và chạy test. Trước yêu cầu dừng, đã đối chiếu đọc dung lượng `.cache` thật với `du -sk .cache` và build/lint. Không dọn dữ liệu thật hoặc gọi TTS/model để thử. Người dùng tự kiểm tra thao tác xóa.
