import { buildApp } from "./build.mjs";
await buildApp(true);
await import("./server.mjs");
