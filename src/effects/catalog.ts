import generated from "./catalog.generated.json";
import type { EasingName } from "../catalog";
export type Value = number | string | boolean | number[] | string[];
export type FieldSchema = {
  type: string;
  default?: Value;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  description?: string;
  variants?: Record<string, Record<string, FieldSchema>>;
  item?: FieldSchema;
  minLength?: number;
  maxLength?: number;
  newItemDefault?: Value;
};
export type NativeEntry = {
  kind: string;
  backend: string;
  documentationLink: string | null;
  defaults: Record<string, Value>;
  schema: Record<string, FieldSchema>;
};
export type Automation = { from: number; to: number; easing: EasingName };
export type EffectSpec = {
  offset: number;
  span: number | null;
  id: string;
  kind: string;
  enabled: boolean;
  start: number;
  end: number | null;
  params: Record<string, Value>;
  automation: Record<string, Automation>;
};
export const NATIVE_EFFECTS = generated.effects as unknown as NativeEntry[];
export const EFFECT_MAP = Object.fromEntries(
  NATIVE_EFFECTS.map((e) => [e.kind, e]),
);
export const effectFields = (
  entry: NativeEntry,
  params: Record<string, Value>,
  all = false,
): Record<string, FieldSchema> => {
  const result: Record<string, FieldSchema> = {};
  const collect = (fields: Record<string, FieldSchema>) => {
    for (const [key, field] of Object.entries(fields)) {
      if (key === "disabled") continue;
      result[key] = field;
      if (field.variants) {
        for (const [name, children] of Object.entries(field.variants))
          if (all || name === (params[key] ?? field.default)) collect(children);
      }
    }
  };
  collect(entry.schema);
  return result;
};
const groups: Record<string, string[]> = {
  "Màu & sắc độ": [
    "brightness",
    "contrast",
    "saturation",
    "grayscale",
    "invert",
    "hue",
    "exposure",
    "colorCorrection",
    "duotone",
    "levels",
    "lut",
    "shadowsHighlights",
    "thermalVision",
    "tint",
    "vibrance",
    "whiteBalance",
    "colorKey",
    "linearGradient",
    "linearGradientTint",
  ],
  "Mờ & vệt": [
    "blur",
    "lensBlur",
    "lightTrail",
    "linearProgressiveBlur",
    "radialProgressiveBlur",
    "regionBlur",
    "zoomBlur",
  ],
  "Ánh sáng": [
    "dropShadow",
    "glow",
    "lightLeak",
    "shine",
    "starburst",
    "vignette",
    "bevelAlpha",
  ],
  "Biến dạng": [
    "barrelDistortion",
    "chromaticAberration",
    "cornerPin",
    "fisheye",
    "mirror",
    "noiseDisplacement",
    "scale",
    "skew",
    "tile",
    "uvTranslate",
    "xyTranslate",
    "wave",
    "turbulentDisplace",
    "cylinder",
    "sphere",
    "pageTurn",
  ],
  "Hoạ tiết": [
    "burlap",
    "checkerboard",
    "contourLines",
    "dotGrid",
    "emboss",
    "flannel",
    "fractalNoise",
    "gridlines",
    "halftone",
    "halftoneLinearGradient",
    "lines",
    "liquidContours",
    "noise",
    "paper",
    "pattern",
    "rings",
    "scanlines",
    "speckle",
    "tvSignalOff",
    "waves",
    "whiteNoise",
    "zigzag",
  ],
  "Viền & phân rã": [
    "outline",
    "roughenEdges",
    "shrinkwrap",
    "tear",
    "evolve",
    "linearProgressivePixelate",
    "pixelate",
    "pixelDissolve",
    "radialProgressivePixelate",
    "venetianBlinds",
  ],
};
const names: Record<string, string> = Object.fromEntries(
  `barrelDistortion:Méo ống kính|bevelAlpha:Vát nổi|blur:Làm mờ|burlap:Vải bố|fractalNoise:Nhiễu fractal|flannel:Vải sọc|checkerboard:Ô bàn cờ|chromaticAberration:Lệch sắc|colorKey:Khoá màu|colorCorrection:Chỉnh màu|brightness:Độ sáng|contrast:Tương phản|contourLines:Đường đồng mức|cylinder:Cuộn trụ|dropShadow:Bóng đổ|duotone:Hai tông màu|emboss:Dập nổi|evolve:Tiến hoá hạt|exposure:Phơi sáng|fisheye:Mắt cá|cornerPin:Ghim bốn góc|glow:Phát sáng|gridlines:Lưới|halftone:In chấm|halftoneLinearGradient:In chấm chuyển sắc|pixelDissolve:Tan điểm ảnh|pixelate:Điểm ảnh lớn|grayscale:Đen trắng|hue:Đổi sắc|invert:Đảo màu|lines:Đường kẻ|linearGradient:Dải chuyển sắc|linearGradientTint:Nhuộm chuyển sắc|liquidContours:Đường chất lỏng|linearProgressiveBlur:Mờ theo dải|linearProgressivePixelate:Điểm ảnh theo dải|lensBlur:Mờ ống kính|levels:Các mức màu|lut:LUT .cube|lightLeak:Ánh sáng lọt|lightTrail:Vệt sáng|dotGrid:Lưới chấm|mirror:Gương|noise:Nhiễu|noiseDisplacement:Dịch chuyển nhiễu|outline:Đường viền|pageTurn:Lật trang|paper:Giấy|roughenEdges:Viền thô|pattern:Lặp hoạ tiết|radialProgressiveBlur:Mờ hướng tâm|radialProgressivePixelate:Điểm ảnh hướng tâm|regionBlur:Mờ vùng|rings:Vòng tròn|saturation:Bão hoà|scanlines:Vạch quét|scale:Tỷ lệ ảnh|shadowsHighlights:Vùng tối và sáng|shine:Ánh sáng quét|shrinkwrap:Co bọc|skew:Nghiêng ảnh|speckle:Hạt đốm|sphere:Chiếu lên cầu|starburst:Tia sao|tear:Xé|thermalVision:Ảnh nhiệt|tile:Lát ảnh|tint:Nhuộm màu|uvTranslate:Dịch theo UV|xyTranslate:Dịch theo pixel|turbulentDisplace:Méo hỗn loạn|tvSignalOff:Mất tín hiệu TV|venetianBlinds:Rèm lá|vibrance:Màu sống động|vignette:Tối góc|wave:Sóng|waves:Nhiều sóng|whiteBalance:Cân bằng trắng|whiteNoise:Nhiễu trắng|zoomBlur:Mờ zoom|zigzag:Zigzag`
    .split("|")
    .map((s) => s.split(":")),
);
export const effectName = (kind: string) => names[kind] || kind;
export const effectGroup = (kind: string) =>
  Object.entries(groups).find(([, kinds]) => kinds.includes(kind))?.[0] ||
  "Khác";
export const makeEffect = (kind: string): EffectSpec => {
  const entry = EFFECT_MAP[kind];
  if (!entry) throw new Error("Hiệu ứng không được hỗ trợ.");
  return {
    id: crypto.randomUUID(),
    kind,
    enabled: true,
    offset: 0,
    span: null,
    start: 0,
    end: null,
    params: structuredClone(entry.defaults),
    automation:
      entry.schema.progress?.type === "number"
        ? { progress: { from: 0, to: 1, easing: "linear" } }
        : {},
  };
};
