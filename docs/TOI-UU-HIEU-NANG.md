# Kế hoạch hiệu năng cho dự án lớn

Ngày: 24/10/2026. Đây là kế hoạch gốc. Các thay đổi đã làm, kiểm chứng và giới hạn còn lại được ghi tại [Báo cáo triển khai](HIEU-NANG-TRIEN-KHAI.md).

## 1. Hướng đề xuất

Giữ React + Remotion, tối ưu thành editor có cảm giác phản hồi như ứng dụng native. Tách giao diện tương tác, dữ liệu dự án, preview và các tác vụ xử lý nền. Chưa cần viết lại ứng dụng hoặc đóng gói desktop để giải quyết lag.

Ưu tiên mặc định là **chỉnh sửa mượt**, kể cả khi đang xuất. Xuất nhanh nhất có thể dùng hết tài nguyên máy và xung đột với mục tiêu này; vì vậy cần phân bổ tài nguyên, chấp nhận xuất lâu hơn khi người dùng đang làm việc. Không cam kết 60 FPS cho mọi hiệu ứng trên mọi máy.

Desktop shell không tự sửa được việc render toàn bộ timeline, giải mã ảnh gốc hay lưu dữ liệu đồng bộ. Chỉ cân nhắc đóng gói desktop sau khi kiến trúc hiệu năng đã ổn, nếu cần tích hợp filesystem, chạy nền và quản lý tiến trình thuận tiện hơn.

## 2. Những điểm đã xác định trong source

Đây là kết quả đọc code, chưa phải số liệu profiler trên dự án lớn thực tế.

| Vị trí | Hiện trạng | Hệ quả |
| --- | --- | --- |
| `src/App.tsx` | `frameupdate` gọi `setFrame` ở App | Toàn cây giao diện có thể render lại theo nhịp phát |
| `src/editor/Timeline.tsx` | Map toàn bộ clip/caption; tính waveform trong render | Chi phí tăng theo cả dự án, kể cả nội dung ngoài viewport |
| Timeline | Background thumbnail dùng `asset.src` gốc | Tải và giải mã ảnh lớn chỉ để hiển thị ô nhỏ |
| `src/auto/story.ts` | `previewStory` dựng/kiểm tra lại project khi đầu vào hoặc setting thay đổi | Công việc đồng bộ trên luồng giao diện, đặc biệt khi kéo slider |
| App | Ghi toàn bộ workspace bằng JSON + localStorage sau 400 ms | Serialization và ghi đồng bộ có thể gây khựng; waveform chiếm dung lượng |
| `src/editor/story-import.ts` | Upload tuần tự; ảnh được tải lại và decode lấy kích thước | Nhập lô lớn lâu, chưa có pipeline thumbnail/metadata riêng |
| `scripts/server.mjs` | Tính `wavEnvelope` đồng bộ trong server | Có thể trì hoãn API và phục vụ media trong lúc phân tích voice |
| `scripts/render-project.mjs` | Điều phối render trong server; concurrency cố định 2 | Chưa có scheduler chia tài nguyên cho export, AI và chỉnh sửa |
| App | `busy` bao gồm job export đang chạy | Nhiều thao tác chỉnh sửa bị khóa dù có thể làm trên revision khác |

Remotion đã dùng các Sequence theo khoảng thời gian và premount một giây. Không phải toàn bộ ảnh/voice trong video đều đang phát cùng lúc; vẫn cần tối ưu cây Sequence, tra cứu và dữ liệu truyền vào. FFmpeg/Chromium đã là các tiến trình riêng, nhưng việc này chưa tương đương một hệ thống job độc lập có giới hạn tài nguyên.

## 3. Kiến trúc đích

```text
Editor UI — chỉ giữ phần dữ liệu cần hiển thị
  ├─ Playhead/đồng hồ độc lập
  ├─ Timeline chỉ dựng vùng nhìn thấy
  ├─ Preview dùng media nhẹ
  └─ Project store theo revision
       ├─ Web Worker: compile, chỉ mục, chuẩn bị dữ liệu
       ├─ IndexedDB: draft, thay đổi và cache nhỏ
       └─ API: manifest + asset ID + job ID
            ├─ Metadata/media server phản hồi nhanh
            ├─ Queue nhập media và tạo proxy
            ├─ Worker waveform / alignment / xử lý ảnh
            └─ Export worker: snapshot bất biến + ảnh/voice gốc
```

Không chuyển cả project/waveform qua worker mỗi frame. Dùng thông điệp theo revision, patch và ID; dùng transferable buffer cho dữ liệu nhị phân khi phù hợp. Worker tính dữ liệu, không trực tiếp thao tác DOM.

## 4. Chỉnh sửa và timeline

### Tách cập nhật nhanh khỏi React tree lớn

- Playhead nhận clock của Player riêng. Dùng ref/rAF cho vị trí; đồng hồ số cập nhật khoảng 10 lần/giây, trạng thái cảnh chỉ cập nhật khi đổi cảnh.
- Không tạo clock độc lập có thể trôi khỏi audio. Seek, pause và kết thúc phải lấy lại vị trí thực của Player.
- Chia store theo selection, setting, project và job. Component subscribe phần cần dùng; giữ props/callback ổn định trước khi áp dụng memo.
- Memo hóa chỉ mục timeline, tổng thời lượng, map asset/voice theo ID, danh sách caption. Thay nhiều `.find()` lồng nhau bằng map và tìm kiếm nhị phân theo thời gian.
- Khi kéo slider: phản hồi trực tiếp cảnh đang xem; gom thao tác thành một lần commit/undo, debounce compile toàn cục. `startTransition` không thay thế worker cho CPU work nặng.

### Timeline chỉ dựng phần cần nhìn

- Virtualize theo khoảng thời gian đang nhìn + vùng đệm; xử lý clip giao nhau với viewport, không chỉ clip có điểm bắt đầu trong viewport.
- Ở chế độ vừa toàn video, hàng trăm clip vẫn nằm trong viewport: bổ sung mức chi tiết theo zoom. Clip quá hẹp chỉ là khối màu, bỏ thumbnail/chữ/waveform; caption dày được gộp trực quan.
- Khi zoom gần mới hiện ảnh, chữ và sóng chi tiết. Giữ selection/keyboard navigation bằng ID, không phụ thuộc DOM đang mount.
- Waveform tạo một lần, cache nhiều mức độ chi tiết theo số pixel. Dùng canvas theo vùng nhìn thay cho hàng nghìn SVG line; không duyệt lại toàn envelope trong mỗi render.
- Scrub ưu tiên yêu cầu mới nhất, giới hạn số lần seek; thả chuột luôn seek chính xác tới frame cuối. Hủy kết quả cũ bằng revision/token.

## 5. Media nhẹ cho preview, bản gốc cho export

- Khi nhập: server đọc metadata, tạo thumbnail khoảng 256–512 px và proxy ảnh theo kích thước preview. Các kích thước này là điểm khởi đầu để đo, không cố định cho mọi ảnh.
- Tách rõ original / processed master / thumbnail / preview proxy. Sau xóa logo hoặc upscale, tạo lại proxy từ bản master mới; xuất dùng master đã được chọn, không tự quay về bản gốc chưa xử lý.
- Cache theo hash nội dung + phiên bản thuật toán + tham số, tránh xử lý lại file giống nhau.
- Chỉ tải media cho cảnh hiện tại và vùng lân cận có giới hạn. Giải phóng object URL, bitmap và tài nguyên không còn dùng; cache có ngân sách và chính sách LRU.
- Preview có chế độ Tự động / Tiết kiệm / Chi tiết. Tự động giảm độ phân giải xử lý hiệu ứng khi thiếu frame, không thay đổi tọa độ bố cục, phụ đề hay thời gian.
- Thu nhỏ CSS của Player đơn thuần chưa giảm chi phí CanvasImage/effect. Cần truyền chất lượng preview vào phần xử lý pixel trong khi giữ hệ tọa độ composition; export luôn dùng cấu hình đầy đủ.
- Với cảnh hiệu ứng rất nặng, cân nhắc cache video preview của đoạn đó khi nhàn rỗi. Cache phải bao gồm revision, font, asset và effect; không dùng preview cũ sau khi sửa.

## 6. Nhập file và dữ liệu dự án dài

- Queue nhập có concurrency nhỏ, ví dụ khởi điểm 2 upload và 1 decode/analysis; đo trước khi tăng. Không `Promise.all` hàng trăm ảnh.
- Hiện placeholder ngay; metadata, thumbnail và waveform hoàn thành dần. Gom cập nhật UI theo đợt, tránh rebuild toàn bộ project sau từng file.
- Tách việc upload thành công khỏi waveform/proxy đang chuẩn bị. Cho phép hủy/retry từng file và thao tác với các cảnh đã sẵn sàng.
- Đưa waveform sang worker thread/process; decode MP3 tiếp tục bằng FFmpeg. Streaming file upload xuống đĩa thay vì giữ toàn bộ request rồi Buffer.concat khi cần hỗ trợ file lớn.
- Lưu manifest/draft bằng IndexedDB bất đồng bộ; lưu waveform riêng, chỉ lấy khi cần. localStorage chỉ giữ tùy chọn nhỏ. Migration draft cũ có xác nhận ghi thành công trước khi bỏ bản cũ.
- Autosave theo revision/patch; checkpoint định kỳ, flush khi có thể và hiển thị trạng thái đã lưu. Không phụ thuộc duy nhất vào sự kiện đóng tab để chống mất dữ liệu.
- Backend lưu project/job manifest bền vững để tải lại trang hoặc khởi động lại không mất trạng thái. Không nhúng waveform và media bytes vào mọi request.

Giới hạn hiện tại: 300 ảnh, 300 voice, mỗi voice tối đa 300 giây/100 MB. Tổng voice dài hàng giờ và một file voice dài hàng giờ là hai bài toán khác nhau. Giai đoạn đầu tối ưu tổng dự án dài trong giới hạn hiện có. Hỗ trợ file voice hàng giờ cần pipeline probe/stream/chunk, alignment theo đoạn kèm offset toàn cục, timeout và giới hạn mới; không chỉ bỏ validation 300 giây.

## 7. Xuất video khi vẫn chỉnh sửa

### Snapshot và tính đúng đắn

- Bấm Xuất tạo snapshot bất biến gồm revision project, tham số export và danh sách media. Người dùng tiếp tục sửa revision mới.
- Export worker đọc snapshot riêng; sửa/xóa/thay ảnh trong editor không được làm thay đổi job đang chạy. Ghim media mà job tham chiếu, dọn cache không xóa chúng.
- Tách khóa theo tác vụ: không khóa toàn app vì export. Chỉ khóa tài nguyên đang bị ghi hoặc thao tác xung đột thật sự.
- Trạng thái job rõ: chờ, chuẩn bị, render, mã hóa, hoàn thành, lỗi, đã hủy. Hiển thị “Đang xuất bản lúc …; thay đổi mới chưa nằm trong bản này”.
- Output ghi tạm rồi đổi tên khi hoàn tất; hủy phải dừng cả process con và dọn file tạm. Crash phải có trạng thái khôi phục rõ, không tự báo thành công.

### Chia tài nguyên

- Chạy điều phối export trong worker process riêng; API chỉ tiếp nhận, phục vụ media và gửi tiến độ nhỏ, tối đa vài lần/giây. Tách process giúp cách ly nhưng không tự giới hạn CPU/RAM/GPU.
- Có scheduler chung cho render, upscale, alignment và tạo proxy. Trên máy ít RAM, không chạy đồng thời nhiều tác vụ AI nặng với render.
- Mặc định “Ưu tiên chỉnh sửa”: một export job; thử concurrency 1 rồi đo để tăng. Tham số được chọn trước mỗi lần render; chưa giả định Remotion đổi concurrency an toàn giữa job.
- “Xuất nhanh” cho phép tăng concurrency sau benchmark. Đổi chế độ giữa job có thể chỉ áp dụng job sau; phải nói rõ trên UI.
- Giới hạn cache media theo RAM thực tế; theo dõi cả Chromium, FFmpeg, Python và Node. Một giới hạn cache không phải giới hạn toàn bộ bộ nhớ ứng dụng.
- Hạ ưu tiên tiến trình CPU nếu hệ điều hành hỗ trợ, nhưng đây không phải bảo đảm tránh tranh chấp GPU, băng thông bộ nhớ hay nhiệt độ.
- Benchmark hardware encoding nếu phiên bản/binary hỗ trợ; không mặc định bật để đổi lấy chất lượng kém hơn. Cần so chất lượng, dung lượng và tốc độ với cấu hình hiện tại. GPU encode không làm mọi animation React chạy trên GPU.

Không hứa pause/resume render tức thì. Phiên bản đầu có queue và hủy. Nếu cần phục hồi job nhiều giờ, nghiên cứu render theo đoạn có checkpoint sau: phải giữ frame toàn cục, overlap chuyển cảnh, audio liên tục và tránh nối AAC tạo khe hở. Đây là giai đoạn riêng.

Nếu cần xuất rất nhanh mà máy chỉnh sửa vẫn nhẹ, phương án mạnh nhất là worker trên máy khác/server. Đổi lại có upload, chi phí, bảo mật và quản lý dữ liệu; không đưa thành yêu cầu mặc định của bản local.

## 8. Lộ trình và tiêu chí hoàn thành

Các số sau là **mục tiêu nghiệm thu đề xuất**, không phải kết quả đã đo. Chốt máy chuẩn M3/M4 cùng dung lượng RAM, trình duyệt và nguồn điện trước khi so sánh.

| Giai đoạn | Thay đổi | Điều kiện hoàn thành |
| --- | --- | --- |
| P0 — Đo baseline | Đo render React, main-thread long task, seek, bộ nhớ và tải worker | Có cùng kịch bản trước/sau, xác định 3 điểm tốn thời gian nhất |
| P1 — UI | Tách playhead, memo/index, virtualize + mức chi tiết timeline, cache waveform | Click/gõ p95 dưới 100 ms; kéo/scroll hướng tới 60 FPS; không tăng DOM tuyến tính khi zoom ra |
| P2 — Media/dữ liệu | Thumbnail/proxy, worker compile, nhập theo queue, IndexedDB | Seek cảnh đã có proxy p95 dưới 200 ms; không chặn UI trên 200 ms do autosave; RAM ổn định sau nhiều lần seek |
| P3 — Export nền | Snapshot, job process/queue, resource budget, bỏ khóa toàn app | Sửa và lưu được khi export; click/gõ p95 dưới 150 ms; output đúng snapshot; hủy dọn được process/file tạm |
| P4 — Dự án rất dài | Audio dài theo chunk, phục hồi job, tùy chọn remote worker | Không mất offset caption/voice; job phục hồi không làm đổi timing hay lặp/mất đoạn |

Đo preview theo FPS thật của composition: video 30 FPS hướng tới phát đủ 30 FPS, UI kéo/cuộn hướng tới 60 FPS. Phân biệt seek cache nóng/lạnh và không lấy độ trễ tải file lạnh để đánh giá riêng React.

Chỉ cần một bộ kiểm tra hiệu năng nhỏ, lặp lại được:

- Nhỏ: 30 ảnh, tổng voice 10 phút, khoảng 300 cue.
- Lớn: 100 ảnh, tổng voice 60 phút, khoảng 2.000 cue.
- Biên hiện tại: 300 ảnh, tổng voice 180 phút, khoảng 6.000 cue; mỗi voice vẫn dưới 5 phút.
- Trộn ảnh 1080p/4K và một số ảnh upscale, có phiên bản ít/nhiều effect. Dùng fixture do mình kiểm soát, không tải model hoặc bộ dữ liệu lớn chỉ để test.
- Mỗi bộ: nhập, play 60 giây, scrub liên tục, zoom/scroll, sửa caption/setting, autosave, rồi lặp thao tác trong lúc export. Ghi p50/p95 latency, dropped frames, long tasks, RAM từng tiến trình và thời gian export.
- Kiểm tra riêng tính đúng: preview/proxy không đổi bố cục; snapshot giữ nguyên dù editor sửa; caption/voice không lệch sau tối ưu; dừng job không để tiến trình mồ côi.

Ưu tiên triển khai P1 rồi P2, tiếp đến P3. Không tăng concurrency render trước khi giải quyết tải giao diện và ngân sách bộ nhớ. Giữ một `.venv` do uv quản lý cho mọi worker Python, không thêm môi trường hay model chỉ để tối ưu hiệu năng.

## 9. Tài liệu tham chiếu

- [MDN — Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API): chuyển công việc tính toán khỏi main thread.
- [MDN — IndexedDB trong worker](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/indexedDB): truy cập kho dữ liệu từ worker.
- [Remotion — Options](https://www.remotion.dev/docs/options): concurrency, cache media và các lựa chọn render. Cần kiểm tra khả năng trong phiên bản dự án đang ghim trước khi triển khai.
- [Remotion — renderer source](https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/render-media.ts): tham khảo các tham số render; nhánh main có thể khác bản 4.0.537 đang dùng.

Tài liệu này giữ nội dung kế hoạch để đối chiếu. Xem [Báo cáo triển khai](HIEU-NANG-TRIEN-KHAI.md) để phân biệt tính năng đã có với phần chưa triển khai.
