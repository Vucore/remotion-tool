import type { Project, VoiceAsset } from "../model";
type Draft = Record<string, unknown> & { project: Project };
type Root = {
  workspace: Record<string, unknown>;
  assets: string[];
  scenes: string[];
  voices: string[];
  hasVoice: boolean;
  revision?: string;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("khung-workspace", 3);
    let settled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    request.onupgradeneeded = () => {
      for (const name of ["draft", "waves", "parts"])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name);
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      settled = true;
      reject(request.error);
    };
    request.onblocked = () => {
      timer ??= setTimeout(() => {
        settled = true;
        reject(Error("Một tab cũ đang giữ kho lưu. Đóng tab đó và tải lại."));
      }, 5000);
    };
  });
}
function get<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readDraft(): Promise<Draft | undefined> {
  const db = await database();
  try {
    const root = await get<Root | undefined>(
      db.transaction("parts").objectStore("parts"),
      ["root", "current"],
    );
    if (root) {
      const transaction = db.transaction(["parts", "waves"]);
      const parts = transaction.objectStore("parts"),
        waves = transaction.objectStore("waves");
      const [metadata, options, assets, scenes, voice, voices] =
        await Promise.all([
          get<Omit<Project, "assets" | "scenes" | "voiceover">>(parts, [
            "project",
            "current",
          ]),
          get<unknown>(parts, ["options", "current"]),
          Promise.all(
            root.assets.map((id) =>
              get<Project["assets"][number]>(parts, ["asset", id]),
            ),
          ),
          Promise.all(
            root.scenes.map((id) =>
              get<Project["scenes"][number]>(parts, ["scene", id]),
            ),
          ),
          root.hasVoice
            ? get<Omit<NonNullable<Project["voiceover"]>, "assets">>(parts, [
                "voice",
                "current",
              ])
            : undefined,
          Promise.all(
            root.voices.map(async (id) => {
              const [value, envelope] = await Promise.all([
                get<VoiceAsset>(parts, ["audio", id]),
                get<VoiceAsset["envelope"]>(waves, id),
              ]);
              return envelope ? { ...value, envelope } : value;
            }),
          ),
        ]);
      return {
        ...root.workspace,
        options,
        project: {
          ...metadata,
          assets,
          scenes,
          ...(voice ? { voiceover: { ...voice, assets: voices } } : {}),
        },
      };
    }
    const legacy = await get<Draft | undefined>(
      db.transaction("draft").objectStore("draft"),
      "current",
    );
    if (legacy?.project.voiceover?.assets.length) {
      const waves = db.transaction("waves").objectStore("waves");
      await Promise.all(
        legacy.project.voiceover.assets.map(async (voice) => {
          const envelope = await get<VoiceAsset["envelope"]>(waves, voice.id);
          if (envelope) voice.envelope = envelope;
        }),
      );
    }
    return legacy;
  } finally {
    db.close();
  }
}
function shallowSame(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown>,
) {
  return (
    a &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(b).every((key) => Object.is(a[key], b[key]))
  );
}
export class DraftWriter {
  private previous: Draft | undefined;
  private revision: string | undefined;
  private metadata: Record<string, unknown> | undefined;
  private voice: Record<string, unknown> | undefined;
  async save(
    draft: Draft,
    changedWaves: { id: string; envelope: VoiceAsset["envelope"] }[],
  ) {
    const project = draft.project,
      previous = this.previous?.project;
    const { assets, scenes, voiceover, ...metadata } = project;
    const { assets: _audio, ...voice } = voiceover ?? { assets: [] };
    void _audio;
    const records: [IDBValidKey, unknown][] = [];
    const allRecords: [IDBValidKey, unknown][] = [];
    const collections = [
      ["asset", assets, previous?.assets],
      ["scene", scenes, previous?.scenes],
      ["audio", voiceover?.assets ?? [], previous?.voiceover?.assets],
    ] as const;
    for (const [kind, values, old] of collections) {
      const indexed = new Map((old ?? []).map((value) => [value.id, value]));
      for (const value of values) {
        allRecords.push([[kind, value.id], value]);
        if (indexed.get(value.id) !== value)
          records.push([[kind, value.id], value]);
      }
    }
    allRecords.push(
      [["project", "current"], metadata],
      [["options", "current"], draft.options],
    );
    if (voiceover) allRecords.push([["voice", "current"], voice]);
    if (!shallowSame(this.metadata, metadata))
      records.push([["project", "current"], metadata]);
    if (voiceover && !shallowSame(this.voice, voice))
      records.push([["voice", "current"], voice]);
    if (!this.previous || this.previous.options !== draft.options)
      records.push([["options", "current"], draft.options]);
    const { project: _project, options: _options, ...workspace } = draft;
    void _project;
    void _options;
    const revision = crypto.randomUUID();
    const root: Root = {
      revision,
      workspace,
      assets: assets.map((a) => a.id),
      scenes: scenes.map((s) => s.id),
      voices: voiceover?.assets.map((v) => v.id) ?? [],
      hasVoice: Boolean(voiceover),
    };
    records.push([["root", "current"], root]);
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(
          ["parts", "waves", "draft"],
          "readwrite",
        );
        const parts = transaction.objectStore("parts");
        const current = parts.get(["root", "current"]);
        current.onsuccess = () => {
          // Another tab may have saved a different project since our last transaction.
          // Re-publish all referenced records in that case, retaining snapshot consistency.
          const changedOwner =
            (current.result as Root | undefined)?.revision !== this.revision;
          const oldRoot = current.result as Root | undefined;
          for (const [kind, oldIds, newIds] of [
            ["asset", oldRoot?.assets, root.assets],
            ["scene", oldRoot?.scenes, root.scenes],
            ["audio", oldRoot?.voices, root.voices],
          ] as const) {
            const retained = new Set(newIds);
            for (const id of oldIds ?? [])
              if (!retained.has(id)) parts.delete([kind, id]);
          }
          if (!root.hasVoice) parts.delete(["voice", "current"]);
          for (const [key, value] of changedOwner
            ? [
                ...allRecords,
                [["root", "current"], root] as [IDBValidKey, unknown],
              ]
            : records)
            parts.put(value, key);
          for (const wave of changedWaves)
            transaction.objectStore("waves").put(wave.envelope, wave.id);
          transaction.objectStore("draft").delete("current");
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      this.revision = revision;
      this.previous = draft;
      this.metadata = metadata;
      this.voice = voiceover ? voice : undefined;
    } finally {
      db.close();
    }
  }
}
