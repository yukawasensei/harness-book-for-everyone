import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import { stageNames } from "../lib/presentation.js";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import { BibleImpactNotice } from "./BibleImpactNotice";

/** 兼容旧接口：来源、有效理由与设定影响。 */
export function ProvenancePanel({
  project,
  stage,
  version = null,
}: {
  project: ProjectDetail;
  stage: Stage;
  version?: number | null;
}) {
  const basis = version === null ? undefined : project.provenance?.[stage]?.[version]?.based_on;
  const confirmation = version === null ? undefined : project.provenance?.[stage]?.[version]?.validity_confirmation;
  return (
    <div className="space-y-2 text-xs">
      {version !== null && (
        <p className="text-muted-foreground">
          {basis
            ? `基于 ${Object.entries(basis).map(([s, v]) => `${stageNames[s as Stage]} v${v}`).join(" · ") || "无上游依赖"}`
            : "未知来源 · 此旧版本未记录依赖版本"}
        </p>
      )}
      {confirmation && (
        <div className="rounded-md border border-border/80 bg-muted/20 p-2 space-y-1">
          <p>有效理由：{confirmation.reason}</p>
          <p className="text-muted-foreground">
            确认时间：<time dateTime={confirmation.at}>{formatLocalDateTime(confirmation.at)}</time>
          </p>
        </div>
      )}
      {project.stages[stage].status === "stale" && (
        <p className="text-warning bg-warning/10 rounded-md px-2 py-1.5">
          待更新：采用版本的来源与当前上游不一致，或上游仍待更新。可查看旧稿；请重跑、按意见修改或确认仍然有效。
        </p>
      )}
      <BibleImpactNotice project={project} stage={stage} />
    </div>
  );
}
