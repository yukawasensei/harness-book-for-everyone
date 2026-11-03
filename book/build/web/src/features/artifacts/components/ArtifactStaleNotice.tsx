import { AlertTriangle } from "lucide-react";

export function ArtifactStaleNotice({ isStale }: { isStale?: boolean }) {
  if (!isStale) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="font-medium">当前阶段待更新</p>
        <p className="text-muted-foreground text-[11px]">
          采用版本的来源与当前上游不一致。可查看旧稿，或在上方「更多」菜单中进行返工、确认有效或重新拼装。
        </p>
      </div>
    </div>
  );
}
