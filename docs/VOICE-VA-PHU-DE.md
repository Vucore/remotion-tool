# Tự dựng từ ảnh + WAV + một file TXT — v0.4

## Quy tắc đã chốt

- Một cảnh gồm một ảnh, một WAV và một mục text. Ghép theo số thứ tự trong tên file, không theo thứ tự chọn file.
- `script.txt` UTF-8 chứa các mục `1. Nội dung…`, `2. Nội dung…`; mỗi mục bắt đầu ở đầu dòng, được xuống dòng tiếp bên dưới. Cũng nhận `1)` và `1:`.
- Thời lượng cảnh lấy từ WAV, làm tròn lên đến frame để giữ trọn âm thanh. Giữ cả khoảng lặng; không đổi tốc độ voice.
- Phụ đề hiện lần lượt từng câu. Câu dài tách thành cụm dễ đọc; mốc lấy từ forced alignment WAV + text, không chia đều thời gian.
- Chuyển cảnh chồng hình, không trừ thời lượng voice hoặc trộn hai voice. Text và voice đi cùng cảnh khi đổi thứ tự.
- Thiếu/trùng ảnh, WAV, mục TXT hoặc căn phụ đề thất bại thì dừng và chỉ rõ lỗi. Không âm thầm đoán cặp hoặc thay bằng timing giả.

## Kế hoạch triển khai

1. Mở rộng config, Project, kiểm tra WAV và bộ ghép số thứ tự/TXT dùng chung web–CLI.
2. Thêm engine căn câu local Stable-ts/Whisper, cache theo WAV/text/model và lệnh cài một lần.
3. Compiler dựng cảnh theo voice, lưu cue JSON tương thích Caption của Remotion; renderer phát audio và cue cùng cảnh, giữ nguyên tổng thời gian voice.
4. Web nhận toàn bộ đầu vào trong một lần thả, tự bật chế độ voice, hiện kiểm tra cặp và tiến trình/hủy căn câu; cấu hình kỹ thuật đặt trong nâng cao.
5. CLI và hàng đợi dùng cùng đầu vào/engine. Lưu dự án, báo cáo và hash audio/text để resume chính xác.
6. Cung cấp hướng dẫn cài bằng uv và các bước người dùng tự kiểm tra. Theo yêu cầu mới nhất, không chạy thêm test, cài Python/model, mở server hoặc render trong lượt này.

## Bộ đầu vào mẫu

```text
du-an/
  auto-edit.config.json
  script.txt
  images/
    01_mo-dau.jpg
    02_bat-ngo.png
  voices/
    01.wav
    02.wav
```

```text
1. Sáng hôm ấy, câu chuyện bắt đầu.
Một cuộc gọi bất ngờ vang lên.

2. Mọi thứ thay đổi từ khoảnh khắc đó.
```

Chỉ đặt số mục ở đầu dòng khi muốn mở cảnh mới. Nội dung trong TXT phải đúng lời WAV; đây là căn thời gian cho text đã có, không phải công cụ sửa lời hoặc xác minh nội dung.

## Cài một lần bằng uv

Thực hiện từ thư mục gốc của dự án. Node chạy web/Remotion; uv quản lý riêng môi trường Python căn voice.

```sh
npm ci
npm run setup:voice
```

`setup:voice` gọi `uv venv --python 3.11 .venv-voice`, cài các gói trong `scripts/voice/requirements.txt`, rồi tải model Whisper `small` vào `.cache/whisper/`. Không cần kích hoạt venv hoặc API key. Audio/text được xử lý trên máy. Cài lần đầu cần mạng để tải Python/thư viện/model; căn các video sau dùng model đã tải.

Nếu muốn chạy trực tiếp các lệnh uv, trên macOS/Linux:

```sh
uv venv --python 3.11 .venv-voice
uv pip install --python .venv-voice/bin/python -r scripts/voice/requirements.txt
uv run --no-project --python .venv-voice/bin/python scripts/voice/align.py --download --model small --model-dir .cache/whisper
```

WAV được đọc qua SoundFile rồi resample tới 16 kHz để căn câu; không cần tự cài FFmpeg riêng cho bước căn WAV. Remotion xử lý phần mã hoá video. Model chạy CPU; lần đầu nạp model và căn bộ voice có thể mất thời gian, giao diện có tiến trình theo file và nút Hủy dựng.

Muốn model khác: `npm run setup:voice -- --model base`, sau đó đặt `narration.model` thành `base` trong config. Các lựa chọn: tiny/base/small/medium. Model nhỏ nhanh hơn nhưng cần tự nghe kiểm tra độ chính xác. Mặc định `small`, tiếng Việt; nhận `language: "en"` cho tiếng Anh. Nếu dùng môi trường Python sẵn có, đặt biến `KHUNG_VOICE_PYTHON` thành **đường dẫn đầy đủ tới Python có đủ thư viện**, trước khi chạy server/CLI.

## Dùng trên web

```sh
npm run dev
```

1. Mở địa chỉ công cụ in ra, chọn **Dựng tự động**.
2. Thả chung ảnh, WAV và một TXT; có thể kèm config JSON. Hoặc chọn thư mục có các file này. Web nhận file trong thư mục con qua bộ chọn thư mục, nhưng ghép theo tên file/số thứ tự, không theo đường dẫn thư mục.
3. Chế độ voice tự bật khi nhận WAV/TXT. Hiện số WAV, tên TXT và kết quả ghép; **Xem các cặp** để đối chiếu nếu cần. Thiếu/trùng số sẽ báo rõ và chưa cho dựng.
4. Chọn mẫu edit/tỷ lệ nếu cần rồi nhấn **Tạo và xuất MP4**. Công cụ căn câu, tạo cảnh và tự chuyển sang xuất MP4. Không cần duyệt từng cảnh hoặc nhập số giây.

Cũng có thể nạp từng loại file: chọn bộ ảnh trước, WAV sau và TXT cuối. Nhập ảnh mới thay bộ ảnh; nhập WAV mới thay bộ WAV; TXT mới thay lời đọc. Các loại chưa nạp lại vẫn được giữ. Nạp đầu vào mới xoá các cảnh đã dựng và danh sách giữ của bản cũ, có thể hoàn tác. Dùng dự án mới khi muốn bắt đầu một bộ hoàn toàn khác.

Config không bắt buộc trên web; mẫu mặc định đã có chuyển động/chuyển cảnh. Chỉnh nâng cao đóng mặc định. Khi dựng theo voice, số giây mỗi ảnh/tổng thời lượng và thứ tự thư viện không quyết định bản dựng: thứ tự dùng số mục, thời lượng dùng WAV.

**Chỉ dựng để xem trước** chạy cùng bước căn câu nhưng chưa xuất MP4. Căn lại cùng WAV/text/model sẽ dùng cache. Chỉnh TXT rồi nạp lại để cập nhật lời; các trường nội dung phụ đề trong editor chỉ đọc. Có thể chỉnh font/màu/vị trí cho toàn bộ câu của cảnh.

## Config và CLI

Sao chép [voice-edit.config.json](examples/voice-edit.config.json) cùng [script.txt](examples/script.txt) vào bộ đầu vào. Thay nội dung TXT bằng đúng lời đọc, thêm các ảnh/WAV thật tương ứng. Config mẫu có `narration.enabled: true`.

```sh
npm run auto -- --config /duong-dan/du-an/voice-edit.config.json

# Chỉ căn câu và lưu dự án/báo cáo, chưa xuất video
npm run auto -- --config /duong-dan/du-an/voice-edit.config.json --plan

# Thay bộ đầu vào mà giữ cùng quy tắc edit
npm run auto -- --config /duong-dan/voice-edit.config.json --images ./images --voices ./voices --script ./script.txt --out ./output/video.mp4
```

Đường dẫn tương đối tính từ vị trí config, không phải thư mục terminal. CLI đọc ảnh/WAV trực tiếp trong các thư mục, không duyệt thư mục con. `--plan` **vẫn cần môi trường và model căn voice**, vì file dự án phải chứa mốc câu thật; chỉ bỏ bước Chromium/render. `preauto` tự build code trước khi chạy.

Đầu ra: MP4, `.khung.json`, `.report.json`. Project giữ WAV, text gốc và các cue JSON; cần giữ thư mục `data/uploads/` để mở lại. Báo cáo/hàng đợi resume tính cả WAV, TXT và thiết lập căn câu. Đổi đầu vào sẽ dựng lại. `--overwrite` cho phép ghi lại đầu ra đang có; `--resume` bỏ qua kết quả hoàn tất với đầu vào khớp.

Ví dụ hàng đợi:

```json
{
  "jobs": [
    { "config": "./voice-edit.config.json", "images": "./bo-a/images", "voices": "./bo-a/voices", "script": "./bo-a/script.txt", "out": "./output/a.mp4" },
    { "config": "./voice-edit.config.json", "images": "./bo-b/images", "voices": "./bo-b/voices", "script": "./bo-b/script.txt", "out": "./output/b.mp4" }
  ]
}
```

```sh
npm run auto -- --batch /duong-dan/jobs.json --resume
```

## Quy tắc thời gian và giới hạn

- Đánh số TXT liên tục từ 1. Ảnh/WAV lấy cụm số đầu tiên trong tên: `01.jpg`, `scene_01.jpg`, `voice_01.wav` cùng cảnh 1. Không có hai ảnh hoặc hai WAV cùng số.
- WAV RIFF PCM 8/16/24/32-bit hoặc IEEE float 32/64-bit, mono/stereo, 8–192 kHz; 0,5–300 giây và tối đa 100 MB/file. Không nhận MP3 trong lần bổ sung này. Tối đa 300 cảnh, tổng video một giờ như editor hiện tại.
- TXT UTF-8 tối đa 1 MB; mỗi mục tối đa 12.000 ký tự. Dấu câu/xuống dòng tách câu, câu quá dài chia cụm theo `narration.maxChars` (mặc định 100, từ 40–240). Tối đa 300 cue mỗi voice, vẫn chỉ dùng **một lớp phụ đề** cho mỗi cảnh.
- Mỗi cảnh dài `ceil(thời lượng WAV × FPS) / FPS`. Hai WAV 4s và 6s, chuyển cảnh 0,5s vẫn ra video 10s. File có phần lẻ được đệm dưới một frame mỗi cảnh để giữ trọn audio.
- Giữ nguyên khoảng lặng đầu/cuối WAV, không tăng/giảm tốc độ. Cue hiện từ lúc câu được đọc tới khi kết thúc, có thể ẩn giữa các khoảng nghỉ. Chuyển cảnh diễn ra ở đầu cảnh tiếp theo; hình trước kéo dài trong đoạn nối, voice trước đã kết thúc.
- Dựng lại giữ kiểu ảnh/chữ của cảnh đang giữ nhưng vẫn cập nhật WAV, text và thời lượng theo bộ đầu vào. Cảnh thêm/chia thủ công ngoài bộ ghép không được giữ trong bản dựng voice mới; báo cáo ghi rõ. Editor không chia trực tiếp cảnh có WAV: hãy chia WAV/TXT ở đầu vào. Tăng thời lượng cảnh trong editor thêm khoảng nghỉ, không kéo giãn voice; không thể kéo ngắn hơn WAV.
- `text.preset` và `text.style` vẫn điều khiển kiểu phụ đề. Nội dung và start/end lấy từ TXT/alignment; `text.source`, `overrides[].text`, timing và duration override thông thường không áp dụng cho chế độ voice. Các lớp chữ trang trí trong `look.scene.texts` vẫn dùng được.
- Mô hình căn câu có thể sai khi lời trong TXT khác WAV, phát âm không rõ, nhạc nền lớn hoặc ngắt nghỉ bất thường. Nếu output thiếu cue/chồng mốc/không khớp text, tác vụ báo lỗi và không tự chia đều thời gian để lấp chỗ trống. Vẫn cần tự nghe kết quả thực tế.
- Cache nằm trong `.cache/alignment/`. Nếu chủ động nâng thư viện/model engine, xoá cache alignment cũ rồi căn lại. Mô hình tại `.cache/whisper/` và venv tại `.venv-voice/` không đưa vào Git.

## Tự kiểm tra sau khi cài

Các bước dưới đây dành cho người dùng, **chưa được chạy trên bản code cuối** theo yêu cầu chỉ hoàn thiện code:

```sh
npm run lint
npm run build
# Tuỳ chọn: bộ kiểm tra logic hiện có
npm test
```

Sau đó dùng hai ảnh, hai WAV và TXT tương ứng: dựng xem trước, nghe câu đầu/cuối mỗi WAV, kiểm tra phụ đề đổi đúng câu và không bị ảnh hưởng bởi fade 0,5s. Xuất một MP4, nghe cả âm thanh trong file xuất. Thử đảo thứ tự chọn file để thấy công cụ vẫn ghép theo số; đổi một mục TXT rồi dựng lại để kiểm tra căn mới. Nếu không muốn xuất video trong lần đầu, dùng `--plan` như trên.

Chưa cài Python/model hoặc chưa render WAV thực tế trong lượt triển khai này. Kiểm tra lint/TypeScript trung gian đã chạy trước khi có yêu cầu dừng test; không được coi là xác nhận bản cuối hay độ chính xác alignment.

Tham khảo engine: [Stable-ts alignment](https://github.com/jianfch/stable-ts#alignment). Engine dùng text đã cung cấp để căn vào âm thanh, sau đó xuất cue theo cấu trúc [Remotion Caption](https://www.remotion.dev/docs/captions/caption).
