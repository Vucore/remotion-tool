export type ImageProcessingSettings = {
  autoOnImport: boolean;
  removeLogo: boolean;
  upscale: boolean;
  region: { x: number; y: number; width: number; height: number };
  padding: number;
  feather: number;
  context: number;
  scale: 2 | 4;
  device: "auto" | "mps" | "cuda" | "cpu";
  tile: number;
};
export const defaultImageProcessing = (): ImageProcessingSettings => ({
  autoOnImport: false,
  removeLogo: true,
  upscale: false,
  region: { x: 0.883, y: 0.8, width: 0.052, height: 0.085 },
  padding: 4,
  feather: 2,
  context: 96,
  scale: 2,
  device: "auto",
  tile: 256,
});
export function parseImageProcessing(input: unknown): ImageProcessingSettings {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Cấu hình xử lý ảnh không hợp lệ.");
  const s = {
    ...defaultImageProcessing(),
    ...input,
  } as ImageProcessingSettings;
  const numeric = (
    value: number,
    min: number,
    max: number,
    integer = false,
  ) => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw Error("Thông số xử lý ảnh nằm ngoài giới hạn.");
    return value;
  };
  if (
    [s.autoOnImport, s.removeLogo, s.upscale].some(
      (v) => typeof v !== "boolean",
    )
  )
    throw Error("Bật/tắt xử lý ảnh không hợp lệ.");
  if (!s.region || typeof s.region !== "object")
    throw Error("Chưa có vùng xóa logo.");
  const region = {
    x: numeric(s.region.x, 0, 1),
    y: numeric(s.region.y, 0, 1),
    width: numeric(s.region.width, 0.001, 1),
    height: numeric(s.region.height, 0.001, 1),
  };
  if (region.x + region.width > 1.000001 || region.y + region.height > 1.000001)
    throw Error("Vùng logo phải nằm trong ảnh.");
  if (
    ![2, 4].includes(s.scale) ||
    !["auto", "mps", "cuda", "cpu"].includes(s.device)
  )
    throw Error("Thiết lập upscale không được hỗ trợ.");
  return {
    ...s,
    region,
    padding: numeric(s.padding, 0, 64, true),
    feather: numeric(s.feather, 0, 32, true),
    context: numeric(s.context, 16, 256, true),
    tile: numeric(s.tile, 64, 512, true),
  };
}
export function pixelRegion(
  region: ImageProcessingSettings["region"],
  width: number,
  height: number,
  padding = 0,
) {
  const x = Math.max(0, Math.floor(region.x * width) - padding),
    y = Math.max(0, Math.floor(region.y * height) - padding);
  return {
    x,
    y,
    width:
      Math.min(width, Math.ceil((region.x + region.width) * width) + padding) -
      x,
    height:
      Math.min(
        height,
        Math.ceil((region.y + region.height) * height) + padding,
      ) - y,
  };
}
