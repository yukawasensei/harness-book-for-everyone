import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Stage } from "../../src/contracts/index.js";
import type { ProjectDetail, ServerConfig } from "../../src/server/protocol.js";
import { api } from "./api";
import { connectProject, type Connection } from "./live";
import { appendEvent, type TimelineRow } from "./timeline";
import { missingEventsNotice, runSummary, toolErrorText } from "./presentation";
import { rememberSelectedProject, restoreSelectedProject } from "./project-selection";

const stages: [Stage, string][] = [
  ["topic", "选题"], ["synopsis", "梗概"], ["script", "剧本"],
  ["bible", "设定集"], ["storyboard", "分镜脚本"], ["prompts", "分镜提示词"],
];
const statusLabel = { locked: "锁定", ready: "可运行", pending_review: "待采用", adopted: "已采用" };
const connectionLabel: Record<Connection, string> = { connecting: "正在连接", live: "实时事件已连接", polling: "连接中断 · 每 2 秒轮询" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "操作失败";

export function App() {
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<ProjectDetail[]>("/api/projects", undefined, controller.signal),
      api<ServerConfig>("/api/config", undefined, controller.signal),
    ]).then(([list, settings]) => {
      if (controller.signal.aborted) return;
      setProjects(list); setConfig(settings); setId(current => list.some(project => project.id === current) ? current : restoreSelectedProject(list));
    }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, []);
  useEffect(() => { rememberSelectedProject(id); }, [id]);
  async function create(event: FormEvent) {
    event.preventDefault(); setCreating(true); setError("");
    try {
      const project = await api<ProjectDetail>("/api/projects", { title });
      setProjects(list => [...list, project]); setId(project.id); setTitle("");
    } catch (error) { setError(errorMessage(error)); }
    finally { setCreating(false); }
  }
  return <div className="app">
    <header className="app-header">
      <div><h1>分镜工坊</h1><span className="muted">Storyboard Studio</span></div>
      <span className="mode">{config?.mode === "demo" ? "离线演示 · 假模型 / 不发网络请求" : "本地工作区 · 点击运行后请求模型"}</span>
    </header>
    <div className="project-bar">
      <label>项目 <select aria-label="选择项目" value={id} onChange={e => setId(e.target.value)} disabled={!projects.length}>
        {!projects.length && <option value="">尚无项目</option>}
        {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select></label>
      <form onSubmit={create}>
        <input aria-label="项目标题" placeholder="新项目标题" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} required />
        <button disabled={creating || !title.trim()}>新建项目</button>
      </form>
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {id && config ? <ProjectWorkspace key={id} id={id} config={config} />
      : <main className="empty">{config ? "创建一个项目，从选题开始。" : "正在连接本地服务…"}</main>}
  </div>;
}

function ProjectWorkspace({ id, config }: { id: string; config: ServerConfig }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [stage, setStage] = useState<Stage>("topic");
  const [version, setVersion] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ version: number; stage: Stage; value: unknown } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const feed = useRef<ReturnType<typeof connectProject> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const path = `/api/projects/${encodeURIComponent(id)}`;
  useEffect(() => {
    const live = connectProject(id, {
      state: setProject, event: event => setRows(rows => appendEvent(rows, event)),
      connection: setConnection, error: setError,
    });
    feed.current = live;
    return () => { live.close(); feed.current = null; };
  }, [id]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [rows]);
  const versions = project?.stages[stage].versions ?? [];
  const versionsKey = versions.join(",");
  useEffect(() => {
    setVersion(current => current !== null && versions.includes(current) ? current : versions.at(-1) ?? null);
  }, [stage, versionsKey]);
  useEffect(() => {
    if (version === null) { setPreview(null); setPreviewError(""); return; }
    const controller = new AbortController();
    setPreview(null); setPreviewError("");
    void api<unknown>(`${path}/stages/${stage}/versions/${version}`, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setPreview({ stage, version, value }); })
      .catch(error => { if (!controller.signal.aborted) setPreviewError(errorMessage(error)); });
    return () => controller.abort();
  }, [path, stage, version]);

  async function action(operation: () => Promise<void>) {
    setError(""); setSubmitting(true);
    try { await operation(); }
    catch (error) { setError(errorMessage(error)); }
    finally { await feed.current?.refresh(); setSubmitting(false); }
  }
  function run(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      setRows(rows => [...rows, { kind: "user", id: `user:${Date.now()}`, text: instructions.trim() || `运行 ${stage}` }]);
      await api(`${path}/stages/${stage}/run`, { instructions });
    });
  }
  const state = project?.stages[stage];
  const running = project?.running;
  const implemented = config.runnable_stages.includes(stage);
  const blockedReason = project?.run_blocked_reasons[stage] ?? null;
  const runnable = !!project && !blockedReason && implemented && (state?.status === "ready" || state?.status === "pending_review");
  const historyNotice = missingEventsNotice(project, rows);
  const summary = project?.last_run ? runSummary(project.last_run) : null;
  const visiblePreview = preview?.stage === stage && preview.version === version ? preview : null;
  const adoptable = state?.status === "pending_review" && visiblePreview !== null && !previewError;
  return <main className="workspace">
    <section className="conversation" aria-label="对话和工具调用">
      <div className="panel-heading"><h2>对话与工具</h2><span className={`connection ${connection}`}>{connectionLabel[connection]}</span></div>
      {connection === "polling" && <p className="notice">断线期间文本与工具事件可能缺失；阶段、版本和运行结论以轮询快照为准。连接会自动重试。</p>}
      <div className="timeline" aria-label="运行事件">
        {historyNotice && <p className="muted history-notice">{historyNotice}</p>}
        {!rows.length && <p className="muted">选择阶段，填写补充要求后运行。这里只显示当前打开页面收到的事件，历史产物可在右侧查看。</p>}
        {rows.map(row => <TimelineItem key={row.id} row={row} />)}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={run}>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <label htmlFor="instructions">补充要求 · {stage}</label>
        <textarea id="instructions" placeholder="例如：两位角色，雨天，三分钟原创短片" value={instructions} onChange={e => setInstructions(e.target.value)} maxLength={8000} disabled={!!running || submitting} />
        <div className="composer-actions">
          <span id="run-reason" className="muted">{running ? `正在运行 ${running.stage}${running.abort_requested ? " · 正在中断…" : ""}` : blockedReason ?? "只有人工采用后才解锁下游"}</span>
          {running ? <button type="button" className="danger" disabled={submitting || running.abort_requested} onClick={() => void action(async () => { await api(`${path}/abort`, {}); })}>中断</button>
            : <button className="primary" aria-describedby="run-reason" disabled={!runnable || submitting}>{submitting ? "正在提交…" : "运行阶段"}</button>}
        </div>
      </form>
    </section>
    <aside className="artifacts" aria-label="阶段和产物">
      <div className="panel-heading"><h2>阶段与产物</h2></div>
      <nav className="stages" aria-label="六阶段导航">
        {stages.map(([key, label], index) => {
          const status = project?.stages[key].status;
          return <button key={key} className={stage === key ? "selected" : ""} aria-current={stage === key ? "step" : undefined} onClick={() => { setStage(key); setVersion(null); }}>
            <span>{index + 1}. {label}</span>
            <span className={`badge ${status ?? ""}`}>{status ? `${statusLabel[status]} / ${status}` : "加载中"}</span>
          </button>;
        })}
      </nav>
      {!implemented && <p className="notice">此阶段的提示模板尚未实现。</p>}
      <div className="version-heading">
        <label>版本 <select aria-label="选择产物版本" value={version ?? ""} disabled={!versions.length} onChange={e => setVersion(Number(e.target.value))}>
          {!versions.length && <option value="">暂无草稿</option>}
          {versions.map(v => <option key={v} value={v}>v{v}{state?.adopted_version === v ? " · 已采用" : " · 草稿"}</option>)}
        </select></label>
        <button disabled={!adoptable || !!running || submitting} onClick={() => void action(async () => { await api(`${path}/stages/${stage}/adopt`, { version }); })}>采用此版本</button>
      </div>
      <div className="preview" aria-label="产物预览">
        {previewError ? <p className="error-banner" role="alert">{previewError}</p>
          : visiblePreview ? <pre>{JSON.stringify(visiblePreview.value, null, 2)}</pre>
            : <p className="muted">{version === null ? "运行成功写入草稿后，在这里审阅 JSON。" : "正在读取版本…"}</p>}
      </div>
      {project?.last_run && summary && <div className={`run-summary${summary.failed ? " failed" : ""}`}>
        <p>最近运行：{project.last_run.stage} · {summary.text}</p>
        <code className="muted">stop_reason={project.last_run.stop_reason}</code>
        <ErrorDetails errors={project.last_run.errors} />
      </div>}
      <p className="muted artifact-note">采用已落盘草稿。</p>
    </aside>
  </main>;
}

function TimelineItem({ row }: { row: TimelineRow }) {
  if (row.kind !== "tool") return <article className={`message ${row.kind}`}><span className="message-label">{row.kind === "user" ? "你" : row.kind === "text" ? "助手" : "运行记录"}</span><p>{row.text}</p><ErrorDetails errors={row.details ?? []} /></article>;
  const args = JSON.stringify(row.args, null, 2) ?? "";
  return <article className={`tool-card ${row.status}`}>
    <div><strong>{row.name}</strong><span>{({ running: "执行中", success: "成功", error: "错误", unknown: "结果未收到" })[row.status]}</span></div>
    <pre>{args.length > 600 ? `${args.slice(0, 600)}…` : args}</pre>
    {row.status === "error" && <p className="tool-error-reason">{toolErrorText(row.result)}</p>}
    {row.result !== undefined && <details><summary>查看原始工具结果</summary><pre>{JSON.stringify(row.result, null, 2)}</pre></details>}
  </article>;
}

function ErrorDetails({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return <details className="error-details"><summary>查看过程错误（{errors.length}）</summary><pre>{errors.join("\n\n")}</pre></details>;
}
