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
        { call: "read_upstream", args: { stage: "synopsis" }, text: `我先对照已采用的梗概，在第 ${options.reviseFrom} 版剧本上修改第二场。这次演示展示固定的修改示例。` },
        { call: "write_scene", args: { scene: revised }, text: "我来修改第二场，第一场和第三场保留原稿。" },
        { call: "finalize_draft", args: {}, text: "第二场改好了，我把三场合成一份新剧本，方便你对照。" },
        { text: "第二场已改好，其余场保留原稿。请在右侧看一看，满意就采用。" },
      ];
    } else turns = [
      { call: "read_upstream", args: { stage: "synopsis" }, text: "我先看一遍你已采用的梗概，接着一场一场写剧本。" },
      { call: "write_scene", args: { scene: { ...artifact.scenes[0], lines: [{ kind: "dialogue", text: "这一格先不填。" }] } }, text: "我先交第一场，检查一下台词是否齐全。" },
      ...artifact.scenes.map((scene: Scene) => ({ call: "write_scene", args: { scene }, text: scene.scene_id === "S01" ? "刚才有句台词漏写了说话的人，被检查拦下了。我补上后重新提交第一场。" : `接着写第 ${Number(scene.scene_id.slice(1))} 场。` })),
      { call: "finalize_draft", args: {}, text: "各场都写好了，我把它们按顺序合成完整剧本，再检查一遍。" },
      { text: "剧本写好了，请在右侧看一看。梗概的四个故事转折写成了三场，请确认转折是否讲清楚，满意就采用。" },
    ];
  } else if (options.stage === "prompts") {
    const board = options.store.readAdopted(options.projectId, "storyboard");
    const bible = options.store.readAdopted(options.projectId, "bible");
    const read: Turn[] = [{ call: "list_shots", args: {}, text: "我先看一下有哪些镜头，再逐个写提示词。角色外观等已确认的设定会自动带入。" }];
    if (options.reviseFrom !== undefined) {
      const source = options.store.readVersion(options.projectId, "prompts", options.reviseFrom).items.find(item => item.shot_id === "S02-01");
      if (!source) throw new Error("提示词修改演示需要 S02-01");
      turns = [...read,
        { call: "read_shot", args: { shot_id: source.shot_id } },
        { call: "write_shot_prompt", args: { shot_id: source.shot_id, shot_part: source.shot_part + "动作之后停顿，构图留白，让等待成为画面重心。" }, text: "我来修改第二场第一个镜头的提示词，其余镜头保留原稿。" },
        { call: "finalize_draft", args: {}, text: "这条提示词改好了，接着加上已确认的设定，整理成完整的新版本。" },
        { text: "第二场第一个镜头的提示词改好了，其余镜头保留原稿。请在右侧看一看，满意就采用。" },
      ];
    } else {
      const outside = bible.characters.find(c => !board.shots[0].character_ids.includes(c.id));
      const drafts: Turn[] = board.shots.flatMap(shot => {
        const part = `${shot.action}构图围绕人物动作展开，保留自然停顿与克制情绪。`;
        return [{ call: "read_shot", args: { shot_id: shot.shot_id }, text: `我先看镜头 ${shot.shot_id} 里的人物和动作。` },
          ...(shot === board.shots[0] && outside ? [{ call: "write_shot_prompt", args: { shot_id: shot.shot_id, shot_part: part + `${outside.name}在旁鼓掌。` }, text: "先交第一条提示词，检查一下是否符合分镜。" }] : []),
          { call: "write_shot_prompt", args: { shot_id: shot.shot_id, shot_part: part }, text: shot === board.shots[0] && outside ? "刚才多写了一个不在这个镜头里的人，被检查拦下了。我去掉后重新提交。" : `我来写镜头 ${shot.shot_id} 的动作、构图和拍摄方式。` }];
      });
      turns = [...read, ...drafts,
        { call: "finalize_draft", args: {}, text: "每个镜头的提示词都写好了，接着加上已确认的设定，整理成完整版本。" },
        { text: "提示词写好了，请在右侧逐条看一看，满意就采用，六个阶段就全部完成了。每条完整提示词都可以复制使用。" },
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
      { call: "read_upstream", args: { stage: "script" }, text: "我先看一遍你已采用的剧本，按每一场的内容设计镜头。" },
      { call: "read_upstream", args: { stage: "bible" }, text: "再对照已采用的设定集，确认各场会出现哪些人物、道具和地点。" },
    ];
    if (options.reviseFrom !== undefined) {
      const original = options.store.readVersion(options.projectId, "storyboard", options.reviseFrom);
      const shots = original.shots.filter(shot => shot.scene_id === "S02");
      if (!shots.length) throw new Error("分镜修改演示需要 S02");
      shots[0].camera = "缓慢推近程禾，停在平视近景";
      shots[0].action = "程禾收回伸向计时器的手，静静等待陆岑抬头。";
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
        ...["S01", "S02", "S03"].map(scene_id => ({ call: "write_scene_shots", args: { scene: { scene_id, shots: artifact.shots.filter((shot: Shot) => shot.scene_id === scene_id) } }, text: scene_id === "S01" ? "检查又发现陆岑不该出现在第一场。我去掉他后，重新提交这一场的镜头。" : `接着写第 ${Number(scene_id.slice(1))} 场的镜头。` })),
        { call: "finalize_draft", args: {}, text: "各场的镜头都写好了，我再检查一遍人物、道具和场次是否齐全，整理成完整分镜。" },
        { text: "分镜写好了，请在右侧看看人物、动作和节奏是否合适。满意就采用，接下来就能写提示词了。" },
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
      { call: "read_upstream", args: { stage: "script" }, text: "我先看一遍你已采用的剧本，整理人物、道具和地点，让后面的画面保持一致。" },
      { call: "write_draft", args: { artifact: missing }, text: "我先交一版设定集，检查一下剧本里的人物是否都写全了。" },
      { call: "write_draft", args: { artifact }, text: "刚才漏了有台词的陆岑，被检查拦下了。我补上他的设定和出场场次后重新提交。" },
      { text: "设定集写好了，已通过检查。请在右侧看看人物有没有遗漏、关键道具是否齐全、外观描述是否合适，满意就采用。" },
    ];
  } else turns = [
    { call: "read_upstream", args: dependency ? { stage: dependency } : {}, text: dependency ? "我先看一遍你已采用的选题，接着写梗概。" : "我先整理你的想法，接着写选题。" },
    { call: "write_draft", args: { artifact: {} }, text: "我先交一版草稿，检查一下内容是否齐全。" },
    { call: "write_draft", args: { artifact }, text: "第一次提交漏了必填内容，被检查拦下了。我补上后重新提交。" },
    { text: `${options.stage === "topic" ? "选题" : "梗概"}写好了，请在右侧看一看，满意就采用。` },
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
