# Chuẩn bị nhân vật và vật thể

Trong **Nhân vật và vật thể → Thêm bộ nhân vật**, chọn thư mục asset riêng. Bật **Tự thêm vào cảnh** để Khung tự luân phiên, đặt vị trí và chọn chuyển động theo nhịp kể. Xem kết quả trong bản dựng. Không có bảng chỉnh vị trí/động tác từng cảnh trong giao diện hiện tại.

## PNG/WebP tách nền

Một ảnh thành một asset, nên dùng alpha trong suốt và cắt phần trống thừa quanh nhân vật. Có trượt vào, hiện dần, nhún, rung, xoay và các chuyển động nguyên khối. Không tự tách tay/chân hoặc vẽ tư thế mới từ một ảnh phẳng.

## Bộ phận tách rời

```text
nhan-vat/
  head.png
  body.png
  arm_left.png
  arm_right.png
  leg_left.png
  leg_right.png
  eyes_open.png
  eyes_closed.png
  mouth_open.png
  mouth_closed.png
```

Tối thiểu cần đầu và thân. Tay/chân là tuỳ chọn; mắt/miệng cần đủ cặp đóng/mở. Nhận cả tên tiếng Việt không dấu tương ứng như `dau`, `than`, `tay_trai`, `chan_phai`.

Ưu tiên cùng kích thước canvas và đặt từng bộ phận đúng vị trí khi ghép. Phần ngoài bộ phận phải trong suốt. Nếu cắt rời khác kích thước, importer dùng bố cục người mẫu; không phù hợp mọi hình thể. Dùng mô tả `character.json` có sẵn khi cần bố cục chính xác.

Rig có đầu hỗ trợ gật; có tay hỗ trợ vẫy/chỉ; đủ chân hỗ trợ đi/chạy. Cử động theo envelope WAV là nhịp âm lượng, không phải khẩu hình theo âm vị.

## Sprite sheet / chuỗi frame

Đặt thông số ngay trong tên sheet để tự nhận:

```text
nhan-vat/
  idle_4x2_12fps.png
  walk_6x2_12fps.png
  wave_4x2_12fps.png
```

`4x2` là bốn cột, hai hàng; `12fps` là tốc độ gốc. Đọc trái sang phải, trên xuống dưới, các ô phải đều. Có thể dùng chuỗi frame trong từng thư mục:

```text
nhan-vat/
  idle/001.png
  idle/002.png
  walk/001.png
  walk/002.png
```

Frame xếp theo số. Clip hỗ trợ: idle, talk, walk, run, wave, point, nod, jump, happy, surprised, shake, float, spin, enter, exit, sway, move. Các frame/clip nên cùng tỷ lệ. Nếu có `character.json` thì đặt trong gốc bộ, giữ cấu trúc file tương đối đã mô tả. Không cần đổi hay viết JSON khi dùng bộ đã chuẩn bị đúng.

## Giới hạn

Tối đa 20 bộ và 1.200 tài nguyên ảnh duy nhất cho thư viện. Từng clip tối đa 240 ảnh; từng tệp tối đa 25 MB, PNG/WebP. Không nhập ảnh bối cảnh qua bộ chọn nhân vật. Đầu vào ảnh/WAV/TXT vẫn dùng ba ô riêng trên màn hình chính.

Nhân vật trong ảnh nền là một phần ảnh tĩnh; muốn chuyển động độc lập cần asset tách riêng. Bộ `test/` minh hoạ ghép ảnh/voice/phụ đề, không chứa sprite nhân vật.
