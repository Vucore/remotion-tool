import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, realpath, unlink, rmdir } from "node:fs/promises";
import { join, resolve, extname, relative } from "node:path";

const cacheKinds = {
  proxies: [
    "Ảnh xem trước",
    "Ảnh WebP nhỏ giúp preview và thumbnail tải nhanh.",
    "Ảnh gốc được giữ. Ảnh xem trước sẽ được tạo lại khi cần.",
  ],
  "render-bundles": [
    "Bộ dựng video",
    "Mã Remotion đã biên dịch để xuất nhanh hơn.",
    "Lần xuất tiếp theo sẽ biên dịch lại; các MP4 đã xuất được giữ.",
  ],
  tts: [
    "Cache giọng đọc",
    "Chỉ mục tái sử dụng các đoạn TTS đã tạo.",
    "Voice đã ghép được giữ. Những lần tạo sau có thể phải gọi API lại.",
  ],
  alignment: [
    "Cache căn phụ đề",
    "Mốc thời gian câu đã căn bằng Whisper.",
    "Phụ đề trong dự án được giữ. Căn lại có thể chạy model lại.",
  ],
  translations: [
    "Cache dịch phụ đề",
    "Các câu đã dịch, dùng lại để giảm request.",
    "Các file SRT đã tải được giữ. Dịch lại có thể gửi request mới.",
  ],
  images: [
    "Cache xử lý ảnh",
    "Chỉ mục ảnh đã xóa logo hoặc upscale.",
    "Ảnh đang dùng được giữ. Lần xử lý sau có thể chạy model lại.",
  ],
  whisper: [
    "Model Whisper",
    "Trọng số model căn phụ đề đã tải về máy.",
    "Muốn căn phụ đề lần sau cần tải lại model; timing đã lưu vẫn được giữ.",
    "model",
  ],
  models: [
    "Model xử lý ảnh",
    "LaMa xóa logo và Real-ESRGAN phóng lớn ảnh.",
    "Cần tải hoặc đặt lại model trước khi xóa logo/upscale lần sau.",
    "model",
  ],
};
const tools = new Set([
  ".DS_Store",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "__pycache__",
]);
const protectedNames = {
  ".git": "Lịch sử commit và nhánh Git. Quản lý bằng Git, không xóa trong app.",
  ".venv": "Môi trường uv dùng chung cho Python, Whisper, dịch và xử lý ảnh.",
  ".impeccable": "Dữ liệu của công cụ thiết kế; không phải cache video.",
};
const uuid = "[a-f0-9-]{36}";
const exportFile = new RegExp(
  `^data/(?:exports/${uuid}\\.(?:mp4|srt|mp4\\.partial\\.mp4)|jobs/${uuid}\\.(?:json|snapshot\\.json|tmp))$`,
);
const cacheRef = (id) =>
  id.startsWith("cache:") && id !== "cache:files"
    ? `/.cache/${id.slice(6)}/`
    : null;
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};

async function safePath(root, path) {
  const base = await realpath(root),
    absolute = resolve(root, path);
  if (!absolute.startsWith(resolve(root) + "/"))
    fail("Đường dẫn nằm ngoài dự án.");
  let current = resolve(root);
  for (const part of relative(root, absolute).split("/")) {
    current = join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) fail("Không dọn đường dẫn symlink.");
  }
  const actual = await realpath(absolute);
  if (!actual.startsWith(base + "/")) fail("Đường dẫn nằm ngoài dự án.");
  return absolute;
}

async function walk(root, path, directOnly = false) {
  const files = [],
    directories = [],
    types = new Map();
  let skipped = 0,
    directoryBytes = 0,
    error = "";
  const visit = async (name, top = false) => {
    let info;
    try {
      info = await lstat(join(root, name));
    } catch (cause) {
      if (cause.code === "ENOENT") return;
      throw cause;
    }
    if (info.isSymbolicLink()) {
      skipped++;
      return;
    }
    if (info.isDirectory()) {
      if (directOnly && !top) return;
      directories.push(name);
      directoryBytes += Number.isFinite(info.blocks) ? info.blocks * 512 : 0;
      for (const entry of (await readdir(join(root, name))).sort())
        await visit(join(name, entry));
    } else if (info.isFile()) {
      files.push({
        path: name,
        size: info.size,
        disk: Number.isFinite(info.blocks) ? info.blocks * 512 : info.size,
        mtime: info.mtimeMs,
        ino: info.ino,
        dev: info.dev,
      });
      const type = extname(name).slice(1).toLowerCase() || "khác";
      types.set(type, (types.get(type) ?? 0) + 1);
    }
  };
  try {
    // Inspect every parent before walking; nested symlinks are skipped during traversal.
    await safePath(root, path);
    await visit(path, true);
  } catch (cause) {
    if (cause.code !== "ENOENT") error = cause.message;
  }
  return {
    files,
    directories,
    directoryBytes,
    skipped,
    error,
    types: [...types]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `${count} ${type.toUpperCase()}`),
  };
}

async function definitions(root) {
  const result = [];
  const children = await readdir(join(root, ".cache"), {
    withFileTypes: true,
  }).catch((e) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  for (const name of new Set([
    ...Object.keys(cacheKinds),
    ...children
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name),
  ])) {
    const known = Object.hasOwn(cacheKinds, name) ? cacheKinds[name] : null;
    result.push({
      id: "cache:" + name,
      paths: [".cache/" + name],
      category: known?.[3] === "model" ? "models" : "cache",
      title: known?.[0] ?? name,
      description:
        known?.[1] ?? "Thư mục trong .cache chưa được app nhận diện.",
      effect:
        known?.[2] ?? "Chỉ xem dung lượng để tránh xóa dữ liệu không rõ nguồn.",
      deletable: !!known,
    });
  }
  result.push({
    id: "cache:files",
    paths: [".cache"],
    directOnly: true,
    category: "cache",
    title: "Tệp cache khác",
    description: "Các tệp nằm trực tiếp trong .cache, không gồm thư mục con.",
    effect: "Chỉ dọn tệp phụ trợ nằm trực tiếp trong .cache.",
    deletable: true,
  });
  result.push({
    id: "exports",
    paths: ["data/exports", "data/jobs"],
    category: "exports",
    title: "Toàn bộ bản xuất",
    description: "MP4, SRT và snapshot/lịch sử xuất do app quản lý.",
    effect:
      "Xóa toàn bộ bản xuất và liên kết trong các dự án. Ảnh, voice và dự án nguồn được giữ.",
    deletable: true,
  });
  for (const entry of (await readdir(root, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (
      (!entry.name.startsWith(".") && !tools.has(entry.name)) ||
      entry.name === ".cache"
    )
      continue;
    const known = tools.has(entry.name);
    result.push({
      id: "hidden:" + entry.name,
      paths: [entry.name],
      category: "system",
      title: entry.name,
      description:
        protectedNames[entry.name] ??
        (entry.name === ".DS_Store"
          ? "Tệp ghi nhớ bố cục thư mục của macOS."
          : known
            ? "Cache/bytecode của công cụ Python."
            : "Tệp hoặc thư mục cấu hình của dự án."),
      effect: known
        ? "Có thể được công cụ tạo lại khi dùng."
        : "Chỉ xem; quản lý ngoài app nếu cần.",
      deletable: known,
    });
  }
  return result;
}

export class StorageManager {
  plans = new Map();
  constructor(root) {
    this.root = root;
  }
  async inspect(definition, countedFiles = new Set()) {
    const scans = [];
    for (const path of definition.paths)
      scans.push(await walk(this.root, path, definition.directOnly));
    const files = scans.flatMap((s) => s.files),
      errors = scans.map((s) => s.error).filter(Boolean);
    const selected =
      definition.id === "exports"
        ? files.filter((file) => exportFile.test(file.path))
        : files;
    const diskBytes = files.reduce((sum, file) => {
      // Multiple hardlinks refer to the same allocated blocks on disk.
      const key = `${file.dev}:${file.ino}`;
      if (countedFiles.has(key)) return sum;
      countedFiles.add(key);
      return sum + file.disk;
    }, 0);
    const revision = createHash("sha256")
      .update(
        JSON.stringify(
          files.map((f) => [f.path, f.size, f.mtime, f.ino, f.dev]),
        ),
      )
      .digest("hex");
    const group = {
      id: definition.id,
      path: definition.paths.join(" + "),
      category: definition.category,
      title: definition.title,
      description: definition.description,
      effect: definition.effect,
      bytes: files.reduce((s, f) => s + f.size, 0),
      diskBytes:
        diskBytes +
        scans.reduce((s, scan) => s + scan.directoryBytes, 0),
      files: files.length,
      deletableFiles: selected.length,
      directories: scans.reduce((s, item) => s + item.directories.length, 0),
      skipped: scans.reduce((s, item) => s + item.skipped, 0),
      incomplete: errors.length > 0,
      contents: [...new Set(scans.flatMap((s) => s.types))],
      canDelete: definition.deletable && !errors.length && selected.length > 0,
      reason:
        errors.join("; ") ||
        (!definition.deletable
          ? "Chỉ xem"
          : !selected.length
            ? "Không có dữ liệu để dọn"
            : ""),
      revision,
    };
    return {
      group,
      files: selected,
      directories: scans.flatMap((s) => s.directories),
    };
  }
  async inventory() {
    const groups = [], countedFiles = new Set();
    for (const item of await definitions(this.root))
      groups.push((await this.inspect(item, countedFiles)).group);
    const cacheGroups = groups.filter((group) => group.id.startsWith("cache:"));
    return {
      groups,
      root: await realpath(this.root),
      cache: {
        bytes: cacheGroups.reduce((sum, group) => sum + group.bytes, 0),
        diskBytes: cacheGroups.reduce((sum, group) => sum + group.diskBytes, 0),
        files: cacheGroups.reduce((sum, group) => sum + group.files, 0),
        incomplete: cacheGroups.some((group) => group.incomplete),
        skipped: cacheGroups.reduce((sum, group) => sum + group.skipped, 0),
      },
      scannedAt: new Date().toISOString(),
      totalBytes: groups.reduce((sum, g) => sum + g.diskBytes, 0),
    };
  }
  async prepare(id, revision) {
    const definition = (await definitions(this.root)).find(
      (item) => item.id === id,
    );
    if (!definition?.deletable) fail("Nhóm này chỉ được xem dung lượng.");
    const plan = await this.inspect(definition);
    if (plan.group.revision !== revision)
      fail("Dung lượng đã thay đổi. Kiểm tra lại trước khi xóa.", 409);
    if (!plan.group.canDelete)
      fail(plan.group.reason || "Không thể dọn nhóm này.");
    const token = randomUUID();
    for (const [key, value] of this.plans)
      if (Date.now() - value.created > 120000) this.plans.delete(key);
    this.plans.set(token, { ...plan, id, created: Date.now() });
    const exportIds =
      id === "exports"
        ? [
            ...new Set(
              plan.files
                .map((f) => f.path.match(new RegExp(`${uuid}`))?.[0])
                .filter(Boolean),
            ),
          ]
        : [];
    return {
      token,
      exportIds,
      fileCount: plan.files.length,
      bytes: plan.files.reduce((sum, file) => sum + file.disk, 0),
      cachePrefixes: cacheRef(id) ? [cacheRef(id)] : [],
    };
  }
  async clear(token) {
    const plan = this.plans.get(token);
    this.plans.delete(token);
    if (!plan || Date.now() - plan.created > 120000)
      fail("Xác nhận dọn dẹp đã hết hạn. Kiểm tra lại.", 409);
    const check = async (file) => {
      let absolute;
      try {
        absolute = await safePath(this.root, file.path);
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
      const info = await lstat(absolute);
      if (
        !info.isFile() ||
        info.ino !== file.ino ||
        info.dev !== file.dev ||
        info.size !== file.size ||
        info.mtimeMs !== file.mtime
      )
        fail("Có tệp thay đổi trong lúc dọn. Kiểm tra lại.", 409);
      return absolute;
    };
    for (const file of plan.files) await check(file);
    let removed = 0,
      bytes = 0;
    const failures = [];
    for (const file of plan.files) {
      try {
        const path = await check(file);
        if (path) {
          await unlink(path);
          removed++;
          bytes += file.disk;
        }
      } catch (error) {
        failures.push(`${file.path}: ${error.message}`);
      }
    }
    // Only remove empty descendants. New files and all group roots are preserved.
    for (const path of [...plan.directories].sort(
      (a, b) => b.length - a.length,
    )) {
      if (
        path === ".cache" ||
        path === "data/exports" ||
        path === "data/jobs" ||
        path.split("/").length < 3
      )
        continue;
      try {
        await rmdir(await safePath(this.root, path));
      } catch {
        /* Non-empty, changed or already removed. */
      }
    }
    return { removed, bytes, failures };
  }
}
