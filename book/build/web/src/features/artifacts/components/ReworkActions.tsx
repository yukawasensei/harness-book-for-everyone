import { Button } from "@/components/ui/button";

/** SSR / 旧入口仍渲染三选一操作文案；面板内主入口已迁到 MoreActionsMenu。 */
export function ReworkActions({
  busy,
  runReason,
  reassembleReason,
  onRun,
  onConfirmValid,
  onReassemble,
}: {
  busy: boolean;
  runReason: string | null;
  reassembleReason: string | null;
  onRun: () => void;
  onConfirmValid: () => void;
  onReassemble: () => void;
}) {
  const busyReason = busy ? "项目正在运行或提交操作，请稍候。" : null;
  const choices = [
    { label: "返工运行", description: "使用当前上游重新创作，生成新版本。", reason: busyReason ?? runReason, action: onRun },
    { label: "确认仍然有效", description: "填写理由，保留内容并更新来源。", reason: busyReason ?? runReason, action: onConfirmValid },
    { label: "重新拼装", description: "沿用镜头部分、更新固定设定，不调用模型。", reason: busyReason ?? reassembleReason, action: onReassemble },
  ];
  return (
    <section className="space-y-2 text-xs" aria-label="待更新处理方式">
      {choices.map(choice => (
        <div key={choice.label} className="rounded-md border border-border/80 p-2.5 space-y-1">
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={Boolean(choice.reason)}
            title={choice.reason ?? choice.description}
            onClick={choice.action}
          >
            {choice.label}
          </Button>
          <p className="text-muted-foreground">{choice.description}</p>
          {choice.reason && <p className="text-muted-foreground">{choice.reason}</p>}
        </div>
      ))}
    </section>
  );
}
