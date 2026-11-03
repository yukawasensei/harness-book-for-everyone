import type { Artifacts } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import type { Basis } from "../../../../../src/project/provenance.js";
import { api } from "@/lib/api";

/** 加载分镜卡片所需的角色、场景名称与场次标题。 */
export function boardReferenceVersions(project: ProjectDetail | null, version: number | null): Basis | undefined {
  const source = version === null ? undefined : project?.provenance?.board?.[version];
  return source?.original_based_on ?? source?.based_on;
}

export async function loadBoardReferences(path: string, basis: Basis | undefined, signal?: AbortSignal) {
  const bibleVersion = basis?.bible;
  const scriptVersion = basis?.script;
  const [bible, script] = await Promise.all([
    bibleVersion ? api<Artifacts["bible"]>(`${path}/stages/bible/versions/${bibleVersion}`, undefined, signal) : null,
    scriptVersion ? api<Artifacts["script"]>(`${path}/stages/script/versions/${scriptVersion}`, undefined, signal) : null,
  ]);
  return { bible, script };
}
