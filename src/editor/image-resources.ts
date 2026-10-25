import { proxySource } from "./performance";

type Priority = "preview" | "next" | "thumbnail";
const priorities: Record<Priority, number> = {
  preview: 2,
  next: 1,
  thumbnail: 0,
};
type Entry = {
  key: string;
  source: string;
  size: number;
  priority: number;
  users: number;
  controller: AbortController;
  promise: Promise<string>;
  resolve: (src: string) => void;
  reject: (error: Error) => void;
  active: boolean;
};
const aborted = () => new DOMException("Đã hủy tải ảnh.", "AbortError");

// Only a few decoded images may be in flight. Keep URLs, never an entire project's
// decoded bitmaps, in the completed cache. The browser manages its own image cache.
export class ImageResources {
  private pending = new Map<string, Entry>();
  private ready = new Map<string, string>();
  private originalUntil = new Map<string, number>();
  private active = 0;

  constructor(
    private createImage: () => HTMLImageElement = () => new Image(),
    private proxyTimeout = 8000,
    private originalTimeout = 15000,
  ) {}

  private key(src: string, size: number) {
    return proxySource(src, size);
  }

  peek(src: string, size: number) {
    return this.ready.get(this.key(src, size));
  }

  invalidate(src: string, size: number, useOriginal = false) {
    const key = this.key(src, size);
    this.ready.delete(key);
    if (useOriginal) {
      this.originalUntil.delete(key);
      this.originalUntil.set(key, Date.now() + 30000);
      if (this.originalUntil.size > 256)
        this.originalUntil.delete(this.originalUntil.keys().next().value!);
    }
  }

  acquire(src: string, size: number, priority: Priority) {
    const key = this.key(src, size);
    const cached = this.ready.get(key);
    if (cached) {
      this.ready.delete(key);
      this.ready.set(key, cached);
      return { promise: Promise.resolve(cached), release: () => {} };
    }
    let entry = this.pending.get(key);
    if (!entry) {
      let resolve!: Entry["resolve"], reject!: Entry["reject"];
      const promise = new Promise<string>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      entry = {
        key,
        source: src,
        size,
        priority: priorities[priority],
        users: 0,
        controller: new AbortController(),
        promise,
        resolve,
        reject,
        active: false,
      };
      this.pending.set(key, entry);
    }
    entry.users++;
    entry.priority = Math.max(entry.priority, priorities[priority]);
    const current = entry;
    this.drain();
    let released = false;
    return {
      promise: current.promise,
      release: () => {
        if (released) return;
        released = true;
        if (--current.users || this.pending.get(key) !== current) return;
        this.pending.delete(key);
        current.controller.abort();
        current.reject(aborted());
        this.drain();
      },
    };
  }

  private drain() {
    // Reserve one of three slots for an image needed by the current frame.
    while (this.active < 3) {
      const entry = [...this.pending.values()]
        .filter((item) => !item.active)
        .sort((a, b) => b.priority - a.priority)[0];
      if (!entry || (this.active >= 2 && entry.priority < 2)) return;
      entry.active = true;
      this.active++;
      void this.load(entry)
        .then(
          (src) => {
            if (entry.controller.signal.aborted) return;
            this.ready.set(entry.key, src);
            if (this.ready.size > 192)
              this.ready.delete(this.ready.keys().next().value!);
            entry.resolve(src);
          },
          (error: Error) => entry.reject(error),
        )
        .finally(() => {
          if (this.pending.get(entry.key) === entry)
            this.pending.delete(entry.key);
          this.active--;
          this.drain();
        });
    }
  }

  private async load(entry: Entry) {
    const { key, source, controller } = entry;
    if (key !== source && (this.originalUntil.get(key) ?? 0) < Date.now()) {
      try {
        // Stable URLs let preloading and the displayed image share browser cache.
        await this.decode(key, controller.signal, this.proxyTimeout, entry);
        return key;
      } catch (error) {
        if (controller.signal.aborted) throw error;
        this.invalidate(source, entry.size, true);
      }
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await this.decode(
          source,
          controller.signal,
          this.originalTimeout,
          entry,
        );
        return source;
      } catch (error) {
        if (controller.signal.aborted || attempt >= 1) throw error;
      }
    }
  }

  private decode(
    src: string,
    signal: AbortSignal,
    timeout: number,
    entry: Entry,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(aborted());
      const image = this.createImage();
      image.decoding = "async";
      image.fetchPriority = entry.priority === 2 ? "high" : "low";
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        image.onload = null;
        image.onerror = null;
        // Abort the network request as well as ignoring its eventual callback.
        if (error) image.removeAttribute("src");
        if (error) reject(error);
        else resolve();
      };
      const cancel = () => finish(aborted());
      const timer = setTimeout(
        () => finish(Error("Tải ảnh quá lâu.")),
        timeout,
      );
      signal.addEventListener("abort", cancel, { once: true });
      image.onload = () => {
        void image.decode().then(
          () => finish(),
          () => finish(Error("Không giải mã được ảnh.")),
        );
      };
      image.onerror = () => finish(Error("Không tải được ảnh."));
      image.src = src;
    });
  }
}

export const imageResources = new ImageResources();
