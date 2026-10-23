# Dung lượng lượt triển khai SRT và dialog

Đo ngày 23/10/2026 (Asia/Saigon), trước sửa code và sau build/kiểm tra. Phạm vi: tệp trong `/Users/nguyenngocminh/YTB/Video-GPT`, cộng file SRT tải qua UI. Tính bytes logic từ stat; số block cấp phát được báo riêng. Không đo đỉnh RAM/VRAM, I/O tạm, cache nội bộ của Codex/trình duyệt hoặc file ở nơi khác. Không coi dung lượng có sẵn là phần tải mới.

## Tổng

| Phép đo | Trước | Sau | Tăng thêm |
| --- | ---: | ---: | ---: |
| Bytes logic trong dự án | 1,988,903,960 B (1896.767 MiB) | 1,986,429,879 B (1894.407 MiB) | -2,474,081 B (-2.359 MiB) |
| Block tệp cấp phát | 2,059,952,128 B (1964.523 MiB) | 2,057,564,160 B (1962.246 MiB) | -2,387,968 B (-2.277 MiB) |
| Số tệp/symlink | 27243 | 27276 | 33 |

File ngoài dự án mới tạo: [SRT mẫu ước tính](</Users/nguyenngocminh/Downloads/Câu chuyện của tôi_vi_tiengviet.srt>), **1064 byte**, 12 cue, khoảng 35,7 giây. Tổng bytes tăng logic nếu cộng file này: **-2473017 byte**. Không xóa file kết quả đã tải.

## Theo thư mục

| Thư mục | Trước | Sau | Chênh lệch |
| --- | ---: | ---: | ---: |
| `src/` | 533,442 B (0.509 MiB) | 562,902 B (0.537 MiB) | 29,460 B (0.028 MiB) |
| `scripts/` | 83,282 B (0.079 MiB) | 94,293 B (0.090 MiB) | 11,011 B (0.011 MiB) |
| `tests/` | 56,438 B (0.054 MiB) | 62,811 B (0.060 MiB) | 6,373 B (0.006 MiB) |
| `docs/` | 390,135 B (0.372 MiB) | 637,436 B (0.608 MiB) | 247,301 B (0.236 MiB) |
| `dist/` | 13,040,937 B (12.437 MiB) | 10,021,910 B (9.558 MiB) | -3,019,027 B (-2.879 MiB) |
| `node_modules/` | 1,133,776,053 B (1081.253 MiB) | 1,133,776,053 B (1081.253 MiB) | 0 B (0.000 MiB) |
| `data/` | 293,282,442 B (279.696 MiB) | 293,282,442 B (279.696 MiB) | 0 B (0.000 MiB) |
| `test/` | 2,173,553 B (2.073 MiB) | 2,173,553 B (2.073 MiB) | 0 B (0.000 MiB) |
| `.cache/` | 0 B (0.000 MiB) | 0 B (0.000 MiB) | 0 B (0.000 MiB) |
| `.git/` | 545,370,442 B (520.106 MiB) | 545,619,993 B (520.344 MiB) | 249,551 B (0.238 MiB) |

`node_modules/`, `data/`, bộ mẫu `test/` và lịch sử `.git/` là tài nguyên có sẵn; bảng ghi đúng phần thay đổi nếu có. `dist/` là bundle/source map build lại, không phải model tải về. Không chạy npm install, uv pip, tải Whisper hay model dịch: **0 byte model/dependency tải thêm**. Không render MP4 hoặc tạo WAV/MP3 mới để giữ lại trong lượt này.

## File mới hoặc đổi kích thước

Đơn vị byte. Đây là chênh lệch với snapshot đầu lượt, không phải toàn bộ git diff vốn đã có nhiều thay đổi trước đó. File chỉnh nội dung nhưng giữ nguyên số byte không xuất hiện trong bảng này. Hai file báo cáo/kế hoạch và ba PNG kiểm tra được tính vào tổng.

| File | Trước | Sau | Chênh lệch |
| --- | ---: | ---: | ---: |
| `.git/objects/1b/6ac73ec9920ec3e52360c34bbab402bb407ffa` | 0 | 544 | 544 |
| `.git/objects/1b/80acf31ce5a7593949a10fcfeaf4a7015e5b15` | 0 | 14992 | 14992 |
| `.git/objects/32/ff45dd922f0ffc7e4fd62ddbf607d97cc3d3e1` | 0 | 247 | 247 |
| `.git/objects/3b/299a3f306a3b2155b057a4e9c15250f704f627` | 0 | 844 | 844 |
| `.git/objects/55/9bb1b7c75dd5fbae140140486c133fd27b4e38` | 0 | 481 | 481 |
| `.git/objects/6c/39414d89fe0ace22a3e20847406a5772c28591` | 0 | 241 | 241 |
| `.git/objects/70/b3761cbb5f937275a54c5fdc7b3dd9e07a231a` | 0 | 32684 | 32684 |
| `.git/objects/81/9584ead31bb777b6fdef47dee123f83d0e2481` | 0 | 2507 | 2507 |
| `.git/objects/85/4122bfe200ab0315492afd4dac5f36b7085af9` | 0 | 597 | 597 |
| `.git/objects/9d/bd3aea04c65ba7e9c06474566f0470300b3e00` | 0 | 4105 | 4105 |
| `.git/objects/a2/8bbdfcccff4413457ff025d8f24bda3bccf071` | 0 | 560 | 560 |
| `.git/objects/b3/369c4c540d012818dd8770babfb94414219715` | 0 | 2555 | 2555 |
| `.git/objects/b6/5dfc7e1606c4f6c2ed0f52e6e41c4b98421130` | 0 | 680 | 680 |
| `.git/objects/b9/8bfda212adc1b8018394595cfcb105d6c6ba60` | 0 | 243 | 243 |
| `.git/objects/bb/bdafc08dec628a1f4ac54cd6f000875d7ae191` | 0 | 13139 | 13139 |
| `.git/objects/cf/76a2514bd49a6d9d591ba4f9fe0f4e6ec9df1b` | 0 | 497 | 497 |
| `.git/objects/d2/d3bf07830d93f4f98d73865824b51a63f06c4f` | 0 | 7426 | 7426 |
| `.git/objects/df/d9c2ce538fc7f09489e4b51f1e0ea59d0ef011` | 0 | 2968 | 2968 |
| `.git/objects/eb/635143e07dea22214d6c2c8077bb9ef782e78c` | 0 | 848 | 848 |
| `.git/objects/ee/59b9943ca97112f270cb6ebe7fa702ff2a1926` | 0 | 725 | 725 |
| `.git/objects/f5/a33386f9b87a1368e96a17bde5e1a0d9a79815` | 0 | 98817 | 98817 |
| `.git/objects/f8/b71db290ae62d547345c68ff522f3a7563f061` | 0 | 63851 | 63851 |
| `.git/refs/codex/turn-diffs/captures/1792738726827/e8740f06-21c5-4f85-9fa6-e73be098697a/base` | 0 | 41 | 41 |
| `.git/refs/codex/turn-diffs/checkpoints/9b91d3648b9366881721e60d6da8fc02/ae70c682e53966c0c3a62a0a239b28ac/1792731730628/c4f1aadb-2fe3-4235-ab1e-fdff40524246` | 0 | 41 | 41 |
| `.impeccable/hook.cache.json` | 4157 | 4477 | 320 |
| `PRODUCT.md` | 3541 | 4030 | 489 |
| `README.md` | 3342 | 3783 | 441 |
| `dist/app.css` | 44587 | 39225 | -5362 |
| `dist/app.css.map` | 76604 | 85382 | 8778 |
| `dist/app.js` | 4316974 | 1914053 | -2402921 |
| `dist/app.js.map` | 7771551 | 7024449 | -747102 |
| `dist/subtitles.mjs` | 0 | 127580 | 127580 |
| `docs/DUNG-LUONG-SRT.md` | 0 | 7833 | 7833 |
| `docs/HUONG-DAN.md` | 8958 | 9381 | 423 |
| `docs/KIEM-TRA.md` | 4861 | 5653 | 792 |
| `docs/PHU-DE-SRT-VA-GIAO-DIEN.md` | 0 | 5985 | 5985 |
| `docs/README.md` | 1169 | 1314 | 145 |
| `docs/TICH-HOP-TTS.md` | 6889 | 7019 | 130 |
| `docs/images/resources-desktop.png` | 0 | 114333 | 114333 |
| `docs/images/subtitles-desktop.png` | 0 | 78675 | 78675 |
| `docs/images/subtitles-mobile.png` | 0 | 38985 | 38985 |
| `scripts/build.mjs` | 1512 | 1554 | 42 |
| `scripts/server.mjs` | 20134 | 24279 | 4145 |
| `scripts/translate-subtitles.mjs` | 0 | 6824 | 6824 |
| `src/App.tsx` | 48768 | 53343 | 4575 |
| `src/auto/subtitles.ts` | 0 | 6553 | 6553 |
| `src/editor/EditorDialog.tsx` | 0 | 1236 | 1236 |
| `src/editor/StoryInput.tsx` | 1913 | 1940 | 27 |
| `src/editor/SubtitlePanel.tsx` | 0 | 12216 | 12216 |
| `src/styles.css` | 44524 | 49377 | 4853 |
| `tests/subtitles.test.mjs` | 0 | 6373 | 6373 |

## Test, cache và tệp tạm

- Code kiểm tra mới: `tests/subtitles.test.mjs` (6373 byte). Tổng 52 kiểm tra đã qua; sau sửa nhãn ước tính chạy lại nhóm SRT và lint.
- API Google dùng giả lập trong test, không gọi dịch trả phí và không gọi Modal. MP3 fixtures được các bài test cũ tạo bằng FFmpeg đã cài, không tải qua mạng.
- Thư mục dữ liệu test tạm: `/var/folders/xd/62pp9bhn219_6qj7zb37qjn00000gn/T` với prefix `khung-srt-test-*`, `khung-tts-test-*`, `khung-audio-test-*`, `khung-auto-*`. Các bài test dọn trong finally. Số thư mục còn lại theo các prefix tại lúc đo: **0**. Không đo dung lượng đỉnh lúc test đang chạy; dung lượng tồn dư test là 0 nếu không còn thư mục.
- Snapshot đầu lượt: `/private/tmp/khung-subtitles-before.json`, 3130350 byte; dùng để so sánh rồi được xóa sau khi ghi báo cáo. Không giữ bản kiểm kê 27 nghìn file trong repo.
- Cache dịch khi người dùng dịch thật sẽ ở `.cache/translations/`; cache căn câu `.cache/alignment/`; cache TTS `.cache/tts/`. Hiện lượt kiểm tra không tạo cache cloud trong dự án. API key không lưu trong cache/dự án.
- Ảnh UI: `docs/images/resources-desktop.png`, `subtitles-desktop.png`, `subtitles-mobile.png`; được giữ làm chứng cứ. Không tạo trang HTML harness tạm.
- Server localhost 3211 và tab kiểm tra đã dừng/đóng.

[Cách dùng và giới hạn SRT](PHU-DE-SRT-VA-GIAO-DIEN.md).
