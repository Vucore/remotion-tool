// Run against the local editor: node scripts/smoke.mjs
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { getVideoMetadata } from "@remotion/renderer";
import { emptyProject, makeScene, makeText } from "../dist/model.mjs";
const origin = "http://127.0.0.1:3210";
const request = async (path, options) => {
  const r = await fetch(origin + path, options);
  return { status: r.status, data: await r.json() };
};
assert.equal((await request("/api/health")).status, 200);
assert.equal(
  (await request("/api/uploads", { method: "POST", body: "not an image" }))
    .status,
  415,
);
assert.equal(
  (
    await request("/api/exports", {
      method: "POST",
      body: JSON.stringify({ project: emptyProject() }),
    })
  ).status,
  400,
);
assert.equal(
  (
    await request("/api/uploads", {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
      body: "x",
    })
  ).status,
  403,
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6F6sAAAAASUVORK5CYII=",
  "base64",
);
assert.equal(
  (
    await request("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: png,
    })
  ).status,
  201,
);
const p = emptyProject();
p.name = "Kiểm tra xuất";
p.width = 360;
p.height = 640;
p.assets = ["coast", "forest", "sunset"].map((name, i) => ({
  id: `sample-${i}`,
  name,
  src: `/samples/${name}.svg`,
  width: 1600,
  height: 1000,
}));
p.scenes = p.assets.map((a, i) => ({
  ...makeScene(a.id),
  duration: 1.5,
  transition: ["fade", "slide", "wipe"][i],
  motion: ["zoom-in", "pan-left", "zoom-out"][i],
  texts: [{ ...makeText(), text: `Cảnh ${i + 1}`, size: 80 }],
}));
const start = await request("/api/exports", {
  method: "POST",
  body: JSON.stringify({ project: p, quality: "standard" }),
});
assert.equal(start.status, 202);
console.log(`Export ${start.data.id}`);
let result;
for (let i = 0; i < 240; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  result = (await request(`/api/exports/${start.data.id}`)).data;
  if (["done", "error", "cancelled"].includes(result.status)) break;
}
assert.equal(result.status, "done", result.error || "Render timeout");
const response = await fetch(origin + result.url);
assert.equal(response.status, 200);
const bytes = Buffer.from(await response.arrayBuffer());
assert.ok(bytes.length > 1000);
const metadata = await getVideoMetadata(`data/exports/${result.id}.mp4`);
assert.equal(metadata.width, 360);
assert.equal(metadata.height, 640);
assert.equal(metadata.fps, 30);
assert.ok(Math.abs(metadata.durationInSeconds - 3.5) < 0.1);
const cancelled = await request("/api/exports", {
  method: "POST",
  body: JSON.stringify({ project: p }),
});
assert.equal(cancelled.status, 202);
assert.equal(
  (await request(`/api/exports/${cancelled.data.id}`, { method: "DELETE" }))
    .data.status,
  "cancelled",
);
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/export-verification.json",
  JSON.stringify(
    { api: "passed", metadata, file: result.url, cancellation: "passed" },
    null,
    2,
  ),
);
console.log("API, upload, export, metadata and cancel: passed.", metadata);
