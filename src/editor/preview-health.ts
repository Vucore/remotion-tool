// Observe the actual Remotion frame progression. Seeks/background gaps reset the window.
export class PreviewHealth {
  private previous: { frame: number; now: number } | undefined;
  private start = 0;
  private missing = 0;
  private shown = 0;
  private slowWindows = 0;
  private goodWindows = 0;
  sample(
    frame: number,
    now: number,
    fps: number,
  ): "light" | "full" | undefined {
    const previous = this.previous;
    this.previous = { frame, now };
    if (
      !previous ||
      frame <= previous.frame ||
      frame - previous.frame > Math.max(4, fps * 0.5) ||
      now - previous.now > 500
    ) {
      this.start = now;
      this.missing = 0;
      this.shown = 0;
      return;
    }
    this.missing += Math.max(0, frame - previous.frame - 1);
    this.shown++;
    if (now - this.start < 1000) return;
    const ratio = this.missing / Math.max(1, this.missing + this.shown);
    const slow =
      ratio > 0.15 || this.shown / ((now - this.start) / 1000) < fps * 0.75;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    this.goodWindows = slow ? 0 : this.goodWindows + 1;
    this.start = now;
    this.missing = 0;
    this.shown = 0;
    if (this.slowWindows >= 2) {
      this.slowWindows = 0;
      return "light";
    }
    if (this.goodWindows >= 12) {
      this.goodWindows = 0;
      return "full";
    }
  }
}
