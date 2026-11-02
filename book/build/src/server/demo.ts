import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { fakeStream, type Turn } from "../testing/fake-model.js";
import { DEPENDENCIES } from "../workflow/index.js";
import type { Scene, Shot } from "../contracts/index.js";

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
  if (versions.length && ["topic", "synopsis"].includes(options.stage)) {
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
  } else if (options.stage === "prompts") {
    const board = options.store.readAdopted(options.projectId, "storyboard");
    const bible = options.store.readAdopted(options.projectId, "bible");
    const read: Turn[] = [{ call: "list_shots", args: {}, text: "只读取镜号清单；外观由程序原样注入，不进入模型上下文。" }];
    if (options.reviseFrom !== undefined) {
      const source = options.store.readVersion(options.projectId, "prompts", options.reviseFrom).items.find(item => item.shot_id === "S02-01");
      if (!source) throw new Error("提示词修改演示需要 S02-01");
      turns = [...read,
        { call: "read_shot", args: { shot_id: source.shot_id } },
        { call: "write_shot_prompt", args: { shot_id: source.shot_id, shot_part: source.shot_part + "动作之后停顿，构图留白，让等待成为画面重心。" }, text: "只重交 S02-01，其余镜头由程序原样沿用。" },
        { call: "finalize_draft", args: {}, text: "程序重新拼装全部镜头，并记录重交与沿用镜号。" },
        { text: "修改后的提示词已待审阅，其他镜头沿用指定原稿。" },
      ];
    } else {
      const outside = bible.characters.find(c => !board.shots[0].character_ids.includes(c.id));
      const drafts: Turn[] = board.shots.flatMap(shot => {
        const part = `${shot.action}构图围绕人物动作展开，保留自然停顿与克制情绪。`;
        return [{ call: "read_shot", args: { shot_id: shot.shot_id }, text: `读取 ${shot.shot_id} 的分镜与名称。` },
          ...(shot === board.shots[0] && outside ? [{ call: "write_shot_prompt", args: { shot_id: shot.shot_id, shot_part: part + `${outside.name}在旁鼓掌。` }, text: "先试交镜头外角色，粗筛会拒绝。" }] : []),
          { call: "write_shot_prompt", args: { shot_id: shot.shot_id, shot_part: part }, text: `提交 ${shot.shot_id} 的镜头部分；只写动作与镜头语言。` }];
      });
      turns = [...read, ...drafts,
        { call: "finalize_draft", args: {}, text: "全部镜头齐备，由程序原样注入固定设定，生成待审阅版本。" },
        { text: "请核对双色提示词卡片，复制完整提示词；采用后六阶段全部完成。" },
      ];
    }
  } else if (options.stage === "storyboard") {
    const bible = options.store.readAdopted(options.projectId, "bible");
    const second = bible.characters.find(c => c.id === "C02")!;
    artifact.shots = artifact.shots.map((shot: Shot) => ({ ...shot,
      action: shot.action.replaceAll("麦冬", second.name),
      ...(shot.dialogue ? { dialogue: shot.dialogue.replaceAll("麦冬", second.name) } : {}),
    }));
    const read: Turn[] = [
      { call: "read_upstream", args: { stage: "script" }, text: "先读取人工采用剧本，按已有场次设计镜头。" },
      { call: "read_upstream", args: { stage: "bible" }, text: "再读取采用设定集，只引用已有编号与来源场。" },
    ];
    if (options.reviseFrom !== undefined) {
      const original = options.store.readVersion(options.projectId, "storyboard", options.reviseFrom);
      const shots = original.shots.filter(shot => shot.scene_id === "S02");
      if (!shots.length) throw new Error("分镜修改演示需要 S02");
      shots[0].camera = "缓慢推近程禾，停在平视近景";
      shots[0].action = "程禾收回伸向计时器的手，静静等待陆岑抬头。";
      shots[0].dialogue = "程禾：那次告别，你愿意讲给我们听吗？";
      turns = [...read,
        { call: "write_scene_shots", args: { scene: { scene_id: "S02", shots } }, text: "只重交 S02 的镜头，其他场由程序原样沿用。" },
        { call: "finalize_draft", args: {}, text: "汇总并记录相对原稿的场次改动。" },
        { text: "分镜第二场已按预设意见修改，请重新审阅。" },
      ];
    } else {
      const first = artifact.shots[0];
      turns = [...read,
        { call: "write_scene_shots", args: { scene: { scene_id: "S01", shots: [{ ...first, prop_ids: ["P99"] }] } }, text: "先试交不存在的道具 P99，引用闸门会拒绝。" },
        { call: "write_scene_shots", args: { scene: { scene_id: "S01", shots: [{ ...first, character_ids: [...first.character_ids, "C03"] }] } }, text: "道具修正后，陆岑 C03 不在第一场，来源闸门仍会拒绝。" },
        ...["S01", "S02", "S03"].map(scene_id => ({ call: "write_scene_shots", args: { scene: { scene_id, shots: artifact.shots.filter((shot: Shot) => shot.scene_id === scene_id) } }, text: `修正引用并提交 ${scene_id} 的全部镜头。` })),
        { call: "finalize_draft", args: {}, text: "各场镜头已齐，程序复核引用与覆盖，汇总待审阅版本。" },
        { text: "分镜已保存，请核对镜头动作、角色与节奏，采用后提示词依赖满足。" },
      ];
    }
  } else if (options.stage === "bible") {
    const script = options.store.readAdopted(options.projectId, "script");
    if (JSON.stringify(script).includes("老站长何望")) {
      Object.assign(artifact.characters[1], {
        name: "何望", aliases: ["老站长何望", "老站长"],
        role: "提出保留空白格的老站长，让志愿者与修表师相遇",
        appearance: "年长男性，灰白短发，穿姜黄色夹克、棕色长裤与黑色布鞋，胸前别着一枚黄铜圆徽章。",
        personality: "沉稳、耐心，愿意替还没开口的人留位置。",
      });
    }
    if (options.reviseFrom !== undefined || versions.length) {
      artifact.characters[0].appearance = artifact.characters[0].appearance.replace("浅灰", "深灰");
    }
    const missing = structuredClone(artifact);
    missing.characters = missing.characters.filter((character: { id: string }) => character.id !== "C03");
    turns = [
      { call: "read_upstream", args: { stage: "script" }, text: "从人工采用剧本抽取角色、道具和场景；固定描述与剧情动作分开。" },
      { call: "write_draft", args: { artifact: missing }, text: "这份草稿漏了有台词的陆岑；覆盖检查会拒绝，不形成版本。" },
      { call: "write_draft", args: { artifact }, text: "补齐陆岑及其来源场，保持其他编号和固定描述。" },
      { text: "覆盖检查与固定描述粗筛已通过，设定集待审阅。请人工核对动作行人物、关键道具及视觉描述，再决定是否采用。" },
    ];
  } else turns = [
    { call: "read_upstream", args: dependency ? { stage: dependency } : {}, text: "这是离线演示。先检查上游，再提交草稿。" },
    { call: "write_draft", args: { artifact: {} } },
    { call: "write_draft", args: { artifact } },
    { text: "已修正字段并保存草稿，请在右侧预览后采用。" },
  ];
  if (options.staging === "resume") {
    const saved = options.store.assertStagingCurrent(options.projectId, options.stage, options.reviseFrom);
    const changes = saved.snapshot.scene_changes ?? saved.snapshot.shot_changes;
    // 修改暂存包含预装原稿，只跳过已重交部分；普通续跑跳过全部已暂存内容。
    const completed = new Set(options.reviseFrom !== undefined ? changes?.resubmitted ?? []
      : saved.snapshot.items?.map(item => item.shot_id) ?? saved.snapshot.scenes?.map(scene => scene.scene_id) ?? []);
    turns = turns.filter(turn => {
      const args = ("args" in turn ? turn.args : undefined) as { scene?: { scene_id: string }; shot_id?: string } | undefined;
      const id = args?.scene?.scene_id ?? args?.shot_id;
      return id === undefined || !completed.has(id);
    });
  }
  const session = await createStageSession({ ...options, model: { provider: "ollama", id: "qwen3.8:27b" } });
  session.agent.streamFunction = fakeStream(session.model!, turns, { delayMs: 700 }).fn;
  return session;
}
