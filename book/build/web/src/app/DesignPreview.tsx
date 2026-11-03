import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  EmptyState,
  PlanCard,
  UserMessage,
  AssistantText,
  ToolCallCard,
  ReviewCard,
  SystemNotice,
  RunStatusBar,
  Composer,
} from "@/features/chat";

const MOCK_PROJECT = {
  running: { id: "run-2", stage: "script" as const, started_at: new Date().toISOString(), abort_requested: false },
  stages: {
    topic: { status: "adopted" as const, versions: [1], adopted_version: 1 },
    synopsis: { status: "adopted" as const, versions: [1], adopted_version: 1 },
    script: { status: "pending_review" as const, versions: [1], adopted_version: null },
    bible: { status: "stale" as const, versions: [], adopted_version: null },
    storyboard: { status: "locked" as const, versions: [], adopted_version: null },
    prompts: { status: "locked" as const, versions: [], adopted_version: null },
  },
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold">{children}</h2>;
}

/** 中文名 + 等宽原语名，例如「按钮（button）」；solid 用于实心色底按钮。 */
function Prim({ zh, en, solid }: { zh: string; en: string; solid?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      {zh}
      <span className={`font-mono text-[10px] font-normal ${solid ? "text-destructive-foreground/80" : "text-muted-foreground"}`}>({en})</span>
    </span>
  );
}

export function DesignPreview() {
  const [switchVal, setSwitchVal] = useState(true);
  const [composerVal, setComposerVal] = useState("");

  return (
    <div className="bg-background text-foreground mx-auto max-w-5xl space-y-8 overflow-y-auto p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">设计系统预览</h1>
        <p className="text-muted-foreground text-xs">开发态 ?design / #/design：原语与业务卡片各状态。</p>
      </header>

      <section className="space-y-3">
        <SectionTitle>基础原语</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm"><Prim zh="按钮" en="button" /></Button>
          <Button size="sm" variant="secondary"><Prim zh="次要" en="secondary" /></Button>
          <Button size="sm" variant="outline"><Prim zh="描边" en="outline" /></Button>
          <Button size="sm" variant="destructive"><Prim zh="危险" en="destructive" solid /></Button>
          <Badge><Prim zh="徽标" en="badge" /></Badge>
          <Badge variant="success"><Prim zh="成功" en="success" /></Badge>
          <Badge variant="warning"><Prim zh="警告" en="warning" /></Badge>
          <Badge variant="destructive"><Prim zh="失败" en="destructive" /></Badge>
          <div className="flex items-center gap-2 pl-2">
            <span className="text-xs"><Prim zh="开关" en="switch" /></span>
            <Switch checked={switchVal} onCheckedChange={setSwitchVal} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="单行输入" aria-label="单行输入（input）" />
          <Textarea placeholder="多行输入" rows={2} aria-label="多行输入（textarea）" />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>制作计划</SectionTitle>
        <PlanCard project={MOCK_PROJECT} />
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>空状态</SectionTitle>
        <Card className="p-2">
          <EmptyState onSelectPrompt={text => setComposerVal(text)} />
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>对话消息</SectionTitle>
        <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
          <UserMessage text="想拍一部科幻短片，深空货运站接收到求救信号。" at={new Date().toISOString()} />
          <AssistantText text="收到需求。接下来我们将先进行【选题】构思，完成后交稿给您审阅。" at={new Date().toISOString()} />
          <AssistantText text="正在构思三组不同的故事切入点…" streaming />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>工具调用</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <ToolCallCard name="write_draft" label="生成草稿" status="success" args_summary="stage: topic, version: 1" />
          <ToolCallCard name="inspect_artifacts" label="检查产物" status="running" args={{ stage: "script" }} />
          <ToolCallCard name="validate" label="校验草稿" status="error" error="依赖的设定集尚未采用" />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>审阅卡</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewCard stage="script" version={1} onViewArtifact={() => {}} onAdopt={() => {}} onDiscard={() => {}} onRequestChanges={() => {}} />
          <ReviewCard stage="topic" version={1} decision="adopted" />
          <ReviewCard stage="synopsis" version={2} decision="changes_requested" note="把第二场改得更紧张一些" />
          <ReviewCard stage="synopsis" version={1} decision="discarded" />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>系统提示与运行状态</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <SystemNotice type="quota" title="请求频率提示" message="今日模型调用已达配额（429），请稍候重试。" />
          <SystemNotice type="stale" title="上游已更新" message="剧本已有新版本，设定集需要重新生成以保持一致。" />
          <SystemNotice type="error" title="运行失败" message="模型服务响应超时，请重试。" />
          <SystemNotice type="info" title="自动推进已开启" message="审阅通过后将自动开始下一道工序。" />
        </div>
        <RunStatusBar stage="script" onAbort={() => {}} />
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionTitle>输入框</SectionTitle>
        <Card>
          <CardHeader><CardTitle className="text-xs">常规状态</CardTitle></CardHeader>
          <CardContent>
            <Composer value={composerVal} onChange={setComposerVal} onSend={() => {}} placeholder="描述你想拍的短片…" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs">运行中状态与冲突提示</CardTitle></CardHeader>
          <CardContent>
            <Composer value="" onChange={() => {}} onSend={() => {}} running placeholder="正在运行…" errorMessage="已有任务正在运行中（冲突）" onAbort={() => {}} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
