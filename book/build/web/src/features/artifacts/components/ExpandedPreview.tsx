import type { RefObject } from "react";
import type { Artifacts, SceneChanges, Stage } from "../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import { ArtifactPreview } from "./ArtifactPreview";
import { stageNames } from "../lib/presentation.js";

export function ExpandedPreview({
  dialogRef,
  stage,
  projectId,
  version,
  value,
  bible,
  script,
  revision,
  onClose,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  stage: Stage;
  projectId?: string;
  version: number | null;
  value: unknown;
  bible?: Artifacts["bible"] | null;
  script?: Artifacts["script"] | null;
  revision?: SceneChanges;
  onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="bg-background text-foreground border-border fixed inset-0 m-auto max-h-[90dvh] w-[min(960px,94vw)] rounded-xl border p-0 shadow-2xl backdrop:bg-black/50"
      aria-labelledby="expanded-preview-title"
      onCancel={onClose}
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 id="expanded-preview-title" className="text-sm font-semibold text-foreground">
          {stageNames[stage]} · v{version} · 放大预览
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={onClose} className="h-8 text-xs">
          收起预览
        </Button>
      </header>
      <div className="max-h-[calc(90dvh-4rem)] overflow-y-auto p-4">
        <ArtifactPreview stage={stage} value={value} bible={bible} script={script} revision={revision} projectId={projectId} version={version} />
      </div>
    </dialog>
  );
}
