import { resolve } from "node:path";
import { InMemoryCredentialStore, Type } from "@earendil-works/pi-ai";
import {
  createAgentSession, defineTool, DefaultResourceLoader, ModelRuntime,
  SessionManager, SettingsManager, type ExtensionFactory,
} from "@earendil-works/pi-coding-agent";
import { parseStage, schemas, type Stage } from "../contracts/index.js";
import { ProjectStore } from "../project/store.js";
import { assertRunnable, DEPENDENCIES } from "../workflow/index.js";
import { configuredModel } from "./model.js";
import { stagePrompt } from "./prompts.js";

export function createStageTools(store: ProjectStore, projectId: string, stage: Stage) {
  parseStage(stage);
  const dependencies = DEPENDENCIES[stage];
  const readParameters = dependencies.length === 0
    ? Type.Object({}, { additionalProperties: false })
    : Type.Object({ stage: Type.Union(dependencies.map(dependency => Type.Literal(dependency))) }, { additionalProperties: false });
  return [
    defineTool<typeof readParameters, { stage: Stage | null }>({
      name: "read_upstream", label: "读上游 / Read upstream",
      description: `按 stage 读取本阶段依赖的人工采用版本；允许：${dependencies.join(", ") || "无（topic 用空参数返回 null）"}。不接受文件路径或版本号。`,
      parameters: readParameters,
      async execute(_callId, params) {
        const requested = "stage" in params ? params.stage : undefined;
        if (dependencies.length === 0 && requested === undefined) {
          return { content: [{ type: "text", text: "null" }], details: { stage: null } };
        }
        // 在任何存储读取之前复核白名单，直接调用 executor 也不能绕过参数 schema。
        if (typeof requested !== "string" || !(dependencies as readonly string[]).includes(requested)) {
          throw new Error(`${String(requested)} 不是 ${stage} 的依赖阶段，拒绝读取`);
        }
        assertRunnable(store.load(projectId).stages, stage);
        const dependency = parseStage(requested);
        const artifact = store.readAdopted(projectId, dependency);
        return { content: [{ type: "text", text: JSON.stringify(artifact) }], details: { stage: dependency } };
      },
    }),
    defineTool({
      name: "write_draft", label: "写草稿 / Write draft",
      description: `提交本阶段完整 JSON 产物，只保存草稿，不采用。产物契约：${JSON.stringify(schemas[stage])}`,
      // artifact 故意用 Unknown：SDK 不得先转换字段类型。真实契约由存储层严格校验。
      parameters: Type.Object({ artifact: Type.Unknown() }, { additionalProperties: false }),
      async execute(_callId, params) {
        const version = store.writeDraft(projectId, stage, params.artifact);
        return {
          content: [{ type: "text", text: `已保存 ${stage} v${version}；status=pending_review，等待人工采用` }],
          details: { stage, version, status: "pending_review" },
        };
      },
    }),
  ];
}

export interface StageSessionOptions {
  root: string;
  store: ProjectStore;
  projectId: string;
  stage: Stage;
  /** 测试用包内已配置模型描述，再替换 streamFunction；不请求真实模型。 */
  model?: { provider: string; id: string };
}

export async function createStageSession(options: StageSessionOptions) {
  const { root, store, projectId, stage } = options;
  parseStage(stage);
  assertRunnable(store.load(projectId).stages, stage);
  const prompt = stagePrompt(stage);
  const selected = options.model ?? configuredModel(root);
  const agentDir = resolve(root, "pi-agent");
  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: resolve(agentDir, "models.json"),
    modelsStorePath: resolve(agentDir, "models-store.json"),
    refreshOnCreate: false,
  });
  const model = modelRuntime.getModel(selected.provider, selected.id);
  if (!model) throw new Error("模型未在本包 pi-agent/models.json 配置");
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
  const replacePrompt: ExtensionFactory = pi => {
    pi.on("before_agent_start", async () => ({ systemPrompt: prompt }));
  };
  const resourceLoader = new DefaultResourceLoader({
    cwd: root, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    systemPrompt: prompt,
    appendSystemPromptOverride: () => [],
    extensionFactories: [{ name: "stage-system-prompt", factory: replacePrompt }],
  });
  await resourceLoader.reload();
  const tools = createStageTools(store, projectId, stage);
  const { session } = await createAgentSession({
    cwd: root, agentDir, model, modelRuntime, settingsManager, resourceLoader,
    thinkingLevel: "off", noTools: "all",
    tools: tools.map(t => t.name), customTools: tools,
    sessionManager: SessionManager.create(root, store.sessionDir(projectId)),
  });
  return session;
}
