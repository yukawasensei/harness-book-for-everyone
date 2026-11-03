import { readFileSync } from 'node:fs';
import { boardInput, validateBoard } from '../src/contracts/board.js';
import { validateArtifact, type Artifacts } from '../src/contracts/index.js';
import { PIPELINE_VERSION } from '../src/eval/report.js';

const load = <S extends keyof Artifacts>(stage: S): Artifacts[S] => {
  const value: unknown = JSON.parse(readFileSync(new URL(`../examples/sample-project/${stage}.json`, import.meta.url), 'utf8'));
  validateArtifact(stage, value);
  return value;
};
const story = load('story'), script = load('script'), bible = load('bible'), board = load('board');
validateBoard(board, script, bible);
const input = boardInput(board);
const measure = (value: unknown) => {
  const chars = Array.from(JSON.stringify(value)).length;
  return { chars, estimated_tokens: Math.ceil(chars / 2) };
};

console.log(JSON.stringify({
  pipeline_version: PIPELINE_VERSION,
  method: '紧凑 JSON 的 Unicode 码点数；估算 token = ceil(字符数 / 2)，不是 tokenizer 实测或账单。不含工具定义、系统提示、调用封装、模型输出和逐轮累计输入。',
  context_notes: 'board 的 read_upstream 可读取完整 story/script/bible，固定描述会进入模型上下文。修改/续跑只传镜头输入，程序保存派生字段；逐场重交减少提交范围，不等于总输入或费用按比例下降。',
  upstream_once: measure({ story, script, bible }),
  revision_model_input_once: measure(input),
  stored_board_once: measure(board),
  per_scene_submission: script.scenes.map(scene => ({
    scene_id: scene.scene_id,
    model_input: measure({ scene_id: scene.scene_id, shots: input.shots.filter(shot => shot.scene_id === scene.scene_id) }),
  })),
}, null, 2));
