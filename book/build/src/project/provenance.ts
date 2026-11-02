import { STAGES, type Stage, type Artifacts } from "../contracts/index.js";
import { DEPENDENCIES, type Workflow } from "../workflow/index.js";

export type Basis = Partial<Record<Stage, number>>;
export interface Source {
  based_on: Basis;
  original_based_on?: Basis;
  validity_confirmation?: { reason: string; at: string };
  generated_by?: "reassemble";
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
    const state = states[stage], version = state.adopted_version;
    if (version === null || !affected.has(stage)) continue;
    const basis = sources[stage]?.[version]?.based_on;
    const stale = DEPENDENCIES[stage].some(s => states[s].status !== "adopted" || !basis || basis[s] !== states[s].adopted_version);
    state.status = stale ? "stale" : "adopted";
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
