import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { fakeStream, type Turn } from "../testing/fake-model.js";
import { DEPENDENCIES } from "../workflow/index.js";
import type { Scene } from "../contracts/index.js";

/** 显式离线演示；真实 SDK、业务工具与存储照常工作，不调用模型供应商。 */
export async function createDemoSession(options: StageSessionOptions) {
  const artifact = JSON.parse(readFileSync(resolve(options.root, `examples/sample-project/${options.stage}.json`), "utf8"));
  const versions = options.store.load(options.projectId).stages[options.stage].versions;
  // 固定修改示例：把孩子换成老站长，不解释任意修改意见。
  if (options.stage === "synopsis") {
    const topic = options.store.readAdopted(options.projectId, "topic");
    artifact.title = topic.title;
    artifact.logline = topic.logline;
    if (topic.logline.includes("老站长") || versions.length) {
      artifact.beats = artifact.beats.map((beat: string) => beat.replaceAll("麦冬", "老站长何望"));
    }
  }
  if (versions.length && options.stage !== "script") {
    artifact.logline = "急着填满旧候船亭时刻表的志愿者，与坚持保留空白格的老站长争执后，决定用三分钟听完一位修表师没讲完的告别。";
  }
  const dependency = DEPENDENCIES[options.stage][0];
  let turns: Turn[];
  if (options.stage === "script") {
    const synopsis = options.store.readAdopted(options.projectId, "synopsis");
    if (synopsis.beats.some(beat => beat.includes("老站长"))) {
      for (const scene of artifact.scenes) {
        scene.summary = scene.summary.replaceAll("麦冬", "老站长何望");
        for (const line of scene.lines) {
          line.text = line.text.replaceAll("麦冬", "老站长何望");
          if (line.character === "麦冬") line.character = "老站长何望";
        }
      }
    }
    if (options.reviseFrom !== undefined) {
      const original = options.store.readVersion(options.projectId, "script", options.reviseFrom);
      const source = original.scenes.find(scene => scene.scene_id === "S02");
      if (!source) throw new Error("剧本修改演示需要原稿含 S02；演示只展示第二场的固定修改");
      const revised: Scene = {
        ...source,
        summary: "程禾先征求陆岑的讲述意愿，再把等待变成主动的选择。",
        lines: [
          { kind: "action", text: "陆岑旋紧计时器的发条。程禾将手从计时器旁移开，等他抬起头。" },
          { kind: "dialogue", character: "程禾", text: "那次没说完的告别，你愿意讲给我们听吗？不愿意也没关系。" },
          { kind: "dialogue", character: "陆岑", text: "让我想一想。等指针再走一格，我就开口。" },
          { kind: "action", text: "程禾点头，把椅子挪到工作台旁，静静坐下。" },
        ],
      };
      turns = [
        { call: "read_upstream", args: { stage: "synopsis" }, text: `采用梗概不变，程序已预装 v${options.reviseFrom}。离线演示只修改 S02。` },
        { call: "write_scene", args: { scene: revised }, text: "只重交第二场；S01、S03 由程序原样沿用。" },
        { call: "finalize_draft", args: {}, text: "汇总新版本，并列出本次改动与沿用的场号。" },
        { text: "S02 已按预设意见修改，其余场沿用原稿，请重新审阅。" },
      ];
    } else turns = [
      { call: "read_upstream", args: { stage: "synopsis" }, text: "这是离线演示。先读采用梗概，再逐场提交；全部通过后汇总剧本。" },
      { call: "write_scene", args: { scene: { ...artifact.scenes[0], lines: [{ kind: "dialogue", text: "这一格先不填。" }] } }, text: "先提交第一场；这次台词漏了角色，校验会拒绝。" },
      ...artifact.scenes.map((scene: Scene) => ({ call: "write_scene", args: { scene }, text: scene.scene_id === "S01" ? "补齐台词角色后重交第一场。每场仅暂存，不产生版本。" : `继续提交 ${scene.scene_id}。` })),
      { call: "finalize_draft", args: {}, text: "各场已交齐，交给程序排序并校验完整剧本。" },
      { text: "剧本已保存为待审阅版本。场数与四个叙事拍不同是提醒，请人工检查故事转折后再决定是否采用。" },
    ];
  } else turns = [
    { call: "read_upstream", args: dependency ? { stage: dependency } : {}, text: "这是离线演示。先检查上游，再提交草稿。" },
    { call: "write_draft", args: { artifact: {} } },
    { call: "write_draft", args: { artifact } },
    { text: "已修正字段并保存草稿，请在右侧预览后采用。" },
  ];
  const session = await createStageSession({ ...options, model: { provider: "ollama", id: "qwen3.8:27b" } });
  session.agent.streamFunction = fakeStream(session.model!, turns, { delayMs: 700 }).fn;
  return session;
}
