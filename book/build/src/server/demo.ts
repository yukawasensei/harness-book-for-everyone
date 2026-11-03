import { boardInput } from "../contracts/board.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { fakeStream, type Turn } from "../testing/fake-model.js";
import type { Scene, BoardShotInput } from "../contracts/index.js";

/** 显式离线演示；真实 SDK、业务工具与存储照常工作，不调用模型供应商。 */
export async function createDemoSession(options: StageSessionOptions) {
  const artifact = JSON.parse(readFileSync(resolve(options.root, `examples/sample-project/${options.stage}.json`), "utf8"));
  const versions = options.store.load(options.projectId).stages[options.stage].versions;
  // 固定修改示例：把孩子换成老站长，不解释任意修改意见。
  if (options.stage === "story" && (options.reviseFrom !== undefined || versions.length)) {
    artifact.logline = "急着填满旧候船亭时刻表的志愿者，与坚持保留空白格的老站长争执后，决定用三分钟听完一位修表师没讲完的告别。";
    artifact.beats = artifact.beats.map((beat: string) => beat.replaceAll("麦冬", "老站长何望"));
  }
  let turns: Turn[];
  if (options.stage === "script") {
    const story = options.store.readAdopted(options.projectId, "story");
    if (story.beats.some(beat => beat.includes("老站长"))) {
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
        { call: "read_upstream", args: { stage: "story" }, text: `我先对照已采用的故事，在第 ${options.reviseFrom} 版剧本上修改第二场。这次演示展示固定的修改示例。` },
        { call: "write_scene", args: { scene: revised }, text: "我来修改第二场，第一场和第三场保留原稿。" },
        { call: "finalize_draft", args: {}, text: "第二场改好了，我把三场合成一份新剧本，方便你对照。" },
        { text: "第二场已改好，其余场保留原稿。请在右侧看一看，满意就采用。" },
      ];
    } else turns = [
      { call: "read_upstream", args: { stage: "story" }, text: "故事已确认，接下来我按起承转合拆出分场剧本，逐场写清场景、人物动作与对白。" },
      { call: "write_scene", args: { scene: { ...artifact.scenes[0], lines: [{ kind: "dialogue", text: "这一格先不填。" }] } }, text: "我先交第一场，检查一下台词是否齐全。" },
      ...artifact.scenes.map((scene: Scene) => ({ call: "write_scene", args: { scene }, text: scene.scene_id === "S01" ? "第 1 场第一次提交时有句对白缺少说话的人，我已补上并重交。" : `接着写第 ${Number(scene.scene_id.slice(1))} 场。` })),
      { call: "finalize_draft", args: {}, text: "各场都写好了，我把它们按顺序合成完整剧本，再检查一遍。" },
      { text: "分场剧本已经全部写完，请在右侧逐场审阅；如果要调整某一场的节奏，可以直接告诉我。" },
    ];
  } else if (options.stage === "board") {
    const bible = options.store.readAdopted(options.projectId, "bible");
    const second = bible.characters.find(c => c.id === "C02")!;
    artifact.shots = boardInput(artifact).shots.map((shot: BoardShotInput) => ({ ...shot,
      shot_part: shot.shot_part.replaceAll("麦冬", second.name),
      action: shot.action.replaceAll("麦冬", second.name),
      ...(shot.dialogue ? { dialogue: shot.dialogue.replaceAll("麦冬", second.name) } : {}),
    }));
    const read: Turn[] = [
      { call: "read_upstream", args: { stage: "script" }, text: "设定集已确认，我现在逐场设计镜头，并为每个镜头拼装画面提示词。" },
      { call: "read_upstream", args: { stage: "bible" }, text: "再对照已采用的设定集，确认各场会出现哪些人物、道具和地点。" },
    ];
    if (options.reviseFrom !== undefined) {
      const original = options.store.readVersion(options.projectId, "board", options.reviseFrom);
      const shots = boardInput(original).shots.filter(shot => shot.scene_id === "S02");
      if (!shots.length) throw new Error("分镜修改演示需要 S02");
      shots[0].camera = "缓慢推近程禾，停在平视近景";
      shots[0].action = "程禾收回伸向计时器的手，静静等待陆岑抬头。";
      shots[0].shot_part += "动作之后停顿，构图留白，让等待成为画面重心。";
      shots[0].dialogue = "程禾：那次告别，你愿意讲给我们听吗？";
      turns = [...read,
        { call: "write_scene_shots", args: { scene: { scene_id: "S02", shots } }, text: "这次演示会修改第二场的镜头，其他场保留原稿。" },
        { call: "finalize_draft", args: {}, text: "第二场的镜头改好了，我把各场整理到一起，方便你对照。" },
        { text: "第二场的分镜改好了，请在右侧看一看，满意就采用。" },
      ];
    } else {
      const first = artifact.shots[0];
      turns = [...read,
        { call: "write_scene_shots", args: { scene: { scene_id: "S01", shots: [{ ...first, prop_ids: ["P99"] }] } }, text: "我先交第一场的镜头，检查一下人物和道具是否对得上。" },
        { call: "write_scene_shots", args: { scene: { scene_id: "S01", shots: [{ ...first, character_ids: [...first.character_ids, "C03"] }] } }, text: "刚才写了一个设定集里没有的道具，被检查拦下了。我改好道具后再提交。" },
        { call: "write_scene_shots", args: { scene: { scene_id: "S01", shots: [{ ...first, shot_part: first.shot_part + "陆岑在旁鼓掌。" }] } }, text: "刚才有镜头引用了未在当前场次出场的角色，我已核对剧本出场范围并修正了镜头引用。" },
        ...["S01", "S02", "S03"].map(scene_id => ({ call: "write_scene_shots", args: { scene: { scene_id, shots: artifact.shots.filter((shot: BoardShotInput) => shot.scene_id === scene_id) } }, text: scene_id === "S01" ? "刚才的镜头描写仍提到了本镜未引用的陆岑，我已去掉这段描写并重新提交。" : `接着写第 ${Number(scene_id.slice(1))} 场的镜头。` })),
        { call: "finalize_draft", args: {}, text: "各场的镜头都写好了，我再检查一遍人物、道具和场次是否齐全，整理成完整分镜。" },
        { text: "分镜板已制作完成，每个镜头的画面提示词都已拼入设定集外观，请在右侧审阅并采用。" },
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
      { call: "read_upstream", args: { stage: "script" }, text: "剧本已定稿，我现在清点剧本里出场的所有角色、场景和关键道具，整理成固定外观档案。" },
      { call: "write_draft", args: { artifact: missing }, text: "我先交一版设定集，检查一下剧本里的人物是否都写全了。" },
      { call: "write_draft", args: { artifact }, text: "首次提交漏掉了剧本第 2 场出现的角色陆岑，我已经按出场清单补齐固定外观描述并重交。" },
      { text: "设定集整理好了，请核对每个角色和场景的外观描述；采用后这些描述将原样带入每个镜头的提示词。" },
    ];
  } else turns = [
    { call: "read_upstream", args: {}, text: "我先根据你的想法整理故事框架，确定片名、核心冲突和四幕脉络。" },
    { call: "write_draft", args: { artifact: {} }, text: "我先交一版草稿，检查一下内容是否齐全。" },
    { call: "write_draft", args: { artifact }, text: "刚才提交的是空草稿，漏了片名、核心冲突和四幕脉络，我已经补齐并重新提交。" },
    { text: `故事草稿写好了，请在右侧查看片名和故事脉络，确认无误后我们开始写分场剧本。` },
  ];
  if (options.staging === "resume") {
    const saved = options.store.assertStagingCurrent(options.projectId, options.stage, options.reviseFrom);
    const changes = saved.snapshot.scene_changes;
    // 修改暂存包含预装原稿，只跳过已重交部分；普通续跑跳过全部已暂存内容。
    const completed = new Set(options.reviseFrom !== undefined ? changes?.resubmitted ?? []
      : saved.snapshot.scenes?.map(scene => scene.scene_id) ?? []);
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
