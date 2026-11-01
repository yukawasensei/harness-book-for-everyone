// Ch6 · 评测基线：纯函数部分（汇总、对比回归），离线可测。
export type CaseResult = {
  id: string;
  chapter?: string;
  pass: boolean;
  stop_reason: string | null;
  tools: string[];
  reasons: string[];
  durationMs: number;
};

export type Baseline = {
  model: string;
  startedAt: string;
  finishedAt: string;
  passCount: number;
  total: number;
  results: CaseResult[];
};

export function summarize(meta: { model: string; startedAt: string; finishedAt: string }, results: CaseResult[]): Baseline {
  return { ...meta, passCount: results.filter((r) => r.pass).length, total: results.length, results };
}

export type Regression = { id: string; kind: "regressed" | "fixed" | "new" | "removed"; before?: string | null; after?: string | null };

/** 和上一份基线比：PASS→FAIL 是回归（必须拦住签字），FAIL→PASS 是修复。 */
export function compareBaselines(previous: Baseline | undefined, current: Baseline): Regression[] {
  if (!previous) return current.results.map((r) => ({ id: r.id, kind: "new" as const, after: r.stop_reason }));
  const before = new Map(previous.results.map((r) => [r.id, r]));
  const after = new Map(current.results.map((r) => [r.id, r]));
  const changes: Regression[] = [];
  for (const [id, now] of after) {
    const old = before.get(id);
    if (!old) changes.push({ id, kind: "new", after: now.stop_reason });
    else if (old.pass && !now.pass) changes.push({ id, kind: "regressed", before: old.stop_reason, after: now.stop_reason });
    else if (!old.pass && now.pass) changes.push({ id, kind: "fixed", before: old.stop_reason, after: now.stop_reason });
  }
  for (const id of before.keys()) if (!after.has(id)) changes.push({ id, kind: "removed" });
  return changes;
}

/** 签字规则：全部 PASS 且没有回归，才能签。 */
export function canSignOff(current: Baseline, changes: Regression[]): boolean {
  return current.passCount === current.total && !changes.some((c) => c.kind === "regressed");
}

export function formatReport(current: Baseline, changes: Regression[]): string {
  const lines = [
    `model=${current.model}  pass=${current.passCount}/${current.total}  startedAt=${current.startedAt}`,
    "",
    "case                          result  stop_reason     tools",
    ...current.results.map(
      (r) => `${r.id.padEnd(30)}${(r.pass ? "PASS" : "FAIL").padEnd(8)}${String(r.stop_reason).padEnd(16)}${r.tools.join(",") || "(none)"}${r.pass ? "" : `  ← ${r.reasons.join("; ")}`}`,
    ),
    "",
    changes.length === 0 ? "vs previous baseline: no change" : "vs previous baseline:",
    ...changes.map((c) => `  ${c.kind.padEnd(10)}${c.id}${c.before !== undefined ? `  ${c.before} → ${c.after}` : ""}`),
    "",
    canSignOff(current, changes) ? "SIGN-OFF: OK（全部 PASS，无回归）" : "SIGN-OFF: BLOCKED（有 FAIL 或回归）",
  ];
  return lines.join("\n");
}
