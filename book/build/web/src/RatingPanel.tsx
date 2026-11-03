import { useEffect, useState, type FormEvent } from 'react';
import { SCORE_LABELS, SCORE_ANCHORS, STAGE_DIMENSIONS, type Rating, type Dimension } from '../../src/project/ratings.js';
import type { Stage } from '../../src/contracts/index.js';
import { formatLocalDateTime } from './date-time';
import { api } from './api';

export function RatingPanel({ path, stage, version, rating, busy, onSave }: {
  path: string; stage: Stage; version: number; rating?: Rating; busy: boolean;
  onSave: (scores: Partial<Record<Dimension, number>>, note: string) => Promise<boolean>;
}) {
  const [scores, setScores] = useState<Partial<Record<Dimension, number>>>(rating?.scores ?? {});
  const [note, setNote] = useState(rating?.note ?? '');
  const [message, setMessage] = useState('');
  useEffect(() => { setScores(rating?.scores ?? {}); setNote(rating?.note ?? ''); }, [rating]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('');
    if (await onSave(scores, note)) setMessage('评分已保存');
  }
  async function download() {
    try {
      const report = await api(`${path}/ratings`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'human-ratings.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('评分汇总已导出');
    } catch { setMessage('导出失败，请重试'); }
  }
  return <details className="rating-panel">
    <summary>评分（可选） · v{version}{rating ? ' · 已评分' : ''}</summary>
    <p className="muted">人工质量评分，1 分低、5 分高；不影响采用与结构签收。未填项不计分。</p>
    <form onSubmit={submit}>
      {STAGE_DIMENSIONS[stage].map(key => <label key={key}>{SCORE_LABELS[key]} <select aria-label={SCORE_LABELS[key]} value={scores[key] ?? ''} disabled={busy} onChange={e => setScores(current => {
        const next = { ...current }; if (e.target.value) next[key] = Number(e.target.value); else delete next[key]; return next;
      })}>
        <option value="">未评分</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} · {SCORE_ANCHORS[key][n - 1]}</option>)}
      </select></label>)}
      <label>评分说明<textarea aria-label="评分说明" value={note} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)} placeholder="写下具体场次、镜号或判断依据" /></label>
      <div className="review-actions"><button disabled={busy || !Object.keys(scores).length}>保存评分</button><button type="button" disabled={busy} onClick={() => void download()}>导出评分汇总</button></div>
    </form>
    {rating && <p className="muted">人工评分时间：{formatLocalDateTime(rating.at)}</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
