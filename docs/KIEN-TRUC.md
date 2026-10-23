# Kiến trúc Khung

## Luồng hiện tại

Ba đầu vào độc lập (ảnh, WAV, TXT) → kiểm tra ghép số → mẫu dựng → căn phụ đề nếu có voice → Project → Remotion Player / xuất MP4. Chỉ 9:16 và 16:9. Không có editor cắt ghép thủ công hoặc GPT.

- `src/App.tsx`: điều phối đầu vào, lưu trình duyệt, tiến độ dựng/xuất và huỷ tác vụ.
- `src/editor/StoryInput.tsx`, `story-import.ts`: ba ô chọn/kéo thả riêng, xác thực loại tệp, nhập thành công mới cập nhật loại tương ứng.
- `src/editor/Timeline.tsx`: thước/playhead/zoom và ba hàng ảnh, waveform voice, cue phụ đề; tất cả lấy từ cùng Project đang preview.
- `src/editor/QuickSettings.tsx`: bốn tab, phạm vi toàn video/cảnh, gallery và các lớp đang chọn. Scope cảnh dùng tên ảnh, chuyển cảnh thuộc cảnh đi ra tại điểm nối.
- `src/editor/AdvancedSettings.tsx`: tham số ảnh, đường đi và trình bày phụ đề; `PresetDemo.tsx` dùng `imagePose`, cặp transition style và `TextAtFrame` chung với renderer để demo từng ô. Đồng hồ rAF chỉ dùng cho gallery UI, video vẫn tính theo frame Remotion.
- `src/editor/WorkspaceLayout.tsx`: kích thước panel, clamp theo viewport, drag/pointer capture, bàn phím và lưu localStorage; không ghi kích thước UI vào video.
- `src/auto/story.ts`: chuyển lựa chọn thành AutoConfig; `previewStory` tạo Project tạm phát được ngay bằng timing WAV và cue ước lượng, hoặc tái dùng cue đã căn còn khớp. Project tạm không ghi đè bản căn thật và không đi thẳng vào tác vụ export.
- `src/auto/config.ts`, `compile.ts`: xác thực mẫu và dựng Project, dùng chung web/CLI.
- AutoConfig.overrides có scene và textStyle riêng; textStyle chỉ thay trình bày, không ghi đè cue/content căn từ WAV/TXT. StoryOptions.sceneOverrides chuyển qua cùng đường này và được khôi phục khi mở dự án.
- `src/model.ts`: schema Project, scene và timeline; giữ tương thích dự án cũ.

## Voice và thời gian

`src/auto/narration.ts` đọc TXT đánh số và ghép ảnh/WAV theo số trong tên. `scripts/wav-info.mjs` đọc RIFF/WAVE để lấy thời lượng theo sample và envelope âm lượng.

`scripts/narration.mjs` kiểm tra/cache đầu vào, chạy `scripts/voice/align.py`. Python dùng Stable-ts/Whisper để căn text gốc vào WAV; `.venv` cài bằng uv qua `npm run setup:voice`. Không tạo mốc chia đều rồi gọi đó là alignment.

`scripts/voice-input.mjs` đọc WAV/MP3, dùng FFmpeg cục bộ để phân tích MP3. API và CLI giữ nguyên bytes/đuôi nguồn; Project và renderer nhận `.wav` hoặc `.mp3`. Chỉ aligner nhận WAV tạm của MP3, được dọn trong finally; cache alignment/hash theo file nguồn. Thời lượng và waveform theo sample giải mã, không ước lượng từ dung lượng hay bitrate MP3. Renderer xuất AAC 320k/192k theo mức chất lượng.

WAV quyết định thời lượng cảnh. Khi có voice, audio/cue nối tiếp; phần hình của cảnh trước kéo dài qua chuyển cảnh để không mất lời đọc. Không có voice thì thời lượng và cue là ước lượng, có ghi rõ trên giao diện.

## Nhân vật

`src/actors/import.ts` nhận PNG tách nền, bộ phận hoặc sprite. `schema.ts` xác thực thư viện, `plan.ts` tự phân vai/chọn chuyển động theo mẫu, `timing.ts` giới hạn mốc động tác.

`ActorView.tsx` dựng theo frame: PNG biến đổi nguyên khối, rig xoay từng phần, sprite phát frame. Không tự sinh tư thế mới. Schema vẫn đọc bố trí thủ công trong dự án cũ; giao diện hiện tại không có bảng kéo/chỉnh từng đối tượng.

## Xem trước và xuất

### Voice từ TXT

`src/auto/tts.ts` xác thực tham số model/URL, lập kế hoạch theo số và đánh dấu voice còn khớp TXT/tham số. `src/editor/TtsPanel.tsx` giữ hai nguồn tải/tạo voice, thu gọn sampling/URL; `tts-client.ts` theo dõi tác vụ `/api/tts` và hủy bằng DELETE. `scripts/tts.mjs` gọi `/api/cli` ở backend, `single` từng mục, giới hạn response/timeout và cache SHA-256 trước khi đưa vào Project. Tài nguyên vẫn giữ nguồn WAV/MP3; `voiceover.tts`/`ttsKey` phục hồi thiết lập và tránh dùng voice cũ sau thay đổi TXT. Preview ước tính khi chưa có voice mới; nút xuất tự tạo rồi đi vào pipeline narration đã có. Không gọi Modal từ browser, không cần mở CSP connect-src bên ngoài.

`src/Video.tsx` là composition chung cho Player và renderer. `TextRender.tsx`, `Overlays.tsx`, `animation.ts` tính hình/text theo frame. Runtime effect/font và các trường cũ được giữ để mở/xuất Project cũ và CLI, không đưa thành bảng chỉnh tay trong UI.

`scripts/server.mjs` phục vụ web/API tại loopback. `scripts/render-project.mjs` dùng Remotion Bundler/Renderer xuất H.264 MP4, có tiến độ và huỷ. `scripts/auto-edit.mjs` dùng cùng engine cho AutoConfig/queue CLI. `scripts/build.mjs` dùng esbuild.

Ảnh/WAV/font nhập và video xuất nằm trong `data/`. Project trong trình duyệt/JSON chỉ giữ đường dẫn tài nguyên; cần giữ `data/` để mở lại. `.cache/remotion-*` là bundle có thể tạo lại. `dist/` là bản build dùng bởi server/CLI.

## Dữ liệu minh hoạ

`test/images/`: ba ảnh PNG. `test/voices/`: ba WAV tiếng Việt. `test/script.txt`: toàn bộ lời đọc theo số 1/2/3. `tests/` là kiểm tra mã nguồn, độc lập với bộ dữ liệu này.
