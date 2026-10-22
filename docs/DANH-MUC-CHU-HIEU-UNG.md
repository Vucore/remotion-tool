# Danh mục Chữ và Hiệu ứng v0.2

Chỉ hai tỷ lệ video: **9:16** và **16:9**. Các điều khiển dưới đây đã được nối vào model, preview composition và xuất video; kiểm tra GPU/hiển thị thực tế do người dùng thực hiện.

## Chữ

- 12 mẫu chữ: Cơ bản (`basic`), Tiêu đề (`title`), Phụ đề (`subtitle`), Nhãn (`label`), Neon (`neon`), Rỗng viền (`outline`), Bóng dài (`shadow`), Gradient (`gradient`), Tô sáng (`highlight`), Retro (`retro`), Nền trong (`glass`), Trang sách (`editorial`).
- 29 lựa chọn vào/ra, bao gồm không animation: Không (`none`), Hiện dần (`fade`), Trượt lên (`slide-up`), Trượt xuống (`slide-down`), Trượt từ trái (`slide-left`), Trượt từ phải (`slide-right`), Bật lên (`pop`), Zoom (`zoom`), Thu về (`zoom-out`), Nảy (`bounce`), Xoay (`rotate`), Lật ngang (`flip-x`), Lật dọc (`flip-y`), Rõ dần (`blur`), Quét chữ (`wipe`), Đánh máy (`typewriter`), Đánh máy + con trỏ (`typewriter-cursor`), Từng ký tự đi lên (`letter-rise`), Từng ký tự hiện (`letter-fade`), Từng ký tự xoay (`letter-spin`), Từng từ đi lên (`word-rise`), Từng từ bật (`word-pop`), Tô sáng từng từ (`word-highlight`), Kéo giãn (`stretch`), Nghiêng vào (`skew`), Mở ngang (`scale-x`), Mở dọc (`scale-y`), Gom khoảng chữ (`tracking-in`), Giãn khoảng chữ (`tracking-out`).
- 12 lựa chọn lặp, bao gồm không lặp: Không lặp (`none`), Lơ lửng (`float`), Nhịp đập (`pulse`), Đung đưa (`sway`), Rung (`shake`), Nảy (`bounce`), Chớp (`blink`), Đổi sắc (`rainbow`), Sóng ký tự (`wave`), Đèn neon (`neon-flicker`), Xoay vòng (`spin`), Nhịp tim (`heartbeat`).
- 8 font hệ thống, thêm WOFF/WOFF2/TTF/OTF từ máy.
- Cỡ và độ đậm, nghiêng, gạch chân/ngang/trên, hoa/thường, căn lề, giãn ký tự/dòng, hướng viết, vị trí, tỷ lệ, xoay/nghiêng và độ hiện.
- Một màu, gradient, chữ rỗng, viền, nền/đệm/bo góc, bóng mềm, neon và khối giả 3D.
- Chữ cong lên/xuống trên cung SVG; số đếm với đầu/cuối, tiền/hậu tố và số lẻ.
- Nhiều lớp có ẩn/hiện, sắp lớp, nhân bản, xoá, khoảng xuất hiện riêng và nút xem từ đầu chữ.

## Chuyển động và nối cảnh

- 24 lựa chọn chuyển động, bao gồm đứng yên: Đứng yên (`none`), Zoom vào (`zoom-in`), Zoom ra (`zoom-out`), Lướt trái (`pan-left`), Lướt phải (`pan-right`), Lướt lên (`pan-up`), Lướt xuống (`pan-down`), Chéo lên (`diagonal-in`), Chéo xuống (`diagonal-out`), Lơ lửng (`float`), Nhịp đập (`pulse`), Rung (`shake`), Đung đưa (`sway`), Nảy (`bounce`), Xoay vòng (`spin`), Quỹ đạo (`orbit`), Lật ngang 3D (`flip-x`), Lật dọc 3D (`flip-y`), Máy cầm tay (`handheld`), Zoom nhịp (`zoom-pulse`), Xoay tiến (`rotate-in`), Xoay lùi (`rotate-out`), Đi lên (`slide-up`), Đi xuống (`slide-down`).
- 28 lựa chọn nối cảnh, bao gồm cắt thẳng: Cắt thẳng (`none`), Mờ chuyển (`fade`), Trượt (`slide`), Quét (`wipe`), Đẩy cảnh (`push`), Mở tròn (`iris`), Đóng tròn (`iris-close`), Quét đồng hồ (`clock`), Lật ngang (`flip`), Lật dọc (`flip-vertical`), Zoom vào (`zoom`), Zoom ra (`zoom-out`), Mờ nét (`blur`), Zoom và mờ (`zoom-blur`), Xoay cảnh (`spin`), Qua màu đen (`fade-black`), Qua màu trắng (`fade-white`), Cháy phim (`film-burn`), Rèm (`blinds`), Ô bàn cờ (`checker`), Mở hình thoi (`diamond`), Mở trái tim (`heart`), Tách ngang (`split-horizontal`), Tách dọc (`split-vertical`), Điểm ảnh (`pixel`), Nhiễu số (`glitch`), Gợn sóng (`ripple`), Trượt và nghiêng (`slide-rotate`).
- 10 easing: Đều (`linear`), Chậm đầu (`ease-in`), Chậm cuối (`ease-out`), Chậm hai đầu (`ease-in-out`), Mượt cubic (`cubic`), Nhanh rồi dịu (`expo`), Lấy đà (`back`), Đàn hồi (`elastic`), Nảy (`bounce`), Giật từng nhịp (`steps`).
- 9 lựa chọn mặt nạ, bao gồm không cắt: Không cắt (`none`), Tròn (`circle`), Elip (`ellipse`), Bo góc (`rounded`), Hình thoi (`diamond`), Lục giác (`hexagon`), Ngôi sao (`star`), Trái tim (`heart`), Tam giác (`triangle`).
- Keyframe vị trí ngang/dọc, tỷ lệ, góc xoay và độ hiện ảnh; kết hợp được với preset.

## Lớp phủ

20 kiểu: Hạt phim (`grain`), Bụi bay (`dust`), Tuyết (`snow`), Mưa (`rain`), Sao lấp lánh (`stars`), Đom đóm (`fireflies`), Pháo giấy (`confetti`), Bong bóng (`bubbles`), Cánh hoa (`petals`), Sương khói (`smoke`), Bokeh (`bokeh`), Ánh sáng lọt (`light-leak`), Tia sáng (`rays`), Tối góc (`vignette`), Vệt tốc độ (`speed-lines`), Vạch màn hình (`scanlines`), Khung viền (`frame`), Dải điện ảnh (`letterbox`), Ánh chớp (`flash`), Vết xước phim (`film-scratches`).

Mỗi lớp có bật/tắt, thứ tự, màu, mức, tốc độ, cỡ, seed và khoảng xuất hiện. Lớp phủ nằm trên ảnh, dưới chữ.

## Toàn bộ effect factory trong package đã ghim

Đồng bộ từ **@remotion/effects 4.0.537**, đủ **81 factory**: 11 Canvas 2D, 67 WebGL2, 3 WebGPU. [Tài liệu effect chính thức](https://www.remotion.dev/docs/effects).

Mỗi effect có tham số đúng schema (số, boolean, màu, lựa chọn, UV, mảng hoặc nội dung LUT), thêm/xoá/nhân bản, bật/tắt, đổi thứ tự, thời gian và tự động hoá nhiều tham số số. Các nhánh schema con và bảng màu mảng cũng được hiển thị.

| Factory gốc                                                                                      | Backend                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------- |
| [barrelDistortion()](https://www.remotion.dev/docs/effects/barrel-distortion)                    | WebGL2                          |
| [bevelAlpha()](https://www.remotion.dev/docs/effects/bevel-alpha)                                | WebGL2                          |
| [blur()](https://www.remotion.dev/docs/effects/blur)                                             | WebGL2                          |
| [brightness()](https://www.remotion.dev/docs/effects/brightness)                                 | Canvas 2D                       |
| [burlap()](https://www.remotion.dev/docs/effects/burlap)                                         | WebGL2                          |
| [checkerboard()](https://www.remotion.dev/docs/effects/checkerboard)                             | WebGL2                          |
| [chromaticAberration()](https://www.remotion.dev/docs/effects/chromatic-aberration)              | WebGL2                          |
| [colorCorrection()](https://www.remotion.dev/docs/effects/color-correction)                      | WebGL2                          |
| [colorKey()](https://www.remotion.dev/docs/effects/color-key)                                    | WebGL2                          |
| [contourLines()](https://www.remotion.dev/docs/effects/contour-lines)                            | WebGL2                          |
| [contrast()](https://www.remotion.dev/docs/effects/contrast)                                     | Canvas 2D                       |
| [cornerPin()](https://www.remotion.dev/docs/effects/corner-pin)                                  | WebGL2                          |
| [cylinder()](https://www.remotion.dev/docs/effects/cylinder)                                     | WebGPU — cần driver tương thích |
| [dotGrid()](https://www.remotion.dev/docs/effects/dot-grid)                                      | WebGL2                          |
| [dropShadow()](https://www.remotion.dev/docs/effects/drop-shadow)                                | WebGL2                          |
| [duotone()](https://www.remotion.dev/docs/effects/duotone)                                       | WebGL2                          |
| [emboss()](https://www.remotion.dev/docs/effects/emboss)                                         | WebGL2                          |
| [evolve()](https://www.remotion.dev/docs/effects/evolve)                                         | WebGL2                          |
| [exposure()](https://www.remotion.dev/docs/effects/exposure)                                     | WebGL2                          |
| [fisheye()](https://www.remotion.dev/docs/effects/fisheye)                                       | WebGL2                          |
| [flannel()](https://www.remotion.dev/docs/effects/flannel)                                       | WebGL2                          |
| [fractalNoise()](https://www.remotion.dev/docs/effects/fractal-noise)                            | WebGL2                          |
| [glow()](https://www.remotion.dev/docs/effects/glow)                                             | WebGL2                          |
| [grayscale()](https://www.remotion.dev/docs/effects/grayscale)                                   | Canvas 2D                       |
| [gridlines()](https://www.remotion.dev/docs/effects/gridlines)                                   | WebGL2                          |
| [halftone()](https://www.remotion.dev/docs/effects/halftone)                                     | WebGL2                          |
| [halftoneLinearGradient()](https://www.remotion.dev/docs/effects/halftone-linear-gradient)       | WebGL2                          |
| [hue()](https://www.remotion.dev/docs/effects/hue)                                               | Canvas 2D                       |
| [invert()](https://www.remotion.dev/docs/effects/invert)                                         | Canvas 2D                       |
| [lensBlur()](https://www.remotion.dev/docs/effects/lens-blur)                                    | WebGL2                          |
| [levels()](https://www.remotion.dev/docs/effects/levels)                                         | WebGL2                          |
| [lightLeak()](https://www.remotion.dev/docs/effects/light-leak)                                  | WebGL2                          |
| [lightTrail()](https://www.remotion.dev/docs/effects/light-trail)                                | WebGL2                          |
| [linearGradient()](https://www.remotion.dev/docs/effects/linear-gradient)                        | WebGL2                          |
| [linearGradientTint()](https://www.remotion.dev/docs/effects/linear-gradient-tint)               | WebGL2                          |
| [linearProgressiveBlur()](https://www.remotion.dev/docs/effects/linear-progressive-blur)         | WebGL2                          |
| [linearProgressivePixelate()](https://www.remotion.dev/docs/effects/linear-progressive-pixelate) | WebGL2                          |
| [lines()](https://www.remotion.dev/docs/effects/lines)                                           | WebGL2                          |
| [liquidContours()](https://www.remotion.dev/docs/effects/liquid-contours)                        | WebGL2                          |
| [lut()](https://www.remotion.dev/docs/effects/lut)                                               | WebGL2                          |
| [mirror()](https://www.remotion.dev/docs/effects/mirror)                                         | WebGL2                          |
| [noise()](https://www.remotion.dev/docs/effects/noise)                                           | WebGL2                          |
| [noiseDisplacement()](https://www.remotion.dev/docs/effects/noise-displacement)                  | WebGL2                          |
| [outline()](https://www.remotion.dev/docs/effects/outline)                                       | WebGL2                          |
| [pageTurn()](https://www.remotion.dev/docs/effects/page-turn)                                    | WebGPU — cần driver tương thích |
| [paper()](https://www.remotion.dev/docs/effects/paper)                                           | WebGL2                          |
| [pattern()](https://www.remotion.dev/docs/effects/pattern)                                       | WebGL2                          |
| [pixelate()](https://www.remotion.dev/docs/effects/pixelate)                                     | WebGL2                          |
| [pixelDissolve()](https://www.remotion.dev/docs/effects/pixel-dissolve)                          | WebGL2                          |
| [radialProgressiveBlur()](https://www.remotion.dev/docs/effects/radial-progressive-blur)         | WebGL2                          |
| [radialProgressivePixelate()](https://www.remotion.dev/docs/effects/radial-progressive-pixelate) | WebGL2                          |
| [regionBlur()](https://www.remotion.dev/docs/effects/region-blur)                                | WebGL2                          |
| [rings()](https://www.remotion.dev/docs/effects/rings)                                           | WebGL2                          |
| [roughenEdges()](https://www.remotion.dev/docs/effects/roughen-edges)                            | WebGL2                          |
| [saturation()](https://www.remotion.dev/docs/effects/saturation)                                 | Canvas 2D                       |
| [scale()](https://www.remotion.dev/docs/effects/scale)                                           | Canvas 2D                       |
| [scanlines()](https://www.remotion.dev/docs/effects/scanlines)                                   | WebGL2                          |
| [shadowsHighlights()](https://www.remotion.dev/docs/effects/shadows-highlights)                  | WebGL2                          |
| [shine()](https://www.remotion.dev/docs/effects/shine)                                           | WebGL2                          |
| [shrinkwrap()](https://www.remotion.dev/docs/effects/shrinkwrap)                                 | WebGL2                          |
| [skew()](https://www.remotion.dev/docs/effects/skew)                                             | WebGL2                          |
| [speckle()](https://www.remotion.dev/docs/effects/speckle)                                       | WebGL2                          |
| [sphere()](https://www.remotion.dev/docs/effects/sphere)                                         | WebGPU — cần driver tương thích |
| [starburst()](https://www.remotion.dev/docs/effects/starburst)                                   | WebGL2                          |
| [tear()](https://www.remotion.dev/docs/effects/tear)                                             | WebGL2                          |
| [thermalVision()](https://www.remotion.dev/docs/effects/thermal-vision)                          | WebGL2                          |
| [tile()](https://www.remotion.dev/docs/effects/tile)                                             | Canvas 2D                       |
| [tint()](https://www.remotion.dev/docs/effects/tint)                                             | Canvas 2D                       |
| [turbulentDisplace()](https://www.remotion.dev/docs/effects/turbulent-displace)                  | WebGL2                          |
| [tvSignalOff()](https://www.remotion.dev/docs/effects/tv-signal-off)                             | WebGL2                          |
| [uvTranslate()](https://www.remotion.dev/docs/effects/uv-translate)                              | Canvas 2D                       |
| [venetianBlinds()](https://www.remotion.dev/docs/effects/venetian-blinds)                        | WebGL2                          |
| [vibrance()](https://www.remotion.dev/docs/effects/vibrance)                                     | WebGL2                          |
| [vignette()](https://www.remotion.dev/docs/effects/vignette)                                     | WebGL2                          |
| [wave()](https://www.remotion.dev/docs/effects/wave)                                             | WebGL2                          |
| [waves()](https://www.remotion.dev/docs/effects/waves)                                           | WebGL2                          |
| [whiteBalance()](https://www.remotion.dev/docs/effects/white-balance)                            | WebGL2                          |
| [whiteNoise()](https://www.remotion.dev/docs/effects/white-noise)                                | WebGL2                          |
| [xyTranslate()](https://www.remotion.dev/docs/effects/xy-translate)                              | Canvas 2D                       |
| [zigzag()](https://www.remotion.dev/docs/effects/zigzag)                                         | WebGL2                          |
| [zoomBlur()](https://www.remotion.dev/docs/effects/zoom-blur)                                    | WebGL2                          |

## Ranh giới của danh mục

“Đủ” ở đây là đủ factory công khai trong package đúng phiên bản trên. Remotion cho phép lập trình hiệu ứng tuỳ ý nên không có danh sách hữu hạn của mọi thứ có thể tạo. Chữ dùng bộ CSS/SVG riêng; 81 effect gốc áp lên ảnh. Các chuyển cảnh của editor không phải bản sao toàn bộ presentation của @remotion/transitions.

Xem [giới hạn và trạng thái kiểm tra](KIEM-TRA.md). Không bật server hoặc tự render trong lần mở rộng v0.2.
