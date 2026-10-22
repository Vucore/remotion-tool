import { build, context } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function buildApp(watch = false) {
  await mkdir("dist", { recursive: true });
  const config = {
    entryPoints: ["src/main.tsx"],
    bundle: true,
    outfile: "dist/app.js",
    format: "esm",
    target: "es2022",
    jsx: "automatic",
    sourcemap: true,
    minify: !watch,
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        watch ? "development" : "production",
      ),
    },
    logLevel: "warning",
  };
  await build({
    entryPoints: {
      model: "src/model.ts",
      animation: "src/animation.ts",
      effects: "src/effects/runtime.ts",
      catalog: "src/catalog.ts",
      auto: "src/auto/compile.ts",
      "auto-config": "src/auto/config.ts",
      narration: "src/auto/narration.ts",
      actors: "src/actors/import.ts",
      "actor-model": "src/actors/schema.ts",
      "actor-types": "src/actors/types.ts",
    },
    bundle: true,
    outdir: "dist",
    outExtension: { ".js": ".mjs" },
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    logLevel: "warning",
  });
  if (watch) {
    const ctx = await context(config);
    await ctx.watch();
    return ctx;
  }
  await build(config);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildApp();
  console.log("Đã build Khung vào dist/.");
}
