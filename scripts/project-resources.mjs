import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const uuid = "[a-f0-9-]{36}";
export function resourcePath(root, ref) {
  if (/^\/media\/[a-zA-Z0-9_-]+\.(png|jpg|webp|wav|mp3)$/.test(ref))
    return join(root, "data/uploads", ref.slice(7));
  if (new RegExp(`^/fonts/${uuid}\\.(woff2?|ttf|otf)$`).test(ref))
    return join(root, "data/fonts", ref.slice(7));
  if (new RegExp(`^/exports/${uuid}\\.(mp4|srt)$`).test(ref))
    return join(root, "data/exports", ref.slice(9));
  if (
    /^\/\.cache\/(tts|images|alignment|translations|proxies)\/[a-f0-9]{64}\.(json|webp)$/.test(
      ref,
    )
  )
    return join(root, ref.slice(1));
}
export function resourceRefs(value, target = new Set()) {
  if (typeof value === "string") {
    if (resourcePath("", value) || /^job:[a-f0-9-]{36}$/.test(value))
      target.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) resourceRefs(item, target);
  } else if (value && typeof value === "object") {
    if (/^[a-f0-9-]{36}$/.test(value.job?.id))
      target.add("job:" + value.job.id);
    for (const [key, item] of Object.entries(value))
      if (key !== "waves" && key !== "envelope") resourceRefs(item, target);
  }
  return target;
}
export const recordRefs = (record) =>
  resourceRefs(record.workspace, resourceRefs(record.resources ?? []));
const jobId = (ref) =>
  ref.match(/^(?:job:|\/exports\/)([a-f0-9-]{36})(?:\.(?:mp4|srt))?$/)?.[1];
async function safeInfo(root, path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink())
      throw Error("Không xóa đường dẫn không phải file thông thường.");
    const actual = await realpath(path),
      base = await realpath(root);
    if (
      !actual.startsWith(resolve(base, "data") + "/") &&
      !actual.startsWith(resolve(base, ".cache") + "/")
    )
      throw Error("File nằm ngoài kho dự án.");
    return info;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Build from every remaining project AND every retained export snapshot. Fail closed on unreadable metadata.
export async function deletionPlan(root, target, others) {
  const candidates = recordRefs(target),
    protectedRefs = new Set();
  for (const other of others)
    for (const ref of recordRefs(other)) protectedRefs.add(ref);
  const targetJobs = new Set([...candidates].map(jobId).filter(Boolean));
  const protectedJobs = new Set([...protectedRefs].map(jobId).filter(Boolean));
  for (const name of await readdir(join(root, "data/jobs")).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })) {
    const id = name.match(/^([a-f0-9-]{36})\.snapshot\.json$/)?.[1];
    if (!id) continue;
    let snapshot;
    try {
      snapshot = JSON.parse(
        await readFile(join(root, "data/jobs", name), "utf8"),
      );
    } catch {
      throw Error(
        "Có lịch sử xuất chưa đọc được. Khôi phục lịch sử đó trước khi xóa để giữ an toàn tài nguyên.",
      );
    }
    if (snapshot.projectId === target.id) targetJobs.add(id);
    // Keep one snapshot in memory at a time, even with a large export history.
    const destination =
      targetJobs.has(id) && !protectedJobs.has(id) ? candidates : protectedRefs;
    resourceRefs(snapshot.project, destination);
    destination.add(`/exports/${id}.mp4`);
    destination.add(`/exports/${id}.srt`);
  }
  const removedJobs = [...targetJobs].filter((id) => !protectedJobs.has(id));
  for (const id of removedJobs) {
    candidates.add(`/exports/${id}.mp4`);
    candidates.add(`/exports/${id}.srt`);
  }
  const files = [],
    shared = [];
  for (const ref of candidates) {
    const path = resourcePath(root, ref);
    if (!path) continue;
    if (protectedRefs.has(ref)) {
      shared.push(ref);
      continue;
    }
    const info = await safeInfo(root, path);
    if (info) files.push({ ref, path, bytes: info.size });
    // Proxy keys depend on the original's size/mtime; collect before removing its source.
    if (info && /^\/media\/.+\.(png|jpg|webp)$/.test(ref)) {
      for (const size of [384, 960, 1440]) {
        const key = createHash("sha256")
          .update(
            JSON.stringify(["proxy-1", ref, info.size, info.mtimeMs, size]),
          )
          .digest("hex");
        const proxyRef = `/.cache/proxies/${key}.webp`,
          proxyPath = resourcePath(root, proxyRef);
        const proxyInfo = await safeInfo(root, proxyPath);
        if (proxyInfo)
          files.push({ ref: proxyRef, path: proxyPath, bytes: proxyInfo.size });
      }
    }
  }
  // Old processing/TTS metadata can be identified safely by the output file it references.
  const removedMedia = new Set(
    files.filter((f) => f.ref.startsWith("/media/")).map((f) => f.ref.slice(7)),
  );
  for (const kind of ["images", "tts"]) {
    for (const name of await readdir(join(root, ".cache", kind)).catch(
      (error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    )) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const ref = `/.cache/${kind}/${name}`;
      if (protectedRefs.has(ref)) continue;
      const path = resourcePath(root, ref);
      let metadata;
      try {
        metadata = JSON.parse(await readFile(path, "utf8"));
      } catch {
        continue;
      }
      if (removedMedia.has(metadata.file)) {
        const info = await safeInfo(root, path);
        if (info) files.push({ ref, path, bytes: info.size });
      }
    }
  }
  for (const id of removedJobs)
    for (const extension of [".json", ".snapshot.json", ".tmp"]) {
      const path = join(root, "data/jobs", id + extension),
        info = await safeInfo(root, path);
      if (info)
        files.push({ path, ref: "job:" + id + extension, bytes: info.size });
    }
  const unique = [...new Map(files.map((file) => [file.path, file])).values()];
  return {
    files: unique,
    shared: shared.length,
    jobs: removedJobs,
    bytes: unique.reduce((sum, file) => sum + file.bytes, 0),
  };
}
export async function removeResources(plan) {
  const failures = [];
  let bytes = 0,
    removed = 0;
  for (const file of plan.files) {
    try {
      await rm(file.path, { force: true });
      bytes += file.bytes;
      removed++;
    } catch {
      failures.push(file.ref);
    }
  }
  return {
    removed,
    bytes,
    shared: plan.shared,
    removedJobs: plan.jobs,
    failures,
  };
}
