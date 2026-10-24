import { createContext, useContext } from "react";
export const PreviewQuality = createContext<"light" | "full">("full");
export const usePreviewQuality = () => useContext(PreviewQuality);
