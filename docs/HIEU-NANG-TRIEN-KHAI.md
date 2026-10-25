# Triển khai hiệu năng cho editor

Cập nhật 25/10/2026. Đối chiếu [kế hoạch hiệu năng](TOI-UU-HIEU-NANG.md).

## Đã triển khai

### Chỉnh sửa và timeline

- Player gửi frame vào `PlaybackClock`; App chỉ cập nhật khi đổi cảnh hoặc seek/tạm dừng. Playhead thay đổi transform trực tiếp, đồng hồ cập nhật 10 lần/giây. Clock luôn lấy thời gian của Remotion, không tự tạo đồng hồ audio khác.
- Timeline chỉ dựng clip/cue giao với vùng nhìn và vùng đệm. Ở chế độ vừa khung, clip nhỏ bỏ ảnh/chữ/waveform, cue dày gộp thành khối; zoom lên sẽ hiện lại chi tiết. Có thể zoom tới 500 lần để xem dự án dài.
- Waveform dùng canvas; các mức peak được cache theo dữ liệu nguồn. Không còn tạo 160 SVG line cho mỗi voice trong mỗi lần render.
- Scrub gom theo rAF, khi thả chuột luôn áp dụng vị trí cuối. Các nút và slider vẫn có thể dùng bàn phím; cue gộp là biểu diễn mật độ, cần phóng to để chọn từng câu.
- Timeline, asset và voice được lập chỉ mục. Phụ đề trong composition tìm câu bằng binary search.
- Composition chỉ mount các cảnh hiện tại, cảnh chuyển tiếp và vùng premount một giây, thay vì giữ cây Sequence cho toàn bộ video.

Các file chính: `src/editor/performance.ts`, `src/editor/Timeline.tsx`, `src/App.tsx`, `src/Video.tsx`, `src/TextRender.tsx`.

### Preview và media

- Compile preview chạy trong Web Worker, gom thay đổi trong 80 ms. Cache theo cấu hình/cảnh tái sử dụng phần dựng cảnh không đổi; khóa cache gồm cả thứ tự và chuyển động cảnh trước để giữ đúng chuyển động có seed. Bản mới thay thế kết quả cũ; worker đang tính preview cũ được dừng nếu có yêu cầu mới, tránh dồn hàng đợi.
- Dựng bản không có alignment cũng chạy trong worker và có thể hủy. Với alignment, phần chuẩn bị audio/compile phía server chạy trong worker thread; model Python vẫn nằm trong `.venv` chung.
- Timeline/sidebar dùng thumbnail 384 px. Preview dùng proxy tối đa 1440 px, chế độ tiết kiệm dùng 960 px và giảm kích thước xử lý pixel của CanvasImage còn một nửa mỗi chiều.
- Chế độ Tự động theo dõi tiến triển frame thực tế của Remotion, bỏ qua seek/nhảy thời gian, hạ chất lượng preview khi thiếu frame kéo dài và phục hồi có độ trễ khi ổn định. Không thay đổi clock, FPS hoặc audio của video.
- Tọa độ, thời gian, bố cục chữ và cấu hình export giữ nguyên. Export dùng master đang chọn sau xử lý ảnh; proxy không được ghi đè vào đường dẫn master của project.
- Proxy dùng Pillow có sẵn trong môi trường uv, không thêm thư viện. Nếu chưa có Python/Pillow thì giao diện dùng lại ảnh gốc; khả năng tiết kiệm RAM sẽ giảm.
- Cache proxy tối đa khoảng 512 MiB, dọn theo lần truy cập cũ khi khởi động và theo đợt tạo proxy. Không dọn ảnh gốc, ảnh đã xử lý hoặc model. Cache trình duyệt vẫn do trình duyệt quản lý.

Các file chính: `src/editor/project-worker.ts`, `project-client.ts`, `useStoryPreview.ts`, `PreviewVideo.tsx`, `scripts/media-proxy.mjs`, `media-proxy.py`.

#### Khôi phục ảnh preview và thumbnail khi có nhiều ảnh

- Sidebar chỉ yêu cầu thumbnail trong vùng nhìn và vùng đệm; dùng placeholder có chiều cao cố định trong lúc tải. Loader dùng chung giới hạn ba ảnh đang tải/giải mã, dành một chỗ cho ảnh của frame đang xem; ảnh sắp tới được ưu tiên hơn thumbnail đang chờ. Cache phía ứng dụng chỉ giữ tối đa 192 URL thành công, không giữ toàn bộ bitmap của dự án.
- Preview tải đệm hai cảnh kế tiếp sau 120 ms ổn định. Các yêu cầu trùng nguồn/kích thước dùng chung; tua sang chỗ khác sẽ hủy yêu cầu không còn người sử dụng, kể cả khi còn nằm trong queue. Server cũng hủy tạo proxy khi mọi client của proxy đó đã ngắt kết nối. Proxy 960/1440 px có ưu tiên cao hơn thumbnail 384 px trong queue Python; metadata nhập ảnh vẫn có ưu tiên riêng cao hơn.
- Proxy lỗi tải/giải mã hoặc chờ hơn tám giây thì loader tự thử ảnh gốc; ảnh gốc có thời hạn 15 giây mỗi lần và thử tối đa hai lần. Nếu cả hai đường dẫn đều lỗi, hiện **Tải lại ảnh**, không để lại biểu tượng ảnh vỡ hoặc màn hình đen không giải thích. Nút tile lỗi bên trái cũng dùng được bằng bàn phím.
- Player chờ ảnh đang xem sẵn sàng trước khi chạy tiếp; có nhãn **Đang tải preview…** sau 200 ms để tránh chớp nhãn ở cache hit. Giữ clock và voice của Remotion cùng trạng thái buffering; không đổi thời lượng, phụ đề hoặc dữ liệu dự án. Cảnh premount chưa xuất hiện không chặn playback.
- Server kiểm tra cấu trúc/độ dài container WebP trước khi dùng cache, tái tạo file rỗng/cụt. Lỗi nội dung ảnh mà kiểm tra container không nhận ra vẫn được browser xử lý bằng ảnh gốc. File proxy biến mất khi đang phục vụ sẽ không gây lỗi stream làm dừng server.
- Export tiếp tục dùng master, không qua loader giao diện. Không cài thêm thư viện hay model. Khởi động lại server và tải lại tab sau cập nhật.

Kiểm chứng lượt sửa: năm test tập trung vào tải hàng trăm thumbnail, slot ưu tiên preview, hủy/dedup, fallback khi lỗi/chờ lâu, thử lại ảnh gốc và tái tạo cache WebP cụt bằng Pillow trong `.venv` chung. Browser dùng bộ 108 ảnh với dự án/cache thử riêng: ảnh 58, ảnh 108 đều hiển thị; playback đi qua cảnh 58–60; cố tình tạo proxy hỏng cho ảnh 90 xác nhận cả preview và thumbnail chuyển sang master và giải mã thành công. Đây là kiểm tra chức năng, không phải cam kết FPS cho mọi máy. Ảnh minh chứng: [preview-recovery-108.png](images/preview-recovery-108.png).

Các file bổ sung: `src/editor/image-resources.ts`, `useImageResource.ts`, `ProxyThumbnail.tsx`, `PreviewImage.tsx`; test: `tests/image-loading.test.mjs`. Dữ liệu thử được dọn sau kiểm tra, ảnh gốc/dự án người dùng không bị sửa.

Lint/TypeScript, build, kiểm tra cú pháp server và `git diff --check` đều qua. Nhóm `image-loading`, `editor-performance`, `performance-refinements`: **21/21 test qua**, không chạy model hay gọi dịch vụ bên ngoài. Server thử cổng 3212 đã tắt.

### Nhập file và lưu bản nháp

- Tối đa hai upload đang chạy; phân tích voice và tạo proxy có queue riêng, mỗi queue một tác vụ. Đọc metadata ảnh có ưu tiên cao hơn tạo proxy.
- Ảnh PNG lấy kích thước từ header mà không giải mã toàn bộ trong trình duyệt. JPEG/WebP dùng metadata đọc bằng Pillow để tôn trọng EXIF; khi thiếu Pillow sẽ dùng browser làm dự phòng.
- Kết quả nhập xuất hiện theo đợt, giữ thứ tự file. Lỗi một file không loại bỏ các file thành công. Hủy nhập giữ lại phần đã nhận. Nếu cả lô thất bại thì đầu vào cũ được giữ.
- Voice upload stream xuống đĩa; đọc WAV/giải mã MP3 và tạo envelope chạy trong worker thread. WAV/MP3 gốc giữ nguyên byte để preview/xuất.
- File ảnh giống nhau dùng chung tên SHA-256 và không ghi lại file đã tồn tại. Không tải lại cả ảnh trong browser chỉ để lấy kích thước khi server đã cung cấp metadata.
- Autosave hiện lưu riêng từng dự án vào `data/projects/`, gửi patch và waveform thay đổi qua utility worker. Worker Node ghi journal nhỏ, tuần tự hóa và kiểm tra revision, định kỳ gộp snapshot. Cơ chế IndexedDB trước đây chỉ còn dùng để chuyển bản nháp cũ. [Chi tiết](QUAN-LY-DU-AN.md).
- Đọc draft IndexedDB/localStorage cũ để migration; chỉ dọn sau khi server xác nhận đã lưu vào data. Có flush khi tab chuyển sang nền và trước khi chuyển dự án; Tệp → Tải bản sao JSON để tải thêm bản cấu hình.
- Request compile/alignment/TTS/xử lý ảnh/xuất không mang theo envelope không cần thiết. Kết quả căn phụ đề được ghép lại waveform sẵn có ở client.

Các file chính: `src/editor/story-import.ts`, `workspace-storage.ts`, `scripts/voice-worker.mjs`, `voice-analysis.mjs`, `narration-worker.mjs`, `narration-task.mjs`.

### Xuất nền và quản lý tài nguyên

- Export tạo snapshot trên đĩa trước khi trả job ID; chạy trong process riêng. Sửa tên, setting, ảnh hoặc TXT của editor sau đó không thay đổi file snapshot.
- Giao diện tiếp tục cho chỉnh sửa khi export chạy. Có thể xếp thêm bản xuất; một job render tại một thời điểm, tối đa năm job đang chạy/chờ. Nút đồng hồ mở lịch sử để tải MP4/SRT, hủy hoặc xuất lại đúng snapshot.
- Queue tài nguyên dùng chung cho export, alignment, TTS và xử lý ảnh; các tác vụ nặng không chạy chồng lên nhau. Upload/metadata/proxy và API vẫn hoạt động độc lập với queue này.
- Mặc định Ưu tiên chỉnh sửa: concurrency render 1, media cache 240–256 MiB. Mức tính theo RAM tổng/trống nhưng luôn có sàn 240 MiB (251.658.240 byte) vì `@remotion/media` không chấp nhận thấp hơn.
- Xuất nhanh: concurrency chọn theo số CPU/RAM, tối đa 4; media cache 240–768 MiB, tính theo 1/16 RAM tổng và 1/4 RAM trống, có sàn hợp lệ 240 MiB. Chế độ được chốt theo job; đổi dropdown áp dụng cho lần xuất tiếp theo.
- Chuẩn hóa cache ở ngân sách, worker nhận request cũ và ngay trước `renderMedia`, tránh lỗi giá trị 32 MiB từ logic tối ưu cũ. Sau cập nhật cần khởi động lại server rồi xuất lại tác vụ lỗi; không phải tạo lại voice chỉ để sửa giới hạn cache.
- Kiểm chứng sửa lỗi cache: 18 kiểm tra budget/worker/hiệu năng qua, gồm RAM trống rất thấp và request cũ 33.554.432 byte được nâng lên 251.658.240 byte trước khi gọi renderer. Test worker dùng renderer giả lập để kiểm tra giới hạn, không render lại video thật, không chạy model hay thêm dependency.
- Render/Python được hạ ưu tiên CPU nếu OS hỗ trợ; Torch xử lý ảnh và căn voice giới hạn hai CPU thread. Đây không phải giới hạn cứng RAM/GPU của cả ứng dụng.
- Bundle render được cache theo hash source, public và package-lock; chỉ công bố thư mục bundle đã hoàn thành. Các worker export sau dùng lại bundle cùng phiên bản.
- Tiến độ worker giới hạn khoảng bốn lần/giây; client poll khoảng 1,2 giây. Job metadata lưu định kỳ và lúc kết thúc.
- MP4 ghi tạm, chỉ chuyển sang tên cuối sau thành công. Hủy gửi tín hiệu xuống worker/process group, có thời hạn buộc dừng. Worker dừng khi mất kết nối IPC với server.
- Server khởi động lại vẫn đọc được lịch sử. Job bị gián đoạn chuyển sang lỗi rõ ràng, có thể bấm Xuất lại bản này từ snapshot; không tự báo hoàn tất.

Các file chính: `scripts/resource-queue.mjs`, `export-jobs.mjs`, `export-worker.mjs`, `render-bundle.mjs`, `render-project.mjs`, `src/editor/ExportPanel.tsx`.

## Cách chạy sau cập nhật

Cần **khởi động lại server**, vì route worker/proxy và điều phối export đã thay đổi. Không chỉ tải lại tab đang nối server cũ.

```bash
npm run build
npm start
```

Hoặc chạy `npm run dev` sau khi dừng phiên dev cũ. Không chạy hai server cùng lúc để xuất video: các cổng nội bộ Remotion 3231/3232 đang dùng chung.

Không có dependency mới trong lượt này. Nếu môi trường Python hiện tại chưa có Pillow, dùng `uv sync` như trước. Không cần tải thêm model.

Dữ liệu sinh ra:

| Nơi lưu | Nội dung |
| --- | --- |
| `data/projects/<id>/workspace.json` + `changes.jsonl` | Bản chỉnh sửa đầy đủ và journal của từng dự án, gồm waveform |
| `data/projects/index.json` | Danh sách nhẹ, dự án gần nhất; có thể tái tạo |
| `data/uploads/` | Ảnh và voice gốc/master; không tự xóa |
| `.cache/proxies/` | Thumbnail/proxy WebP, có thể tái tạo |
| `.cache/render-bundles/<hash>/` | Bundle theo phiên bản code, có thể tái tạo khi không có job đang dùng |
| `data/jobs/<id>.snapshot.json` | Bản dựng bất biến dùng để thử xuất lại |
| `data/jobs/<id>.json` | Trạng thái và link kết quả |
| `data/exports/` | MP4, SRT và file tạm của job đang chạy |

Các thư mục runtime trên đã nằm trong quy tắc gitignore hiện có. Không xóa `data/jobs` nếu còn cần lịch sử hoặc xuất lại snapshot. Không tự động dọn master vì job có thể đang tham chiếu nó.

## Kiểm chứng đã thực hiện

- Lint/TypeScript và build đã qua.
- Bộ test hiện có đã qua; các thay đổi compiler/cache sau đó được kiểm tra bằng các nhóm auto/story và chín nhóm hiệu năng liên quan. Hai kiểm tra server được tách riêng để không tự mở server/render mỗi lần `npm test`.
- Test hiệu năng mới kiểm tra: clip giao viewport, cache waveform, hủy queue, compile worker, snapshot không đổi khi project sửa, phục hồi metadata sau restart, retry/hủy export, giới hạn concurrency nhập và giữ phần thành công, dừng preview cũ, cache bundle.
- Fixture tổng hợp 300 cảnh / 300 voice / 6.000 câu / 3 giờ: 637 nút DOM trong timeline fit, không có SVG waveform line. Lượt chạy riêng render HTML khoảng 10–15 ms; đây là SSR trong Node, **không phải bằng chứng 60 FPS hay INP trên trình duyệt**.
- Trình duyệt: play/pause, đồng hồ, đổi chuyển động qua worker, tải lại và khôi phục IndexedDB; kiểm tra bố cục mobile và desktop.
- Server tạm: upload PNG → metadata/proxy WebP nhẹ hơn; upload WAV → đọc lại byte giống nguồn; xuất MP4 thật 0,5 giây bằng process nền, API vẫn trả lời trong lúc render. File kiểm tra được dọn sau lượt chạy.
- Không gọi TTS/dịch từ xa hay chạy model AI để kiểm tra hiệu năng. Không benchmark render video dài hàng giờ.

Chạy lại các kiểm tra liên quan khi cần:

```bash
npm run build
node --test tests/editor-performance.test.mjs
```

Kiểm tra tích hợp cần một server kiểm tra riêng đã chạy; không trỏ vào server đang có dữ liệu/tác vụ quan trọng:

```bash
KHUNG_TEST_SERVER=http://127.0.0.1:3211 node --test tests/server-performance.test.mjs
# Bổ sung render clip ngắn thật:
KHUNG_TEST_SERVER=http://127.0.0.1:3211 KHUNG_TEST_RENDER=1 node --test tests/server-performance.test.mjs
```

Để đo trên dữ liệu thật, mở editor với `?perf=1`. Trong console trình duyệt:

```js
window.khungPerformance.report()
window.khungPerformance.reset()
```

Bộ đo chỉ bật khi có query này, giữ tối đa 10.000 mẫu mỗi loại, không thu nội dung file/lời đọc. `inputToSecondRafMs` là thời gian tới rAF thứ hai, không phải chỉ số INP chuẩn; `frameGapsMs` là khoảng cách rAF UI. Long Task API phụ thuộc trình duyệt. Dùng profiler của trình duyệt để đo FPS preview, CPU, layout/paint và process monitor để đo tổng RAM Chromium/Node/FFmpeg/Python.

## Phạm vi còn cần đo/nghiên cứu theo kế hoạch

Các mục tiêu latency/FPS trong kế hoạch là tiêu chí nghiệm thu đề xuất; chưa có đủ dữ liệu để khẳng định đạt trên mọi cấu hình M3/M4 hoặc mọi effect.

- Compile tái sử dụng phần dựng cảnh theo khóa dependency; bước kiểm tra project, phân bổ thời gian toàn cục và lập phụ đề vẫn duyệt project trong worker để giữ tính đúng. Chưa chuyển toàn bộ pipeline thành đồ thị dependency.
- Chưa cache sẵn video cho từng đoạn hiệu ứng nặng. Proxy và giảm độ phân giải pixel là cơ chế đang dùng.
- Chưa tự bật hardware encoding: cần benchmark chất lượng/dung lượng với binary và máy thực tế trước khi lựa chọn.
- Phần P4 vẫn là nghiên cứu mở rộng: một file voice hàng giờ, render theo đoạn có checkpoint/resume giữa job và worker trên máy khác. Lịch sử hiện tại cho phép **xuất lại toàn snapshot**, chưa tiếp tục từ frame đã render dở.
- Hợp đồng đầu vào hiện tại vẫn tối đa 300 ảnh/300 voice, mỗi voice 5 phút/100 MB. Validator project hiện giới hạn tổng video 60 phút; đợt tối ưu hiệu năng giữ nguyên giới hạn này. Fixture 3 giờ phía trên chỉ dùng để kiểm tra cấu trúc timeline, không xác nhận nhập/xuất project 3 giờ. Không âm thầm bỏ các giới hạn hoặc cắt file dài để giả vờ hỗ trợ.

Các phần này được giữ rõ trạng thái thay vì đánh dấu toàn bộ kế hoạch đã hoàn thành. Cần đo dự án lớn thực tế sau cập nhật để chọn bước tối ưu tiếp theo và ngân sách tài nguyên phù hợp máy.


## Đợt tối ưu tiếp: giữ nguyên xử lý nội dung

- Cửa sổ lời đọc virtualize theo lượt nói, đo chiều cao thực tế khi resize và giữ lượt đang focus kể cả khi cuộn ra ngoài. Chọn tất cả/gán giọng vẫn tác động lên toàn bộ danh sách, không chỉ các lượt đang mount.
- Mỗi ô nhập giữ text cục bộ. Gom cập nhật tài liệu trong 250 ms, flush khi blur, đóng bằng Escape/nút đóng, chuyển chế độ, tạo voice và thao tác cấu trúc. Tổng hợp script/dialogue theo một lượt duyệt, giữ đúng thứ tự số cảnh, thứ tự lượt và giọng đã gán. Không tự đổi câu hoặc timing.
- Worker preview truyền patch cho đầu vào và kết quả, thay vì gửi lại toàn project. Bản đầu vẫn cần snapshot đầy đủ. Patch giữ thứ tự mảng, xóa trường, giá trị undefined và tham chiếu của dữ liệu không đổi. Waveform tiếp tục ở client và được ghép lại vào đúng voice.
- Kiểm tra ảnh–TXT–voice và độ mới TTS chạy cùng worker preview. Hành động tạo voice vẫn kiểm tra lại độ mới từ đầu vào hiện tại, tránh dùng kết quả validation cũ trong lúc cập nhật.
- Worker dữ liệu xử lý mở project/preset và tạo JSON download bằng chính parser hiện có. Không thay schema các file trao đổi.
- Ở đợt tối ưu trước, IndexedDB v3 lưu scene/asset/audio metadata riêng, chỉ ghi record thay đổi và manifest nhỏ trong cùng transaction. Cơ chế ghi này đã được thay bằng kho dự án trong data; mã đọc v3 giữ lại để migration. Các bản ghi metadata không còn được manifest tham chiếu được dọn; waveform cache được giữ riêng. Draft cũ chỉ bị bỏ sau khi transaction mới thành công. Khi tab khác đã ghi, lần lưu kế tiếp công bố lại toàn snapshot để tránh dữ liệu bị trộn. Nếu không đọc được bản nháp, autosave không ghi bản trống lên bản cũ.
- Preview tiết kiệm dùng proxy cho PNG/rig/sprite và ít hạt lớp phủ hơn. Seed, vị trí và thời gian của các hạt giữ nguyên; chỉ giảm chi tiết preview. Chế độ đầy đủ và export vẫn dùng số hạt, công thức animation, media master và cấu hình mã hóa cũ.
- Cache các thông số hạt không phụ thuộc frame, lập map actor/voice, prewarm tối đa ảnh cảnh kế tiếp sau 200 ms ổn định; không tải trước cả project.
- Ngân sách render tính thêm RAM còn trống. Worker đánh giá lại lúc thực sự bắt đầu job và chỉ hạ concurrency/cache nếu cần; không đổi chất lượng, bitrate, thời lượng hoặc tự dừng job.

Kiểm chứng của đợt này:

- Lint/build và bộ test hiện có qua. Bảy nhóm bổ sung kiểm tra patch/immutability, chỉ gửi một cue thay đổi, flush text/phân vai, toán học lớp phủ đầy đủ, phản hồi frame/RAM trống, worker giữ đúng cue/voice và parser/JSON worker tương thích.
- Trình duyệt thật: migration bản mẫu ba ảnh/WAV; gõ rồi Escape ngay, reload vẫn giữ chữ; sau đó khôi phục nội dung mẫu.
- Fixture riêng 300 cảnh / 3.000 lượt nói / khoảng 34 phút: chỉ 3–5 ô nhập được mount ở các vị trí đã kiểm tra. Gõ rồi đổi giọng giữ đủ chữ; chọn tất cả vẫn nhận đủ 3.000 lượt. Hai tab lưu khác nhau rồi reload không trộn lời/phân vai của hai snapshot.
- Server tạm: upload WAV giữ nguyên byte, proxy ảnh và xuất MP4 thật 0,5 giây qua. Không gọi TTS/dịch bên ngoài, không tải/cài model hoặc dependency.

Các số trên xác nhận hành vi tại các tình huống đã kiểm tra, không phải cam kết FPS trên mọi máy. Mở `?perf=1` để đo tiếp trên dữ liệu thực tế. Sau cập nhật phải khởi động lại server để phục vụ thêm `utility-worker.js`.
