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
  if (
    indexedDB.databases &&
    !(await indexedDB.databases()).some((db) => db.name === "khung-workspace")
  )
    return undefined;
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
// Called only after the server has acknowledged the migrated project.
export async function clearLegacyDraft() {
  if (
    indexedDB.databases &&
    !(await indexedDB.databases()).some((db) => db.name === "khung-workspace")
  )
    return;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        ["draft", "waves", "parts"],
        "readwrite",
      );
      for (const name of ["draft", "waves", "parts"])
        transaction.objectStore(name).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
