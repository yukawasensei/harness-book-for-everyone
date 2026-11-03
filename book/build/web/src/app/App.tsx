import { useEffect, useState } from "react";
import type { Stage } from "../../../src/contracts/index.js";
import type { ServerConfig } from "../../../src/server/protocol.js";
import { AppShell } from "./AppShell";
import { DesignPreview } from "./DesignPreview";
import { SessionList, useStudioSession } from "@/features/sessions";
import { ChatPane, EmptyState, useProjectWorkspace } from "@/features/chat";
import { ArtifactPanel, InterruptedRunNotice, readerMessage, useProjectArtifacts } from "@/features/artifacts";
import { TokenGate } from "@/features/auth";
import { BrandMark } from "@/components/common/BrandMark";

const errorText = (err: unknown) => err instanceof Error ? readerMessage(err.message) : "创建任务失败";

function showDesign(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("design") || window.location.hash === "#/design";
}

export function App() {
  if (showDesign()) return <DesignPreview />;
  return <StudioApp />;
}

function StudioApp() {
  const s = useStudioSession();
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<Stage | null>(null);
  const [targetVersion, setTargetVersion] = useState<number | null>(null);
  const [createError, setCreateError] = useState("");

  function handleViewArtifact(stage: Stage, version: number) {
    setTargetStage(stage);
    setTargetVersion(version);
    setArtifactsOpen(true);
  }

  const hasProject = Boolean(s.id && s.config);

  return (
    <AppShell
      hasProject={hasProject}
      artifactsOpen={artifactsOpen}
      onArtifactsOpenChange={setArtifactsOpen}
      header={
        <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h1 className="m-0">
            <BrandMark />
            <span className="sr-only">织影 Reelloom</span>
          </h1>
          <span className="text-primary text-xs">
            {s.config?.mode === "demo" ? "离线演示 · 假模型 / 不发网络请求"
              : s.authRequired ? "托管工作区 · 使用令牌连接" : "本地工作区 · 点击运行后请求模型"}
          </span>
        </header>
      }
      left={
        <div className="flex h-full min-h-0 flex-col">
          {s.authRequired && (
            <TokenGate userId={s.config?.user_id} error={s.error} onConnected={s.reconnect} />
          )}
          {s.error && !s.authRequired && <p className="text-destructive px-3 py-2 text-sm" role="alert">{s.error}</p>}
          <SessionList
            projects={s.projects}
            selectedId={s.id}
            creating={s.creating}
            onSelect={s.setId}
            onCreate={() => { setCreateError(""); s.setId(""); }}
          />
        </div>
      }
      center={
        hasProject
          ? (
            <ProjectWorkspace
              key={`${s.authRevision}:${s.id}`}
              id={s.id}
              config={s.config!}
              onViewArtifact={handleViewArtifact}
            />
          )
          : (
            <div className="flex h-full min-h-0 flex-col overflow-y-auto">
              <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
                {s.config ? (
                  <EmptyState
                    onSend={async (message) => {
                      setCreateError("");
                      try {
                        // 走 studio.create：同步写入列表缓存再 setId，避免 invalidate 瞬间把选中冲掉
                        await s.create(message);
                      } catch (err) {
                        setCreateError(errorText(err));
                        throw err;
                      }
                    }}
                    sending={s.creating}
                    errorMessage={createError || undefined}
                  />
                ) : (
                  <div className="text-muted-foreground p-6 text-sm">
                    {s.authRequired ? "请填写访问令牌连接工作区。" : "正在连接服务…"}
                  </div>
                )}
              </div>
            </div>
          )
      }
      right={
        hasProject
          ? (
            <ProjectArtifacts
              key={`artifacts:${s.authRevision}:${s.id}`}
              id={s.id}
              config={s.config!}
              targetStage={targetStage}
              targetVersion={targetVersion}
            />
          )
          : <div className="text-muted-foreground p-6 text-center text-xs">选择或新建任务后在此查看产物。</div>
      }
    />
  );
}

function ProjectWorkspace({
  id,
  config,
  onViewArtifact,
}: {
  id: string;
  config: ServerConfig;
  onViewArtifact?: (stage: Stage, version: number) => void;
}) {
  const w = useProjectWorkspace(id, config);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {w.project && <div className="px-4 pt-2"><InterruptedRunNotice run={w.project.last_run} /></div>}
      {w.connection === "polling" && (
        <p className="bg-warning/15 text-warning mx-4 mt-2 rounded-md px-3 py-2 text-xs">
          连接断开了，正在自动重连。断开期间的进度会在重连后补上。
        </p>
      )}
      <div className="min-h-0 flex-1">
        <ChatPane
          items={w.items}
          project={w.project}
          loading={w.loading}
          sending={w.sending}
          running={w.running}
          placeholder={w.placeholder}
          connectionLabel={w.connectionLabel}
          errorMessage={w.error}
          liveRows={w.liveRows}
          onSend={w.send}
          onAbort={w.abort}
          onAdopt={w.adopt}
          onDiscard={w.discard}
          onRequestChanges={w.requestChanges}
          onViewArtifact={onViewArtifact}
        />
      </div>
    </div>
  );
}

function ProjectArtifacts({
  id,
  config,
  targetStage,
  targetVersion,
}: {
  id: string;
  config: ServerConfig;
  targetStage?: Stage | null;
  targetVersion?: number | null;
}) {
  const a = useProjectArtifacts(id, config);
  const { setStage, setVersion } = a;

  useEffect(() => {
    if (targetStage) setStage(targetStage);
  }, [targetStage, setStage]);

  useEffect(() => {
    if (targetVersion !== undefined && targetVersion !== null) setVersion(targetVersion);
  }, [targetVersion, setVersion]);

  return (
    <ArtifactPanel
      id={id} project={a.project} config={config}
      stage={a.stage} onStageChange={a.setStage}
      version={a.version} onVersionChange={a.setVersion}
      rows={a.rows} runningBusy={a.runningBusy} submitting={a.submitting}
      error={a.error} demo={a.demo}
      onAction={a.action} onExecuteRun={a.executeRun}
    />
  );
}
