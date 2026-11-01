// Ch3 · 隔离本机 pi 全局配置 / Isolate from the machine's global ~/.pi
// 读者机器上的 ~/.pi/agent 可能装了扩展、技能、全局 AGENTS.md、别的模型和凭据。
// 书里的 harness 只认仓库里的 pi-agent/ 目录，保证“同一份代码，同一份 trace”。
import { resolve } from "node:path";
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { DefaultResourceLoader, ModelRuntime, SettingsManager } from "@earendil-works/pi-coding-agent";

/** pi 会默认读取的全局资源，这里全部关掉。 */
export const ISOLATION_FLAGS = {
  noExtensions: true, // ~/.pi/agent/extensions/、settings.json 里的 npm 扩展
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true, // ~/.pi/agent/AGENTS.md 以及沿目录向上找到的 AGENTS.md
} as const;

export async function createIsolatedPi(harnessRoot: string) {
  const agentDir = resolve(harnessRoot, "pi-agent");
  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(), // 不读 ~/.pi/agent/auth.json
    modelsPath: resolve(agentDir, "models.json"), // 只认仓库里的模型清单
    modelsStorePath: resolve(agentDir, "models-store.json"),
    refreshOnCreate: false, // 不联网刷新模型目录
  });
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
  const resourceLoader = new DefaultResourceLoader({
    cwd: harnessRoot,
    agentDir,
    settingsManager,
    ...ISOLATION_FLAGS,
  });
  await resourceLoader.reload();
  return { agentDir, modelRuntime, settingsManager, resourceLoader };
}
