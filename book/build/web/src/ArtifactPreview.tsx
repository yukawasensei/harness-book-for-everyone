import React from "react";
import type { Artifacts, Stage } from "../../src/contracts/index.js";

export function ArtifactPreview({ stage, value }: { stage: Stage; value: unknown }) {
  if (stage === "bible") {
    const bible = value as Artifacts["bible"];
    return <div className="bible-preview">
      {([ ["characters", "角色"], ["props", "道具"], ["locations", "场景"] ] as const).map(([group, label]) =>
        <section key={group} className="bible-group" aria-label={label}>
          <h3>{label} <span>({bible[group].length})</span></h3>
          {!bible[group].length && <p className="muted">无关键{label}</p>}
          {bible[group].map(entry => <article key={entry.id} className="setting-card">
            <header><strong>{entry.id}</strong><h4>{entry.name}</h4></header>
            {"aliases" in entry && entry.aliases?.length ? <p className="muted">别名：{entry.aliases.join("、")}</p> : null}
            <p><span className="setting-label">固定描述</span>{"appearance" in entry ? entry.appearance : entry.description}</p>
            <p className="setting-scenes">来源场：{entry.appears_in.join("、")}</p>
            {"role" in entry && <details className="setting-context"><summary>叙事定位与性格</summary>
              <p><span className="setting-label">叙事定位</span>{entry.role}</p>
              <p><span className="setting-label">性格</span>{entry.personality}</p>
            </details>}
          </article>)}
        </section>)}
      <p className="muted">覆盖检查与固定描述粗筛通过仍需人工审阅：请核对人物、关键道具、场景及视觉细节。</p>
      <details><summary>查看原始 JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
    </div>;
  }
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
