import { useEffect, useState } from "react";
import { delayRender, continueRender, cancelRender } from "remotion";
import type { FontAsset } from "./model";
const cache = new Map<string, Promise<FontFace>>();
export function FontLoader({ fonts }: { fonts: FontAsset[] }) {
  const [handle] = useState(() => delayRender("Đang nạp font của dự án"));
  useEffect(() => {
    let active = true;
    void Promise.all(
      fonts.map((font) => {
        const key = font.id + font.src;
        if (!cache.has(key)) {
          const face = new FontFace(
            font.id,
            `url(${JSON.stringify(font.src)})`,
          );
          cache.set(
            key,
            face
              .load()
              .then((loaded) => {
                document.fonts.add(loaded);
                return loaded;
              })
              .catch((error) => {
                cache.delete(key);
                throw error;
              }),
          );
        }
        return cache.get(key)!;
      }),
    )
      .then(() => {
        if (active) continueRender(handle);
      })
      .catch((error) => {
        if (active)
          cancelRender(new Error(`Không tải được font: ${error.message}`));
      });
    return () => {
      active = false;
      continueRender(handle);
    };
  }, [fonts, handle]);
  return null;
}
