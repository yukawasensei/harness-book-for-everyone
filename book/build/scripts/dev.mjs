import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const children = [
  spawn(process.execPath, ["--import", "tsx", "src/server/main.ts"], { cwd, stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "web/vite.config.ts"], { cwd, stdio: "inherit" }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  // 只向本命令创建的两个子进程转发退出信号。
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, stop);
await Promise.all(children.map(child => new Promise(resolve => {
  child.once("error", error => { console.error(error.message); process.exitCode = 1; stop(); resolve(); });
  child.once("exit", code => { if (!stopping && code) process.exitCode = code; stop(); resolve(); });
})));
