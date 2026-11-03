import { useState } from "react";
import type { Dimension, Rating } from "../../../../../src/project/ratings.js";
import type { Stage } from "../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import { RatingDialog } from "./RatingDialog";

export function RatingPanel({
  path,
  stage,
  version,
  rating,
  busy,
  onSave,
}: {
  path: string;
  stage: Stage;
  version: number;
  rating?: Rating;
  busy: boolean;
  onSave: (scores: Partial<Record<Dimension, number>>, note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="h-8 text-xs"
      >
        {rating ? `已评分 (v${version})` : `为 v${version} 评分`}
      </Button>
      <RatingDialog
        open={open}
        onOpenChange={setOpen}
        path={path}
        stage={stage}
        version={version}
        rating={rating}
        busy={busy}
        onSave={onSave}
      />
    </>
  );
}
