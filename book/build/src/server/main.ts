import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalServer } from "./index.js";
import { hostingFromEnv } from "./hosting.js";
import { createDemoSession } from "./demo.js";

if (process.platform !== "linux") throw new Error("请在 Linux / WSL 中运行");
const hosting = hostingFromEnv();
const demo = process.env.HARNESS_DEMO === "1";
const app = createLocalServer({
  root: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  hosting, demo, sessionFactory: demo ? createDemoSession : undefined,
});
const address = await app.listen();
if (hosting.mode === "hosted") console.log("托管模式：需置于 HTTPS 反向代理之后；静态站点只提供 web/dist，不公开项目存储");
console.log(`API：${address} · ${demo ? "离线演示（假模型）" : "真实模型（仅在点击运行后请求）"}`);

// Ctrl+C 只关闭本入口拥有的服务、事件连接与运行。
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    void app.close().catch(() => { process.exitCode = 1; });
  });
}
