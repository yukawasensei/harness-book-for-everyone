import React from "react";
import type { Artifacts, Stage } from "../../src/contracts/index.js";

export function ArtifactPreview({ stage, value }: { stage: Stage; value: unknown }) {
  if (stage !== "script") return <pre>{JSON.stringify(value, null, 2)}</pre>;
  const script = value as Artifacts["script"];
  return <div className="script-preview">
    {script.scenes.map(scene => <article key={scene.scene_id} className="scene-card">
      <header><strong>{scene.scene_id}</strong><h3>{scene.heading}</h3></header>
      <p className="scene-summary">{scene.summary}</p>
      <div className="scene-lines">{scene.lines.map((line, index) => <p key={index} className={`scene-line ${line.kind}`}>
        {line.kind === "dialogue" ? <><strong>{line.character}：</strong>{line.text}</> : <><span className="action-label">动作</span>{line.text}</>}
      </p>)}</div>
    </article>)}
    <details><summary>查看原始 JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </div>;
}
