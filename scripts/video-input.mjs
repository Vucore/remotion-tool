import { getVideoMetadata } from "@remotion/renderer";
import { open } from "node:fs/promises";

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export async function inspectVideo(path) {
  const file = await open(path, "r");
  try {
    const magic = Buffer.alloc(12);
    await file.read(magic, 0, 12, 0);
    if (magic.toString("ascii", 4, 8) !== "ftyp")
      throw Error("Chọn file MP4 hợp lệ.");
  } finally {
    await file.close();
  }
  const info = await getVideoMetadata(path, { logLevel: "error" });
  if (
    !info.durationInSeconds ||
    info.durationInSeconds > 36000 ||
    info.width < 1 ||
    info.height < 1 ||
    info.width > 7680 ||
    info.height > 7680
  )
    throw Error("MP4 cần có video hợp lệ, tối đa 10 giờ và 7680 px mỗi chiều.");
  if (info.codec !== "h264")
    throw Error(
      "MP4 cần mã hóa H.264 để xem và ghép ổn định. Hãy chuyển clip sang MP4 H.264 rồi nhập lại.",
    );
  return {
    width: info.width,
    height: info.height,
    duration: info.durationInSeconds,
  };
}
