import { readFileSync } from "node:fs";
import { shotContext, shotList } from "../src/contracts/prompts.js";
import type { Artifacts } from "../src/contracts/index.js";

const load = (name: string) => JSON.parse(readFileSync(new URL(`../examples/sample-project/${name}.json`, import.meta.url), "utf8"));
const bible: Artifacts["bible"] = load("bible"), board: Artifacts["storyboard"] = load("storyboard");
const count = (value: unknown) => Array.from(JSON.stringify(value)).length;
const measurement = (chars: number) => ({ chars, estimated_tokens: Math.ceil(chars / 2) });
console.log(JSON.stringify({
  method: "Unicode 码点数；估算 token = ceil(字符数 / 2)，不是供应商 tokenizer 实测。不含工具定义、系统提示、工具调用、模型输出与逐轮累计输入。",
  full_upstream_once: measurement(count(bible) + count(board)),
  list_and_all_shots_once: measurement(count(shotList(board)) + board.shots.reduce((sum, shot) => sum + count(shotContext(shot, bible)), 0)),
  per_shot: board.shots.map(shot => ({ shot_id: shot.shot_id,
    full_bible_and_shot: measurement(count({ ...shot, bible })),
    read_shot: measurement(count(shotContext(shot, bible))),
  })),
}, null, 2));
