import type { SceneDialogue } from "../auto/tts";
export type NarrationRow = {
  id: string;
  order: number;
  text: string;
  speakerId: string;
};
export function narrationDocument(rows: NarrationRow[]) {
  const grouped = new Map<number, SceneDialogue["turns"]>();
  for (const { order, text, speakerId } of rows) {
    let turns = grouped.get(order);
    if (!turns) {
      turns = [];
      grouped.set(order, turns);
    }
    turns.push({ text, speakerId });
  }
  const dialogue = [...grouped]
    .sort(([a], [b]) => a - b)
    .map(([order, turns]) => ({ order, turns }));
  return {
    dialogue,
    text: dialogue
      .map(
        (scene) =>
          `${scene.order}. ${scene.turns.map((turn) => turn.text).join("\n\n")}`,
      )
      .join("\n\n"),
  };
}

// Local typing uses a small pending map; structural actions flush before editing rows.
export class NarrationDraft {
  private pending = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private getRows: () => NarrationRow[],
    private publish: (rows: NarrationRow[]) => void,
    private delay = 250,
  ) {}
  set(id: string, text: string) {
    this.pending.set(id, text);
    clearTimeout(this.timer);
    this.timer = setTimeout(this.flush, this.delay);
  }
  merge(rows: NarrationRow[]) {
    return rows.map((row) =>
      this.pending.has(row.id)
        ? { ...row, text: this.pending.get(row.id)! }
        : row,
    );
  }
  flush = () => {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.pending.size) return;
    const next = this.merge(this.getRows());
    this.pending.clear();
    this.publish(next);
  };
  commit(rows: NarrationRow[]) {
    clearTimeout(this.timer);
    this.timer = undefined;
    const next = this.merge(rows);
    this.pending.clear();
    this.publish(next);
  }
}
