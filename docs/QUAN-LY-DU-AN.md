# Lưu và chuyển dự án

## Đã triển khai

- Mỗi dự án có ID riêng, snapshot trong `data/projects/<id>/workspace.json` và những thay đổi mới trong `changes.jsonl`; ảnh, voice và font tiếp tục tham chiếu kho dùng chung để không nhân đôi dữ liệu.
- Danh sách dự án dùng chỉ mục nhỏ, thumbnail proxy, số cảnh và thời điểm cập nhật. Tạo mới và chuyển dự án phải lưu xong bản đang mở trước.
- Tự lưu dùng patch và xử lý JSON/đĩa trong worker; không đưa ghi file lớn vào luồng giao diện hoặc luồng HTTP. Chống ghi đè khi hai tab sửa cùng bản bằng revision.
- Chuyển bản nháp IndexedDB/localStorage hiện tại sang thư viện một lần. Chỉ dọn bản cũ khi server xác nhận đã lưu thành công.
- Tệp JSON tải về giữ tương thích bản cũ và bổ sung bản sao đầy đủ cả thiết lập/lời đọc chưa dựng. Bản xuất video vẫn dùng snapshot riêng như trước.
- Gỡ cơ chế ghi bản nháp trình duyệt đã thay thế, dialog tạo mới từng bỏ bản hiện tại, và cập nhật tài liệu. Không xóa media, model hay dự án người dùng.

## Cách dùng

1. Khởi động lại server sau khi cập nhật code (`npm run dev`, hoặc `npm run build` rồi `npm start`). Không cần thư viện/model mới.
2. Bấm **Dự án** ở đầu editor. Gõ tên và **Tạo mới** để làm video tiếp theo. Chọn một video trong danh sách để mở lại; tìm kiếm khi có nhiều video.
3. **Nhân bản đang mở** lưu bản hiện tại rồi tạo bản riêng, dùng chung media. Đổi tên tại ô tên video trên header. Video mới giữ tỷ lệ hiện tại, các thiết lập khác trở về mặc định.
4. Dấu tích bên tên video cho biết server đã lưu xong. Tự lưu sau khoảng 600 ms khi ngừng sửa; chuyển/tạo/nhân bản luôn flush trước, không phụ thuộc debounce.
5. **Tệp → Tải bản sao JSON** tải toàn Workspace, kể cả bản chưa dựng và thiết lập TTS/phân vai. **Nhập dự án từ JSON** tạo một dự án mới; vẫn nhận JSON Project theo định dạng cũ.

## Cấu trúc và hiệu năng

```text
data/
  projects/
    index.json
    <id>/
      workspace.json
      changes.jsonl
  uploads/                 # media dùng chung, không chép khi nhân bản
  fonts/
  jobs/                    # snapshot/lịch sử xuất như trước
  exports/                 # MP4 và SRT như trước
```

`workspace.json` là snapshot có phiên bản, ID/revision, thời gian và Workspace đầy đủ. Waveform được giữ riêng theo voice ID trong cùng snapshot. `changes.jsonl` chứa patch và waveform mới; mỗi lần lưu chỉ append phần thay đổi và fsync rồi mới xác nhận. Sau 32 thay đổi hoặc journal lớn hơn 1 MiB, worker gộp snapshot bằng file tạm + rename rồi xoay journal. Các record đã nằm trong snapshot được bỏ qua khi replay, nên crash giữa hai bước vẫn đọc được. Chỉ phần đuôi chưa đủ một dòng do ghi dở được bỏ; record hoàn chỉnh hỏng phải báo lỗi, không âm thầm thay bằng dữ liệu trống.

Cả browser utility worker và worker Node xử lý JSON ngoài luồng giao diện/HTTP. Server chỉ cache một Workspace đang truy cập cùng chỉ mục nhỏ; danh sách không tải toàn bộ dự án, thumbnail lazy qua proxy, hiển thị theo từng đợt 30 mục. Index mất/hỏng có thể dựng lại từ snapshot + journal. Chạy một server cho cùng thư mục `data` như cấu hình export hiện có; không dùng nhiều process server cùng ghi kho dự án.

Revision kiểm tra mỗi lần lưu: tab cũ không tự đè bản đã được tab khác lưu. Khi xung đột hoặc mất kết nối, thao tác chuyển/nhân bản dừng; tải bản sao JSON để giữ phần chưa lưu, rồi tải lại trang. Browser cảnh báo nếu đóng trang khi chưa lưu xong. Việc đóng đột ngột process/mất điện trước khi có xác nhận vẫn có thể mất thay đổi chưa gửi.

## Sao lưu và chuyển máy

Giữ toàn bộ `data/`, đặc biệt **cả** `workspace.json` lẫn `changes.jsonl`; không chỉ chép snapshot vì thay đổi gần nhất có thể còn ở journal. Giữ `uploads`, `fonts`, `jobs`, `exports` để các đường dẫn và kết quả vẫn dùng được. JSON tải về chỉ đóng gói cấu hình, không nhúng media. Model/cache Python và ảnh không thuộc bản dự án; cài lại môi trường bằng uv như hướng dẫn trước.

Dự án không còn phụ thuộc hồ sơ trình duyệt/hostname/cổng. Bố cục panel vẫn là sở thích UI lưu riêng trong trình duyệt. Lịch sử xuất vẫn là danh sách chung; Workspace giữ job đang theo dõi của chính video đó, nên chuyển dự án không mang job sang video khác và không hủy export đang chạy.

## Chuyển bản cũ và dọn mã

- Đọc IndexedDB v1–v3 và localStorage cũ, chuyển thành dự án có ID trong data. Migration có khóa nội dung để thử lại không tạo trùng và không ghi đè phiên bản được sửa tiếp.
- Chỉ xóa dữ liệu draft trình duyệt sau khi kho server xác nhận thành công; media/model không bị xóa.
- Đã bỏ `workspace-database.ts`/`DraftWriter` ghi draft đơn, thay bằng `legacy-workspace.ts` chỉ phục vụ migration. Bỏ dialog tạo mới từng thay bản hiện tại và CSS riêng của dialog.
- Giữ các file worker và module đang có import thực tế. Tệp test trong thư mục tạm được tự dọn; không xóa ảnh/voice/video người dùng khi chuyển hoặc nhân bản dự án.

## Kiểm chứng

- Lint/build và suite hiện tại: 78 kiểm tra đạt, hai integration render/media cần server riêng được bỏ qua. Không tải/cài thư viện hoặc model, không render video dài.
- Kiểm tra kho riêng bằng thư mục tạm: hai dự án không lẫn nhau; TXT/setting/waveform giữ nguyên; khởi động lại phục hồi; tab revision cũ bị chặn; migration lặp lại không đè nội dung mới; compact/replay journal, đuôi ghi dở và rebuild index.
- UI: sửa tên/chọn Zoom ra, tạo mới rồi quay lại giữ đủ ảnh/TXT/motion; reload mở đúng bản đang làm. Danh sách được xem ở desktop 1280×720 và mobile 390×844.

## Xóa dự án và dữ liệu liên quan

Bấm thùng rác bên cạnh một dự án (cả bản đang mở). Khung lưu bản đang làm, kiểm tra các tham chiếu và hiện tên, số tệp riêng, dung lượng dự kiến. **Giữ lại** được focus trước; chỉ nút **Xóa dự án và tệp riêng** mới thực hiện xóa vĩnh viễn.

Được dọn khi không còn người dùng chung trong app:

- Folder dự án: snapshot, journal và waveform; TXT, phân vai, thiết lập nằm trong đó.
- Ảnh gốc đã upload, ảnh xử lý/thay thế, frame nhân vật, WAV/MP3, voice trung gian của TTS, file giọng clone và font riêng.
- MP4, SRT, metadata và snapshot của các lượt xuất gắn với dự án. Lượt xuất được một dự án khác theo dõi vẫn giữ, cùng media nguồn của snapshot đó.
- Proxy và cache ảnh/TTS/alignment/dịch có liên kết rõ với dự án và không còn dùng chung.

**Giữ nguyên:** file nguồn ở vị trí bạn chọn trên máy; thư mục `test/`, `public/`; model, môi trường uv/node; bundle Remotion và cache dùng chung không thể xác định chủ sở hữu. JSON tải ra ngoài app không được quét để xác định tham chiếu, nên sao lưu cả media nếu muốn giữ bản độc lập trước khi xóa.

Manifest tài nguyên tích lũy cả nguồn đã thay/bỏ, không chỉ các ảnh đang hiện tại thời điểm xóa. Upload và tác vụ mới gửi ID dự án; cache/generated voice được ghi nhận cả khi job kết thúc lỗi hoặc bị hủy. Resource update không thay revision nội dung nên không làm lỗi autosave. Các tài nguyên lịch sử trước lần nâng cấp này chỉ dọn được khi còn xác định được từ snapshot/journal/các đường dẫn cache; không đoán hoặc quét xóa các file cũ không rõ nguồn.

Khi còn job/upload đang chạy, thao tác xóa bị chặn; trong lúc dọn, server chặn mutation mới để không có file vừa bị dùng lại. Bộ dọn xét các project còn lại và mọi snapshot xuất được giữ. Dữ liệu tham chiếu không đọc được thì chặn trước khi xóa, thay vì giả sử không có người dùng chung. Chỉ các đường dẫn file nội bộ theo danh sách cho phép mới được dọn; không nhận đường dẫn tùy ý và không đi theo symlink ra ngoài kho.

Xóa bản đang mở sẽ mở dự án còn lại gần nhất; xóa bản cuối sẽ tạo một bản trống mới. Có tombstone trước khi dọn để tab cũ không ghi sống lại dự án. Nếu hệ điều hành không cho xóa một số file, UI báo số tệp còn lại và giữ `data/projects/<id>/deleted.json` làm danh sách để xử lý, không báo dọn sạch. Không tự xóa file ngoài danh sách để bù lỗi.

Các kiểm tra xóa dùng thư mục tạm: file riêng bị dọn, file chung/model/nguồn ngoài app giữ nguyên, export được dự án khác dùng giữ nguyên snapshot và media, tab cũ bị chặn, restart không khôi phục bản đã xóa, dữ liệu dự án khác bị lỗi khiến việc dọn dừng an toàn. Toàn bộ suite tại lượt triển khai: 82 đạt, 2 integration nặng bỏ qua; các kiểm tra bổ sung chạy tập trung theo thay đổi. UI kiểm tra bằng server có dữ liệu mẫu tách biệt, không xóa dự án thật của người dùng.

## Direction contract

THESIS: Mở lại một câu chuyện cũ hoặc bắt đầu câu chuyện mới bằng danh sách nhỏ, rõ tên và ảnh; mọi bản chỉnh sửa được giữ riêng.

OWN-WORLD: Giữ nền sáng, chữ xanh đậm, nét SVG và nút bo góc sẵn có của Khung. Không đổi bố cục editor.

STORY: Người dùng thấy dự án hiện tại, thời gian lưu, tạo mới và mở bản cũ; bản đang làm luôn được lưu trước khi rời đi.

FIRST VIEWPORT: Nút Dự án ở header mở dialog cùng hệ thống dialog hiện tại; đầu dialog có tìm kiếm/tạo mới, bên dưới là danh sách thumbnail, tên, số ảnh và lần chỉnh sửa.

FORM: Mở rộng cục bộ theo hệ thống hiện có, không thay nhận diện. Trạng thái đang lưu, lỗi, rỗng và đang mở được hiển thị tại thao tác liên quan.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Đối chiếu giao diện sau triển khai

Đây là phần mở rộng editor hiện có. `ProjectsPanel.tsx` dùng lại `EditorDialog`, nút `.button`/`.primary`, SVG `Icon`, màu `--accent`/`--line` và font hệ thống của `src/styles.css`; ô nhập giữ viền, nền trắng và bo 5 px, nút bo 6 px. Cỡ chữ 13 px cho nội dung, 12 px cho metadata và tiêu đề dialog 18 px theo các thành phần sẵn có; danh sách dự án thêm tiêu đề 15 px. Dialog vẫn dùng lớp nền phủ, vùng nội dung cuộn và breakpoint 600 px hiện có.

Đã đối chiếu mã với ảnh desktop 1280×720 tại `docs/images/projects-library.png` và mobile 390×844 tại `docs/images/projects-library-mobile.png`. Review cuối đã xác nhận sửa lỗi nhân bản bỏ qua lưu bản gốc (mở lại bản gốc ngay sau khi nhân bản), chấm điểm sửa lỗi là `resolved`, disposition `ship`; detector cơ học không còn finding. `DESIGN.md` đã thiếu trước thay đổi này; không tạo hệ thống thiết kế hay sidecar mới cho một phần mở rộng cục bộ, và không sửa khoảng trống tài liệu có sẵn đó trong lượt này.

Lượt bổ sung xóa dự án dùng lại dialog, nút và icon SVG hiện có. Nút thùng rác mở bảng xác nhận nền đỏ nhạt ngay trong danh sách, ghi tên dự án, số tệp, dung lượng, việc giữ tài nguyên dùng chung và cảnh báo không thể hoàn tác. Các nút tự xuống dòng ở chiều rộng hẹp; focus ban đầu ở **Giữ lại**. Mã nguồn khớp ảnh `docs/images/projects-delete.png` (1280×720) và `mobile.png` (390×844); review kết luận `ship`, không có sửa đổi UI trọng yếu hay finding cơ học. Backend chỉ được lấy mẫu trong review giao diện; suite kiểm tra mã báo 82 đạt, 2 bỏ qua và nhóm kiểm tra lưu trữ/xóa tập trung có 7 kiểm tra đạt. Đây tiếp tục là phần mở rộng cục bộ, không thay hệ thống thiết kế.
