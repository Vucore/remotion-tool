import { bundle } from "@remotion/bundler";
import {
  access,
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
export async function renderSignature(root) {
  const hash = createHash("sha256").update("khung-render-bundle-1");
  const visit = async (directory) => {
    const entries = await readdir(join(root, directory), {
      withFileTypes: true,
    });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        hash.update(path);
        hash.update(await readFile(join(root, path)));
      }
    }
  };
  await visit("src");
  await visit("public");
  hash.update(await readFile(join(root, "package-lock.json")));
  return hash.digest("hex");
}
export async function renderBundle(
  root,
  onProgress = () => {},
  build = bundle,
) {
  const signature = await renderSignature(root);
  const directory = join(root, ".cache/render-bundles");
  const destination = join(directory, signature);
  try {
    await access(join(destination, ".complete"));
    await access(join(destination, "index.html"));
    return destination;
  } catch {
    /* Compile atomically on cache miss. */
  }
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `${signature}.${randomUUID()}.tmp`);
  try {
    await build({
      entryPoint: join(root, "src/remotion.tsx"),
      publicDir: join(root, "public"),
      outDir: temporary,
      onProgress,
    });
    await writeFile(join(temporary, ".complete"), signature);
    try {
      await rename(temporary, destination);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error;
      await access(join(destination, ".complete"));
    }
    return destination;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
