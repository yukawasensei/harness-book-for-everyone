import { STAGES, type Stage, type Artifacts } from "../contracts/index.js";
import { DEPENDENCIES, type Workflow } from "../workflow/index.js";

export type Basis = Partial<Record<Stage, number>>;
export interface Source {
  based_on: Basis;
  original_based_on?: Basis;
  validity_confirmation?: { reason: string; at: string };
  generated_by?: "reassemble";
  assembly_template?: string;
  reassembled_from?: number;
}
export type Provenance = Partial<Record<Stage, Record<number, Source>>>;
export function sameBasis(a: Basis, b: Basis) {
  return Object.keys(a).length === Object.keys(b).length && STAGES.every(s => a[s] === b[s]);
}
export function currentBasis(states: Workflow, stage: Stage): Basis {
  return Object.fromEntries(DEPENDENCIES[stage].map(s => [s, states[s].adopted_version]));
}
export function refreshStale(states: Workflow, sources: Provenance, changed: Stage) {
  const affected = new Set<Stage>([changed]);
  for (const stage of STAGES) {
    if (DEPENDENCIES[stage].some(s => affected.has(s))) affected.add(stage);
    const state = states[stage];
    if (!affected.has(stage)) continue;
    // 分镜板还需检查最新稿；保留已采用版本原有的失效判定。
    const versions = [state.adopted_version, ...(stage === "board" ? [state.versions.at(-1)] : [])]
      .filter((version): version is number => version !== null && version !== undefined);
    if (!versions.length) continue;
    const stale = versions.some(version => {
      const basis = sources[stage]?.[version]?.based_on;
      return DEPENDENCIES[stage].some(s => states[s].status !== "adopted" || !basis || basis[s] !== states[s].adopted_version);
    });
    state.status = stale ? "stale" : state.adopted_version !== null ? "adopted"
      : state.versions.some(v => state.reviews?.[v]?.status === "pending") ? "pending_review" : "ready";
  }
}
export interface BibleChange { id: string; name: string; fields: string[] }
export function compareBible(before: Artifacts["bible"], after: Artifacts["bible"]) {
  const changes: BibleChange[] = [];
  for (const group of ["characters", "props", "locations"] as const) {
    const old = new Map(before[group].map(entry => [entry.id, entry]));
    const next = new Map(after[group].map(entry => [entry.id, entry]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const a = old.get(id), b = next.get(id);
      const fields = !a ? ["added"] : !b ? ["removed"] : [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter(key => JSON.stringify((a as Record<string, unknown>)[key]) !== JSON.stringify((b as Record<string, unknown>)[key]));
      if (fields.length) changes.push({ id, name: b?.name ?? a!.name, fields });
    }
  }
  return changes;
}
