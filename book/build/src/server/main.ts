import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalServer } from "./index.js";
import { createDemoSession } from "./demo.js";

if (process.platform !== "linux") throw new Error("请在 Linux / WSL 中运行");
const demo = process.env.HARNESS_DEMO === "1";
const app = createLocalServer({
  root: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  demo, sessionFactory: demo ? createDemoSession : undefined,
});
await app.listen();
console.log(`本地 API：http://127.0.0.1:3001 · ${demo ? "离线演示（假模型）" : "真实模型（仅在点击运行后请求）"}`);

// Ctrl+C 只关闭本入口拥有的服务、事件连接与运行。
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    void app.close().catch(() => { process.exitCode = 1; });
  });
}
