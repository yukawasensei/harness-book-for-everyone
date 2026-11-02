import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { formatLocalDateTime } from "./date-time";
import type { StageState } from "../../src/workflow/index.js";
import type { SceneChanges, Stage } from "../../src/contracts/index.js";
import { demoChangeNote, DEMO_REVISION_NOTICE, demoRevisionNotice, reviewLabels, revisionDescription, stageNames } from "./presentation";

export function ReviewPanel({ stage, state, revision, version, loaded, busy, implemented = true, runReason, error, demo, programAssembled = false, onReview, onRevise }: {
  stage: Stage; implemented?: boolean;
  revision?: SceneChanges;
  programAssembled?: boolean;
  state?: StageState; version: number | null; loaded: boolean; busy: boolean; demo: boolean;
  runReason: string | null; error: string;
  onReview: (operation: "adopt" | "discard" | "request-changes", note?: string) => Promise<boolean>;
  onRevise: () => void;
}) {
  const [open, setOpen] = useState<"changes" | "discard" | "adopt" | null>(null);
  const exampleNote = demoChangeNote(stage);
  const [note, setNote] = useState(demo ? exampleNote : "");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const review = version === null ? null : state?.reviews?.[version];
  const status = review?.status ?? (state?.adopted_version === version && version !== null ? "adopted" : "pending");
  const reason = !implemented ? `${stageNames[stage]}暂未开放，当前没有可审阅版本。` : version === null ? "尚无版本，请先运行阶段。"
    : busy ? "项目正在运行或提交操作，请稍候。"
      : !loaded ? "请等版本内容加载完成后再审阅。"
        : status !== "pending" && status !== "adopted" ? `此版本${reviewLabels[status]}，不能重复审阅。` : null;
  const current = state?.adopted_version === version;
  const adoptReason = busy ? "项目正在运行或提交操作，请稍候。" : !loaded ? "请等待版本内容加载。" : current ? "此版本正在采用。" : status === "discarded" ? "丢弃版本不能采用。" : runReason;
  const discardReason = current ? "请先切换采用版本。" : reason;
  const savedDemoNotice = review?.note ? demoRevisionNotice(demo, review.note, stage) : null;
  const editedDemoNotice = demoRevisionNotice(demo, note, stage);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!open || (open === "adopt" ? adoptReason : open === "discard" ? discardReason : reason) || (open === "changes" && !note.trim())) return;
    if (await onReview(open === "adopt" ? "adopt" : open === "discard" ? "discard" : "request-changes", open === "changes" ? note : undefined)) setOpen(null);
  }
  return <section className="review-panel" aria-label="版本审阅">
    {version !== null && <p>v{version} <span className={`review-badge ${status}`}>{reviewLabels[status]}</span></p>}
    {revisionDescription(revision) && <p className="revision-summary">{revisionDescription(revision)}</p>}
    {programAssembled ? <p className="notice program-assembly-notice">由程序拼装，未调用模型</p>
      : demo && version !== null && version > 1 && <p className="notice demo-revision-notice">{DEMO_REVISION_NOTICE}</p>}
    {review?.note && <p className="review-note">审阅意见：{review.note}</p>}
    {review?.at && <p className="muted">审阅时间：<time dateTime={review.at}>{formatLocalDateTime(review.at)}</time></p>}
    <div className="review-actions">
      <button disabled={!!adoptReason} title={adoptReason ?? "采用此版本，继续下一步"} onClick={() => state?.adopted_version !== null ? setOpen("adopt") : void onReview("adopt")}>{state?.adopted_version != null && !current ? "切换采用此版本" : "采用此版本"}</button>
      <button disabled={!!discardReason} title={discardReason ?? "确认后标记为已丢弃，保留版本内容"} onClick={() => setOpen("discard")}>丢弃</button>
      <button disabled={!!reason} title={reason ?? "填写意见，要求一个新版本"} onClick={() => setOpen("changes")}>要求修改</button>
    </div>
    {(reason || adoptReason) && <p className="muted">{reason}{adoptReason && adoptReason !== reason ? ` ${adoptReason}` : ""}</p>}
    {status === "changes_requested" && <div className="revision-entry">
      <button disabled={busy || !!runReason} title={busy ? "项目正在运行或提交操作" : runReason ?? "根据这份原稿和意见生成新版本"} onClick={onRevise}>按意见修改 v{version}</button>
      <p className="muted">{busy ? "请等待当前操作完成。" : runReason ?? "将根据这份原稿和意见生成新版本，完成后需重新审阅。"}</p>
      {savedDemoNotice && <p className="notice demo-revision-notice">{savedDemoNotice}</p>}
    </div>}
    {open && <dialog ref={dialog} className="review-dialog" aria-labelledby="review-title" onCancel={() => setOpen(null)}>
      <form onSubmit={submit}>
        <h2 id="review-title">{open === "adopt" ? "确认切换采用" : open === "discard" ? "确认丢弃" : "要求修改"} · v{version}</h2>
        {open === "changes" ? <>
          <label htmlFor="review-note">修改意见（必填）</label>
          <textarea id="review-note" autoFocus required maxLength={8000} value={note} onChange={e => setNote(e.target.value)} disabled={busy} placeholder="说明希望保留什么、具体改哪里" />
          {demo && <p className="muted">演示示例：{exampleNote}</p>}
          {editedDemoNotice && <p className="notice demo-revision-notice">{editedDemoNotice}</p>}
          <p className="muted">确认后保留原稿；再点“按意见修改”才会启动运行。</p>
        </> : open === "adopt" ? <p>将采用版本从 v{state?.adopted_version} 切换为 v{version}，检查直接及间接下游，并标记待更新。确定切换吗？</p> : <p>版本保留可追溯，但之后不能采用。确定要丢弃 v{version} 吗？</p>}
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="review-actions">
          <button type="button" autoFocus={open === "discard"} disabled={busy} onClick={() => setOpen(null)}>取消</button>
          <button className={open === "discard" ? "danger" : "primary"} disabled={busy || (open === "adopt" ? !!adoptReason : !!reason) || (open === "changes" && !note.trim())}>{open === "adopt" ? "确认切换采用" : open === "discard" ? "确认丢弃" : "确认修改意见"}</button>
        </div>
      </form>
    </dialog>}
  </section>;
}
