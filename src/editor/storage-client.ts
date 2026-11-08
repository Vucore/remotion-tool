export type StorageGroup = {
  id: string;
  path: string;
  category: "cache" | "models" | "exports" | "system";
  title: string;
  description: string;
  effect: string;
  bytes: number;
  diskBytes: number;
  files: number;
  deletableFiles: number;
  skipped: number;
  contents: string[];
  canDelete: boolean;
  reason: string;
  revision: string;
};
export type StorageReport = {
  groups: StorageGroup[];
  root: string;
  cache: {
    bytes: number;
    diskBytes: number;
    files: number;
    incomplete: boolean;
    skipped: number;
  };
  scannedAt: string;
  totalBytes: number;
  busy: boolean;
};
export type StorageChange = {
  removedExports: string[];
  cacheCleared: boolean;
  group?: string;
};
const topic = "khung-storage-change";
export function notifyStorageChange(change: StorageChange) {
  window.dispatchEvent(new CustomEvent(topic, { detail: change }));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(topic);
    channel.postMessage(change);
    channel.close();
  }
}
export function watchStorageChanges(callback: (change: StorageChange) => void) {
  const accept = (value: StorageChange) => {
    if (
      value &&
      Array.isArray(value.removedExports) &&
      value.removedExports.every((id) => typeof id === "string")
    )
      callback(value);
  };
  const local = (event: Event) =>
    accept((event as CustomEvent<StorageChange>).detail);
  window.addEventListener(topic, local);
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(topic);
  if (channel)
    channel.onmessage = (event: MessageEvent<StorageChange>) =>
      accept(event.data);
  return () => {
    window.removeEventListener(topic, local);
    channel?.close();
  };
}
export async function storageReport(
  signal?: AbortSignal,
): Promise<StorageReport> {
  const response = await fetch("/api/storage", { signal });
  const result = await response.json();
  if (!response.ok)
    throw Error(result.error || "Chưa kiểm tra được dung lượng.");
  if (!result.root || !result.cache)
    throw Error("Server đang dùng phiên bản cũ. Khởi động lại server rồi mở Dung lượng lần nữa.");
  return result;
}
export async function clearStorage(group: StorageGroup) {
  const response = await fetch("/api/storage", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      group: group.id,
      revision: group.revision,
      confirm: true,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (Array.isArray(result.removedExports) && result.removedExports.length)
      notifyStorageChange({
        removedExports: result.removedExports,
        cacheCleared: false,
      });
    throw Error(result.error || "Chưa dọn được dung lượng.");
  }
  return result as StorageChange & {
    removed: number;
    bytes: number;
    failures: string[];
  };
}
export function storageSize(bytes: number) {
  const mb = bytes / 1_000_000;
  if (bytes > 0 && mb < 0.001) return "< 0,001 MB";
  return `${mb.toLocaleString("vi", {
    minimumFractionDigits: 2,
    maximumFractionDigits: mb > 0 && mb < 1 ? 3 : 2,
  })} MB`;
}
