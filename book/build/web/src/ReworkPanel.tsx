import React, { useEffect, useRef, useState } from "react";
import type { Stage } from "../../src/contracts/index.js";
import type { ProjectDetail, RunResult } from "../../src/server/protocol.js";
import { stageNames } from "./presentation";
import { formatLocalDateTime } from "./date-time";

export function InterruptedRunNotice({ run }: { run: RunResult | null | undefined }) {
  if (run?.stop_reason !== "interrupted") return null;
  return <p className="notice interrupted-notice" role="status">上次运行被中断 · {stageNames[run.stage]} · 运行开始：<time dateTime={run.started_at}>{formatLocalDateTime(run.started_at)}</time>。可选择从暂存继续或重新开始。</p>;
}

export function ReworkActions({ busy, runReason, reassembleReason, onRun, onConfirmValid, onReassemble }: {
  busy: boolean; runReason: string | null; reassembleReason: string | null;
  onRun: () => void; onConfirmValid: () => void; onReassemble: () => void;
}) {
  const busyReason = busy ? "项目正在运行或提交操作，请稍候。" : null;
  const choices = [
    { label: "返工运行", description: "使用当前上游重新创作，生成新版本。", reason: busyReason ?? runReason, action: onRun },
    { label: "确认仍然有效", description: "填写理由，保留内容并更新来源。", reason: busyReason ?? runReason, action: onConfirmValid },
    { label: "重新拼装", description: "沿用镜头部分、更新固定设定，不调用模型。", reason: busyReason ?? reassembleReason, action: onReassemble },
  ];
  return <section className="rework-actions" aria-label="待更新处理方式">{choices.map(choice => <div className="rework-choice" key={choice.label}>
    <button disabled={!!choice.reason} title={choice.reason ?? choice.description} onClick={choice.action}>{choice.label}</button>
    <p>{choice.description}</p>{choice.reason && <p className="muted">{choice.reason}</p>}
  </div>)}</section>;
}

export type ReworkOperation = "run" | "revise" | "confirm-valid" | "reassemble";
export function ReworkDialog({ operation, staging, busy, error, onCancel, onConfirm }: {
  operation: ReworkOperation; staging: boolean; busy: boolean; error: string;
  onCancel: () => void;
  onConfirm: (reason: string, choice?: "resume" | "restart") => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState<"resume" | "restart">("resume");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const title = operation === "confirm-valid" ? "确认仍然有效" : operation === "reassemble" ? "确认重新拼装" : "确认运行";
  return <dialog ref={dialog} className="review-dialog" onCancel={onCancel} aria-label={title}>
    <form onSubmit={e => { e.preventDefault(); void onConfirm(reason, staging ? choice : undefined); }}>
      <h2>{title}</h2>
      <p>{operation === "confirm-valid" ? "声明采用版本在当前上游下仍然适用。记录理由并更新来源，原产物文件保留。"
        : operation === "reassemble" ? "使用新设定与原镜头部分生成待审阅新版本，不调用模型。采用新版本后恢复有效状态。"
          : "将生成待审阅新版本；当前采用版本继续保留。真实模型模式会请求模型，采用变化会检查下游是否待更新。"}</p>
      {operation === "confirm-valid" && <label>有效理由（必填）<textarea required maxLength={8000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      {staging && <fieldset><legend>发现未汇总暂存</legend>
        <label><input type="radio" name="staging" checked={choice === "resume"} onChange={() => setChoice("resume")} />从暂存继续</label>
        <label><input type="radio" name="staging" checked={choice === "restart"} onChange={() => setChoice("restart")} />重新开始（替换暂存）</label>
      </fieldset>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="review-actions"><button type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button disabled={busy || (operation === "confirm-valid" && !reason.trim())}>{title}</button></div>
    </form>
  </dialog>;
}

export function ProvenancePanel({ project, stage, version }: { project: ProjectDetail; stage: Stage; version: number | null }) {
  const basis = version === null ? undefined : project.provenance?.[stage]?.[version]?.based_on;
  const confirmation = version === null ? undefined : project.provenance?.[stage]?.[version]?.validity_confirmation;
  const impact = project.bible_impact;
  return <div className="provenance-panel">
    {version !== null && <p className="basis">{basis ? `基于 ${Object.entries(basis).map(([s, v]) => `${stageNames[s as Stage]} v${v}`).join(" · ") || "无上游依赖"}` : "未知来源 · 此旧版本未记录依赖版本"}</p>}
    {confirmation && <div className="validity-confirmation"><p>有效理由：{confirmation.reason}</p><p className="muted">确认时间：<time dateTime={confirmation.at}>{formatLocalDateTime(confirmation.at)}</time></p></div>}
    {project.stages[stage].status === "stale" && <p className="notice">待更新：采用版本的来源与当前上游不一致，或上游仍待更新。可查看旧稿；请重跑、按意见修改或确认仍然有效。</p>}
    {impact && (stage === "bible" || stage === "storyboard" || stage === "prompts") && <details className="impact" open={impact.changes.length > 0}>
      <summary>设定影响分析</summary>
      {impact.unknown ? <p>未知来源，无法可靠比较；请人工检查。</p> : <>
        <p>设定集 v{impact.from} → v{impact.to}</p>
        {impact.changes.length ? <><ul>{impact.changes.map(c => <li key={c.id}>{c.name}（{c.id}）：{c.fields.map(f => ({ appearance: "外观", description: "固定描述", added: "新增", removed: "移除" } as Record<string, string>)[f] ?? f).join("、")}</li>)}</ul>
          <p>受影响镜头：{impact.shots.join("、") || "无"}</p><p>受影响提示词：{impact.prompts.join("、") || "无"}</p></> : <p>没有设定条目变化。</p>}
      </>}
    </details>}
  </div>;
}
