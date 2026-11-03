import type { Stage } from '../contracts/index.js';
export const SCORE_LABELS = { appeal: '选题吸引力', structure: '结构完整', character: '角色辨识度', filmability: '镜头可拍性', usability: '提示词可用性' } as const;
export const SCORE_ANCHORS = {
  appeal: ['缺少主题或冲突', '主题可辨但冲突弱', '主题与冲突清楚', '冲突具体且有悬念', '独特冲突与目标受众高度契合'],
  structure: ['因果断裂，无法理解', '有起止但关键转折缺失', '起因转折结局可理解', '转折由人物选择推动', '各段互相呼应，删减会损伤表达'],
  character: ['人物无法区分或设定矛盾', '主要靠名字区分', '动机与特征可区分', '行动和语言体现差异', '人物选择持续鲜明且推动故事'],
  filmability: ['空间动作无法实现', '关键动作或位置含混', '主体动作与机位可执行', '镜头衔接与调度明确', '调度精炼，节奏与表达相互支持'],
  usability: ['关键信息缺失或相互矛盾', '需大幅重写才能使用', '基本可用，需少量澄清', '具体清楚，可直接试用', '简练无歧义，镜头语言与目标一致'],
} as const;
export type Dimension = keyof typeof SCORE_LABELS;
export const STAGE_DIMENSIONS: Record<Stage, Dimension[]> = {
  topic: ['appeal'], synopsis: ['appeal', 'structure'], script: ['structure', 'character'],
  bible: ['character'], storyboard: ['structure', 'filmability'], prompts: ['usability'],
};
export interface Rating { scores: Partial<Record<Dimension, number>>; note: string; at: string; actor: string; source: 'human' }
export type Ratings = Partial<Record<Stage, Record<number, Rating>>>;
export function validateRating(stage: Stage, value: unknown): Omit<Rating, 'at' | 'actor' | 'source'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('评分必须是对象');
  const { scores, note = '' } = value as { scores?: unknown; note?: unknown };
  if (!scores || typeof scores !== 'object' || Array.isArray(scores) || !Object.keys(scores).length) throw new Error('至少填写一项评分');
  for (const [key, score] of Object.entries(scores)) {
    if (!STAGE_DIMENSIONS[stage].includes(key as Dimension) || !Number.isInteger(score) || score < 1 || score > 5) throw new Error('评分须为本阶段指标的 1–5 整数');
  }
  if (typeof note !== 'string' || note.length > 2000) throw new Error('评分说明最多 2000 字');
  return { scores: structuredClone(scores), note: note.trim() };
}
