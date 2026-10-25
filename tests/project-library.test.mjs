import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectLibrary } from "../scripts/project-library.mjs";
import { emptyProject, makeScene } from "../dist/model.mjs";
import { defaultStoryOptions } from "../dist/story.mjs";
import { revisionDiff } from "../dist/revision.mjs";
const fixture = (name) => ({
  project: {
    ...emptyProject(),
    assets: [
      {
        id: "a",
        name: "01.png",
        src: "/media/keep-original.png",
        width: 720,
        height: 1280,
      },
    ],
    voiceover: {
      script: "1. Giữ nguyên lời đọc.",
      scriptName: "script.txt",
      assets: [
        {
          id: "v",
          name: "01.mp3",
          src: "/media/keep-original.mp3",
          duration: 4,
        },
      ],
    },
    scenes: [
      {
        ...makeScene("a"),
        id: "s",
        duration: 4,
        voice: { assetId: "v", duration: 4 },
      },
    ],
  },
  options: { ...defaultStoryOptions(), name },
  dirty: true,
  job: null,
});
const wave = { id: "v", envelope: { stepMs: 50, values: [0.1, 0.6, 0.2] } };
const call = (library, action, payload, id) =>
  library.request(action, {
    projectId: id,
    raw: payload && JSON.stringify(payload),
  });

test("projects stay separate, preserve drafts/options/voices, and survive restart with only small journal writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-projects-"));
  let library = new ProjectLibrary(root);
  try {
    const a = await call(library, "create", {
      workspace: fixture("Tuổi thơ"),
      waves: [wave],
    });
    const b = await call(library, "create", {
      workspace: fixture("Video khác"),
    });
    assert.notEqual(a.entry.id, b.entry.id);
    const file = join(root, "data/projects", a.entry.id, "workspace.json");
    const original = await readFile(file, "utf8");
    const next = fixture("Tuổi thơ đã sửa");
    next.options.motion = "zoom-out";
    next.project.voiceover.script = "1. Câu mới nhưng vẫn đúng giọng.";
    const changed = await call(
      library,
      "save",
      {
        revision: a.revision,
        patch: revisionDiff(fixture("Tuổi thơ"), next),
        waves: [],
      },
      a.entry.id,
    );
    assert.equal(
      await readFile(file, "utf8"),
      original,
      "Small edits do not rewrite the snapshot",
    );
    const log = await readFile(
      join(root, "data/projects", a.entry.id, "changes.jsonl"),
      "utf8",
    );
    assert.ok(log.length < original.length);
    const repeated = await call(
      library,
      "save",
      { revision: changed.revision, patch: null, waves: [] },
      a.entry.id,
    );
    assert.equal(repeated.revision, changed.revision);
    await library.close();
    library = new ProjectLibrary(root);
    const reopened = await call(library, "open", null, a.entry.id);
    assert.equal(reopened.workspace.options.name, "Tuổi thơ đã sửa");
    assert.equal(reopened.workspace.options.motion, "zoom-out");
    assert.equal(reopened.workspace.dirty, true);
    assert.equal(
      reopened.workspace.project.voiceover.script,
      next.project.voiceover.script,
    );
    assert.deepEqual(
      reopened.workspace.project.voiceover.assets[0].envelope,
      wave.envelope,
    );
    assert.equal(
      reopened.workspace.project.voiceover.assets[0].src,
      "/media/keep-original.mp3",
    );
    const other = await call(library, "open", null, b.entry.id);
    assert.equal(other.workspace.options.name, "Video khác");
    assert.equal(
      other.workspace.project.voiceover.script,
      "1. Giữ nguyên lời đọc.",
    );
    await assert.rejects(
      call(
        library,
        "save",
        {
          revision: a.revision,
          patch: revisionDiff(next, fixture("Stale tab")),
        },
        a.entry.id,
      ),
      (e) => e.status === 409,
    );
    await assert.rejects(call(library, "open", null, "../../bad"), /ID dự án/);
    await assert.rejects(
      call(library, "create", { workspace: { project: {} } }),
      /không hợp lệ/,
    );
    assert.equal((await library.request("list")).projects.length, 2);
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy migration is idempotent and cannot overwrite subsequent editing", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-migrate-"));
  const library = new ProjectLibrary(root);
  try {
    const payload = {
      workspace: fixture("Bản nháp cũ"),
      waves: [wave],
      migrate: true,
    };
    const first = await call(library, "create", payload);
    const next = fixture("Đã tiếp tục làm");
    await call(
      library,
      "save",
      {
        revision: first.revision,
        patch: revisionDiff(payload.workspace, next),
        waves: [],
      },
      first.entry.id,
    );
    const retry = await call(library, "create", payload);
    assert.equal(retry.entry.id, first.entry.id);
    assert.equal(retry.workspace.options.name, "Đã tiếp tục làm");
    assert.equal((await library.request("list")).projects.length, 1);
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("journal compacts, replays after a partial write, and rebuilds a lost index", async () => {
  const root = await mkdtemp(join(tmpdir(), "khung-recovery-"));
  let library = new ProjectLibrary(root);
  try {
    let workspace = fixture("Bắt đầu");
    const saved = await call(library, "create", { workspace });
    let revision = saved.revision;
    const id = saved.entry.id;
    for (let i = 1; i <= 35; i++) {
      const next = {
        ...workspace,
        options: { ...workspace.options, name: `Video ${i}` },
      };
      const result = await call(
        library,
        "save",
        { revision, patch: revisionDiff(workspace, next), waves: [] },
        id,
      );
      workspace = next;
      revision = result.revision;
    }
    const base = JSON.parse(
      await readFile(join(root, "data/projects", id, "workspace.json"), "utf8"),
    );
    assert.equal(base.sequence, 32);
    assert.equal(base.workspace.options.name, "Video 32");
    await library.close();
    await appendFile(
      join(root, "data/projects", id, "changes.jsonl"),
      '{"partial":',
    );
    await rm(join(root, "data/projects/index.json"));
    library = new ProjectLibrary(root);
    const list = await library.request("list");
    assert.equal(list.projects[0].name, "Video 35");
    const recovered = await call(library, "open", null, id);
    assert.equal(recovered.revision, revision);
    const next = {
      ...workspace,
      options: { ...workspace.options, name: "Tiếp tục" },
    };
    await call(
      library,
      "save",
      { revision, patch: revisionDiff(workspace, next), waves: [] },
      id,
    );
    await library.close();
    library = new ProjectLibrary(root);
    assert.equal(
      (await call(library, "open", null, id)).workspace.options.name,
      "Tiếp tục",
    );
    await library.close();
    await writeFile(
      join(root, "data/projects", id, "workspace.json"),
      "corrupt",
    );
    library = new ProjectLibrary(root);
    await assert.rejects(call(library, "open", null, id), /không đọc được/i);
    assert.equal(
      await readFile(join(root, "data/projects", id, "workspace.json"), "utf8"),
      "corrupt",
    );
  } finally {
    await library.close();
    await rm(root, { recursive: true, force: true });
  }
});
