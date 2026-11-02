import { resolve } from "node:path";
import { InMemoryCredentialStore, Type } from "@earendil-works/pi-ai";
import {
  createAgentSession, defineTool, DefaultResourceLoader, ModelRuntime,
  SessionManager, SettingsManager, type ExtensionFactory, type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { parseStage, schemas, SceneSchema, type Stage } from "../contracts/index.js";
import { ProjectStore } from "../project/store.js";
import { assertRunnable, DEPENDENCIES } from "../workflow/index.js";
import { configuredModel } from "./model.js";
import { stagePrompt } from "./prompts.js";
import { ScriptDraft } from "./script-draft.js";

const scriptDrafts = new WeakMap<AgentSession, ScriptDraft>();
export const sessionScriptDraft = (session: AgentSession) => scriptDrafts.get(session);

export function createStageTools(store: ProjectStore, projectId: string, stage: Stage, draft = new ScriptDraft(store, projectId)) {
  parseStage(stage);
  const dependencies = DEPENDENCIES[stage];
  const readParameters = dependencies.length === 0
    ? Type.Object({}, { additionalProperties: false })
    : Type.Object({ stage: Type.Union(dependencies.map(dependency => Type.Literal(dependency))) }, { additionalProperties: false });
  const readTool =
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
    });
  if (stage === "script") return [readTool,
    defineTool({
      name: "write_scene", label: "提交单场 / Write scene",
      description: `提交一场到本次运行的进行中草稿；同 scene_id 可覆盖。不会生成版本。单场契约：${JSON.stringify(SceneSchema)}`,
      parameters: Type.Object({ scene: Type.Unknown() }, { additionalProperties: false }),
      async execute(_callId, params) {
        const details = draft.write(params.scene);
        return { content: [{ type: "text" as const, text: `已暂存 ${details.scene_id}；共 ${details.scene_count} 场，尚未生成版本。` }], details };
      },
    }),
    defineTool({
      name: "remove_scene", label: "删除单场 / Remove scene",
      description: "按 scene_id 删除本次进行中草稿的一场；删除后请重排后续场号，从 S01 连续，finalize 会复核。不会改动原版本。",
      parameters: Type.Object({ scene_id: Type.String({ pattern: "^S[0-9]{2}$" }) }, { additionalProperties: false }),
      async execute(_callId, params) {
        const details = draft.remove(params.scene_id);
        return { content: [{ type: "text" as const, text: `已从暂存区删除 ${details.scene_id}；请检查并重排后续场号，再 finalize。` }], details };
      },
    }),
    defineTool({
      name: "finalize_draft", label: "汇总剧本 / Finalize draft",
      description: "将本次进行中各场按 scene_id 排序，校验完整剧本后保存为待审阅新版本；不自动采用。无参数。",
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute() {
        const details = draft.finalize();
        const changes = details.scene_changes;
        const parts = [["重交/新增", changes.resubmitted], ["沿用", changes.reused], ["删除", changes.removed]] as const;
        const comparison = changes.revise_from === null ? "" : `本版相对 v${changes.revise_from}：${parts.filter(([, ids]) => ids.length).map(([label, ids]) => `${label} ${ids.join("、")}`).join("；") || "没有场次变动"}。`;
        return { content: [{ type: "text" as const, text: `已保存 script v${details.version}；待审阅。${comparison}${details.warnings.join("\n")}` }], details };
      },
    }),
  ];
  return [readTool, defineTool({
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
  reviseFrom?: number;
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
  const draft = new ScriptDraft(store, projectId);
  const tools = createStageTools(store, projectId, stage, draft);
  const { session } = await createAgentSession({
    cwd: root, agentDir, model, modelRuntime, settingsManager, resourceLoader,
    thinkingLevel: "off", noTools: "all",
    tools: tools.map(t => t.name), customTools: tools,
    sessionManager: SessionManager.create(root, store.sessionDir(projectId)),
  });
  if (stage === "script") scriptDrafts.set(session, draft);
  return session;
}
