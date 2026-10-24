import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { emptyProject, makeScene, parseProject } from "../dist/model.mjs";
const origin = process.env.KHUNG_TEST_SERVER;
const enabled = Boolean(origin);

test(
  "image metadata/proxy and streaming voice upload keep source quality",
  { skip: !enabled },
  async () => {
    const image = await readFile("test/images/01_ngu-nuong.png");
    const hash = createHash("sha256").update(image).digest("hex");
    const imagePath = `data/uploads/${hash}.png`;
    let existed = true,
      voice;
    try {
      await access(imagePath);
    } catch {
      existed = false;
    }
    try {
      const response = await fetch(origin + "/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: image,
      });
      const asset = await response.json();
      assert.equal(response.status, 201);
      assert.equal(asset.width, 720);
      assert.equal(asset.height, 1280);
      const proxy = await fetch(
        origin +
          "/api/proxy?src=" +
          encodeURIComponent(asset.src) +
          "&size=384",
      );
      assert.equal(proxy.status, 200);
      assert.match(proxy.headers.get("content-type"), /webp/);
      assert.ok((await proxy.arrayBuffer()).byteLength < image.byteLength);
      const wav = await readFile("test/voices/01_ngu-nuong.wav");
      const upload = await fetch(origin + "/api/voices?name=01_test.wav", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });
      voice = await upload.json();
      assert.equal(upload.status, 201, JSON.stringify(voice));
      assert.ok(voice.envelope.values.length > 100);
      assert.deepEqual(
        Buffer.from(await (await fetch(origin + voice.src)).arrayBuffer()),
        wav,
      );
    } finally {
      if (!existed) await rm(imagePath, { force: true });
      if (voice?.src)
        await rm("data/uploads/" + voice.src.slice(7), { force: true });
    }
  },
);

test(
  "real export runs as a durable background job",
  { skip: !enabled || !process.env.KHUNG_TEST_RENDER, timeout: 180000 },
  async () => {
    const project = emptyProject();
    project.width = 270;
    project.height = 480;
    project.assets = [
      {
        id: "a",
        name: "01.svg",
        src: "/samples/coast.svg",
        width: 1600,
        height: 1000,
      },
    ];
    project.scenes = [{ ...makeScene("a"), duration: 0.5, transition: "none" }];
    const response = await fetch(origin + "/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: parseProject(project),
        filename: "performance-smoke.mp4",
        mode: "editing",
      }),
    });
    let job = await response.json();
    assert.equal(response.status, 202, JSON.stringify(job));
    try {
      const start = Date.now();
      while (
        ["queued", "preparing", "rendering"].includes(job.status) &&
        Date.now() - start < 160000
      ) {
        const health = await fetch(origin + "/api/exports");
        assert.equal(health.status, 200);
        await new Promise((resolve) => setTimeout(resolve, 500));
        job = await (await fetch(origin + "/api/exports/" + job.id)).json();
      }
      assert.equal(job.status, "done", JSON.stringify(job));
      assert.ok(
        (await (await fetch(origin + job.url)).arrayBuffer()).byteLength > 500,
      );
    } finally {
      if (["queued", "preparing", "rendering"].includes(job.status))
        await fetch(origin + "/api/exports/" + job.id, { method: "DELETE" });
      else {
        for (const filename of [
          `data/exports/${job.id}.mp4`,
          `data/exports/${job.id}.srt`,
          `data/jobs/${job.id}.json`,
          `data/jobs/${job.id}.snapshot.json`,
        ])
          await rm(filename, { force: true });
      }
    }
  },
);
