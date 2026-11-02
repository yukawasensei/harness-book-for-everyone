import React from "react";
import type { Artifacts, SceneChanges, Stage } from "../../src/contracts/index.js";

export function ArtifactPreview({ stage, value, bible, script: adoptedScript, revision }: { stage: Stage; value: unknown; bible?: Artifacts["bible"] | null; script?: Artifacts["script"] | null; revision?: SceneChanges }) {
  const changed = new Set(revision?.revise_from ? revision.resubmitted : []);
  const legend = revision?.revise_from ? <p className="revision-legend"><span aria-hidden="true" />高亮：本版重交的场次；其余场沿用原稿。</p> : null;
  if (stage === "storyboard") {
    const board = value as Artifacts["storyboard"];
    const reference = (id: string) => {
      const entry = [...(bible?.characters ?? []), ...(bible?.props ?? []), ...(bible?.locations ?? [])].find(entry => entry.id === id);
      return entry ? `${entry.name}（${id}）` : id;
    };
    const heading = (scene: string) => adoptedScript?.scenes.find(entry => entry.scene_id === scene)?.heading
      ?? reference(board.shots.find(shot => shot.scene_id === scene)!.location_id);
    return <div className="storyboard-preview">
      {legend}
      {!bible && <p className="muted">设定集名称尚未加载，暂以编号显示引用。</p>}
      <p className="muted">共 {board.shots.length} 镜 · 合计 {board.shots.reduce((sum, shot) => sum + shot.duration_s, 0)} 秒</p>
      {[...new Set(board.shots.map(shot => shot.scene_id))].map(scene => <section key={scene} aria-label={`${scene} 分镜`} className={changed.has(scene) ? "scene-revised" : undefined}>
        <h3>{scene} · {heading(scene)} {changed.has(scene) && <span className="revised-label">本版重交</span>}</h3>
        {board.shots.filter(shot => shot.scene_id === scene).map(shot => <article className="shot-card setting-card" key={shot.shot_id}>
          <header><strong>{shot.shot_id}</strong><h4>{shot.shot_size} · {shot.duration_s} 秒</h4></header>
          <p><span className="setting-label">机位</span>{shot.camera}</p>
          <p><span className="setting-label">动作</span>{shot.action}</p>
          {shot.dialogue && <p className="shot-dialogue"><span className="setting-label">台词</span>{shot.dialogue}</p>}
          <p>场景：{reference(shot.location_id)}</p>
          <p>角色：{shot.character_ids.map(reference).join("、") || "无"}</p>
          <p>道具：{shot.prop_ids.map(reference).join("、") || "无"}</p>
        </article>)}
      </section>)}
      <details><summary>查看原始 JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
    </div>;
  }
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
            <p className="setting-scenes">出场场次：{entry.appears_in.join("、")}</p>
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
    {legend}
    {script.scenes.map(scene => <article key={scene.scene_id} className={`scene-card${changed.has(scene.scene_id) ? " scene-revised" : ""}`}>
      <header><h3>{scene.scene_id} · {scene.heading}</h3>{changed.has(scene.scene_id) && <span className="revised-label">本版重交</span>}</header>
      <p className="scene-summary">{scene.summary}</p>
      <div className="scene-lines">{scene.lines.map((line, index) => <p key={index} className={`scene-line ${line.kind}`}>
        {line.kind === "dialogue" ? <><strong>{line.character}：</strong>{line.text}</> : <><span className="action-label">动作</span>{line.text}</>}
      </p>)}</div>
    </article>)}
    <details><summary>查看原始 JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </div>;
}
