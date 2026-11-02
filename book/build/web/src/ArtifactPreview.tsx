import React, { useState } from "react";
import { TechnicalDetails } from "./TechnicalDetails";
import type { Artifacts, SceneChanges, Stage } from "../../src/contracts/index.js";

export function ArtifactPreview({ stage, value, bible, script: adoptedScript, revision }: { stage: Stage; value: unknown; bible?: Artifacts["bible"] | null; script?: Artifacts["script"] | null; revision?: SceneChanges }) {
  const changed = new Set(revision?.revise_from ? revision.resubmitted : []);
  const legend = revision?.revise_from ? <p className="revision-legend"><span aria-hidden="true" />高亮：本版重交的场次；其余场沿用原稿。</p> : null;
  if (stage === "prompts") return <PromptPreview value={value as Artifacts["prompts"]} revision={revision} />;
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
      <ArtifactData value={value} />
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
      <ArtifactData value={value} />
    </div>;
  }
  if (stage === "topic") {
    const topic = value as Artifacts["topic"];
    return <><pre>{`片名：${topic.title}\n\n一句话冲突：${topic.logline}\n\n类型：${topic.genre}\n受众：${topic.audience}\n目标时长：${topic.target_minutes} 分钟`}</pre><ArtifactData value={value} /></>;
  }
  if (stage === "synopsis") {
    const synopsis = value as Artifacts["synopsis"];
    return <><pre>{`片名：${synopsis.title}\n\n一句话冲突：${synopsis.logline}\n\n${synopsis.beats.map((beat, index) => `${["起", "承", "转", "合"][index]}：${beat}`).join("\n\n")}\n\n基调：${synopsis.tone}`}</pre><ArtifactData value={value} /></>;
  }
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
    <ArtifactData value={value} />
  </div>;
}

function PromptPreview({ value, revision }: { value: Artifacts["prompts"]; revision?: SceneChanges }) {
  const [copy, setCopy] = useState<{ id: string; message: string } | null>(null);
  async function copyPrompt(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopy({ id, message: "已复制完整提示词" }); }
    catch { setCopy({ id, message: "复制失败，请在技术详情中展开原始 JSON 手动复制完整提示词。" }); }
  }
  const changed = new Set(revision?.revise_from ? revision.resubmitted : []);
  return <div className="prompts-preview">
    <p className="muted">共 {value.items.length} 镜 · 蓝色为模型创作，绿色为程序注入。请核对动作与固定设定是否冲突。</p>
    {revision?.revise_from && <p className="revision-legend">高亮：本版重交的镜头；其余镜头沿用原稿。</p>}
    <div className="prompt-grid">{value.items.map(item => <article className={`prompt-card${changed.has(item.shot_id) ? " scene-revised" : ""}`} key={item.shot_id} aria-label={`${item.shot_id} 提示词`}>
      <header><h3>{item.shot_id}</h3>{changed.has(item.shot_id) && <span className="revised-label">本版重交</span>}
        <button type="button" aria-label={`复制 ${item.shot_id} 完整提示词`} onClick={() => void copyPrompt(item.shot_id, item.final_prompt)}>复制完整提示词</button>
      </header>
      <section className="prompt-model" aria-label="模型写的部分"><h4>模型写的部分</h4><p>[镜头] {item.shot_part}</p></section>
      <section className="prompt-injected" aria-label="程序注入的部分"><h4>程序注入的部分</h4><p>{item.final_prompt.slice(`[镜头] ${item.shot_part}\n`.length)}</p></section>
      {copy?.id === item.shot_id && <p role="status">{copy.message}</p>}
    </article>)}</div>
    <ArtifactData value={value} />
  </div>;
}

function ArtifactData({ value }: { value: unknown }) {
  return <TechnicalDetails><details><summary>查看原始 JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details></TechnicalDetails>;
}
