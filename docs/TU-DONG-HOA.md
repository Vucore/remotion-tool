# CLI dựng tự động từ bộ ảnh + AutoConfig

**v0.4 có thêm WAV + TXT và tự căn phụ đề từng câu.** Xem [cài bằng uv và luồng dựng theo voice](VOICE-VA-PHU-DE.md). Tài liệu bên dưới mô tả chế độ ảnh không có voice; quy tắc trừ thời gian chồng lấn không áp dụng cho chế độ voice.

Bản hiện tại nhận cả WAV/MP3, có thể trộn trong thư mục voice CLI hoặc ô Voice trên web. Nguồn lưu/preview/xuất giữ nguyên định dạng; WAV tạm chỉ dành cho phân tích/căn phụ đề. [Chi tiết](HO-TRO-MP3.md).

Luồng chính: **bộ ảnh + config → tạo toàn bộ cảnh → áp quy tắc → Remotion xuất MP4**. Không phải ngồi chỉnh từng ảnh và không phải viết mã React cho mỗi video.

## Trên web

Giao diện hiện tại có ba ô riêng cho ảnh, WAV và TXT, mẫu dựng đơn giản, dải ảnh trực quan và nút Tạo video. Lưu/mở mẫu bằng nút, không yêu cầu viết JSON. Xem [hướng dẫn web](HUONG-DAN.md) và [bộ minh hoạ](../test/README.md).

Phần dưới mô tả định dạng AutoConfig nâng cao của CLI. Đây là định dạng riêng với mẫu `.khung-preset.json` của web. Đường dẫn thư mục trong AutoConfig chỉ áp dụng cho CLI; video xuất từ web được lưu trong `data/exports/` theo ID tác vụ.

## Chạy không cần mở editor

Chuẩn bị:

```text
du-an/
  auto-edit.config.json
  images/
    01.jpg
    02.jpg
    03.jpg
```

Sao chép [config mẫu](examples/auto-edit.example.json) vào `auto-edit.config.json`, rồi chạy từ thư mục công cụ:

```sh
npm run auto -- --config /duong-dan/du-an/auto-edit.config.json
```

Lệnh npm tự build trước khi chạy. CLI tìm ảnh PNG/JPG/JPEG/WebP trực tiếp trong thư mục đầu vào, không đọc thư mục con. Các đường dẫn tương đối tính từ vị trí file config, kể cả `--images` và `--out`.

Kết quả mặc định trong `du-an/output/`:

- `video.mp4`: video H.264.
- `video.khung.json`: mở lại trong editor, giữ config.
- `video.report.json`: số cảnh, frame, thời lượng, hash ảnh/config, cảnh báo và trạng thái lần chạy.

Ảnh được lưu vào `data/uploads/` của công cụ theo hash nội dung. Giữ thư mục này cùng file dự án để mở lại đầy đủ.

```sh
# Chỉ tạo dự án/báo cáo và kiểm tra config, không mở Chromium hay render
npm run auto -- --config /duong-dan/du-an/auto-edit.config.json --plan

# Thay đầu vào hoặc đầu ra, vẫn dùng cùng quy tắc
npm run auto -- --config /duong-dan/du-an/auto-edit.config.json --images ./bo-anh-khac --out ./output/video-khac.mp4

# Chủ động ghi lại kết quả đã tồn tại
npm run auto -- --config /duong-dan/du-an/auto-edit.config.json --overwrite
```

CLI chỉ phục vụ các tài nguyên cần render bằng một tiến trình cục bộ tạm thời và đóng nó khi xong/lỗi/huỷ. Ctrl+C huỷ lượt xuất, xoá file MP4 tạm và giữ báo cáo lỗi/huỷ. Không cần tự mở server web.

## Chạy hàng loạt

Xem [jobs.example.json](examples/jobs.example.json). Mỗi công việc chỉ cần config và các đường dẫn muốn thay:

```json
{
  "jobs": [
    { "config": "./auto-edit.config.json", "images": "./bo-a", "out": "./output/a.mp4" },
    { "config": "./auto-edit.config.json", "images": "./bo-b", "out": "./output/b.mp4" }
  ]
}
```

```sh
npm run auto -- --batch /duong-dan/du-an/jobs.json
npm run auto -- --batch /duong-dan/du-an/jobs.json --resume
```

Đường dẫn `config` tính từ file danh sách công việc; `images` và `out` tính từ config của công việc đó. Chạy tuần tự để giới hạn bộ nhớ. Một công việc lỗi không làm mất những công việc đã xong. `--resume` chỉ bỏ qua kết quả có trạng thái `done` và hash đầu vào/config/engine khớp; đầu vào thay đổi thì dựng lại. Tối đa 100 công việc mỗi danh sách.

Lệnh ghi thêm `jobs.report.json` cạnh file danh sách để ghi nhận từng công việc hoàn tất/lỗi/huỷ/chưa chạy, kể cả lỗi kiểm tra đầu vào. Resume kiểm tra cả kích thước file MP4 so với báo cáo hoàn tất.

## Các nhóm config

`autoEditVersion` bắt buộc bằng `1`; các nhóm còn lại có mặc định. Không hỗ trợ JavaScript tuỳ ý. Các ID preset dùng đúng tên trong [danh mục](DANH-MUC-CHU-HIEU-UNG.md); trường không biết ở cấp nhóm sẽ báo lỗi thay vì bị bỏ qua.

| Nhóm | Trường chính |
| --- | --- |
| `template` | `story-clean@1`, `minimal@1`, `warm-travel@1`; ghim phiên bản mẫu. |
| `seed` | 0–99999; ổn định khi chọn chuyển động theo seed và lớp phủ. |
| `input` | `directory`, `order`: `natural` / `name` / `input`, `extensions`. Natural sắp 1, 2, 10. CLI dùng thứ tự tên ký tự làm đầu vào của chế độ input. |
| `output` | `file`, `ratio`: `9:16` / `16:9`, `fps`: 24/25/30/60, `quality`: high/standard, `name`, `background`: #RRGGBB. |
| `timing` | `mode`: per-image/total, `seconds`, `minSeconds`, `maxSeconds`. |
| `framing` | `fit`: cover/contain; `focus.x/y` từ 0 đến 1, mặc định giữa ảnh. |
| `motion` | `policy`: alternate/seeded; `presets`: danh sách ID chuyển động; `amount`, `easing`. Seeded tránh lặp ngay trước khi có nhiều lựa chọn khác nhau. |
| `transition` | `preset`, `seconds`: 0,1–2, `direction`, `easing`. Chuyển cảnh nằm trên cảnh đi trước. |
| `text` | `source`: none/filename/static/file; `content` cho static; `file`/`captions` cho file; `preset` và `style` là thuộc tính chữ. |
| `look` | `preset`: natural/warm/cool/mono/vintage; `scene`: các thuộc tính scene nâng cao, kể cả `effects`, `overlays`, `keyframes`, `texts`. |
| `overrides` | Danh sách `{file, scene, text?}` cho ngoại lệ theo tên ảnh, không theo vị trí trong danh sách. |

`look.scene` là lớp thiết lập nâng cao, áp sau các quy tắc chung. `overrides[].scene` áp sau cùng. Các định danh scene/lớp được công cụ tạo ổn định; không đặt `id` hoặc `assetId` trong config.

### Thời lượng tổng

`per-image` dùng số giây cho từng ảnh, làm tròn theo FPS. Tổng video trừ chồng lấn. Ba ảnh × 4s, hai đoạn nối × 0,5s → 11s.

`total` phân bổ số frame còn lại đều cho các cảnh chưa giữ/chưa đặt duration riêng, trong giới hạn min/max. Thời lượng cảnh đã giữ hoặc đặt riêng là cố định. Để tính chính xác, đoạn nối của cảnh chưa giữ được giới hạn theo **thời lượng cảnh tối thiểu**; báo cáo ghi rõ nếu phải rút ngắn đoạn nối. Cảnh giữ có chuyển cảnh dài có thể làm tăng thời lượng tối thiểu của cảnh tiếp theo. Nếu không đạt tổng thời lượng trong giới hạn, công cụ trả khoảng khả thi, không xuất bản dựng sai thời gian.

### Chữ theo từng ảnh

```json
{
  "01.jpg": "Mở đầu câu chuyện",
  "02.jpg": "Một điều bất ngờ",
  "03.jpg": "Và hành trình tiếp tục"
}
```

Lưu thành `captions.json`; config dùng `"text": {"source":"file","file":"./captions.json","preset":"subtitle"}`. Tên phải khớp tên ảnh, kể cả phần mở rộng; thiếu mục sẽ báo lỗi trước khi xuất. Chuỗi rỗng nghĩa là cảnh đó không có chữ tự sinh. File nội dung là đầu vào đã chuẩn bị, không phải phụ đề được nhận diện từ âm thanh.

### Effect và lớp phủ

Có thể viết gọn hiệu ứng bằng `kind` và các tham số muốn đổi; mặc định còn lại được lấy từ registry hiện có:

```json
{
  "look": {
    "preset": "warm",
    "scene": {
      "effects": [{ "kind": "brightness", "params": { "amount": 0.1 } }],
      "overlays": [{ "kind": "dust", "amount": 0.2, "speed": 0.6 }]
    }
  }
}
```

Stack gốc cũng nhận `start`, `end`, `automation` như dự án editor. Tham số vẫn được xác thực bằng schema của 81 effect hiện có. Hiệu ứng GPU tuỳ máy, không tự âm thầm bỏ qua effect khi render lỗi.

Điểm lấy khung tuỳ chỉnh dùng `object-position` cho ảnh thường. Stack effect gốc hiện dùng lấy khung ở giữa: khi kết hợp native effect đang bật với focus khác 0,5 trong cover, công cụ báo rõ để đổi config. Bộ lọc màu và lớp phủ vẫn dùng cùng focus tuỳ chỉnh được.

## Tạo mẫu config bằng thao tác chỉnh sửa

Trong **Tinh chỉnh**, chỉnh một cảnh mẫu rồi nhấn **Lưu mẫu config** trên thanh dưới. File này lấy thời lượng, khung ảnh, chuyển động, chuyển cảnh, màu, các lớp chữ, effect và keyframe của cảnh; thay bộ ảnh để dùng lại. Chữ được giữ như nội dung chung trong `look.scene.texts`. Khi muốn nội dung khác theo ảnh, đổi `text.source` thành file và cung cấp captions.

Config không chứa ảnh gốc. Font riêng của cảnh mẫu vẫn cần file font trong `data/fonts/` khi dùng web. CLI hiện dùng các font hệ thống hỗ trợ trong editor; chưa có manifest nhập font riêng từ config.

## Giữ chỉnh sửa và lưu dự án

Chỉnh tay một cảnh trong dự án tự động sẽ đánh dấu **Đang giữ**. Khi dựng lại với **Giữ cảnh đã chỉnh**, các cảnh đó không bị ghi đè. Bấm nhãn giữ trên cảnh để bỏ giữ; hoặc bỏ checkbox giữ khi dựng lại toàn bộ. Các cảnh thêm/chia thủ công được giữ theo cùng cơ chế.

Đổi cả bộ ảnh tạo đầu vào mới và xoá danh sách cảnh giữ của bộ cũ. Xoá một cảnh không xoá ảnh khỏi thư viện: dựng lại toàn bộ có thể tạo lại cảnh cho ảnh đó.

Config và danh sách giữ nằm trong trường `automation` tuỳ chọn của Project v1. JSON cũ vẫn đọc được; composition chỉ dùng dữ liệu render. Đây là cách triển khai thực tế thay cho ý tưởng bọc thêm định dạng file ở bản đề xuất.

Lần dựng tự động và thao tác kéo thời lượng/vị trí là từng bước hoàn tác. Tương tự bản trước, nhập chữ và kéo slider có thể tạo nhiều bước hoàn tác.
