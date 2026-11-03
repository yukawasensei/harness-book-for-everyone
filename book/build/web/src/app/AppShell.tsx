import { useEffect, useState, type ReactNode } from "react";
import { Menu, PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AppShell({
  header,
  left,
  center,
  right,
  hasProject = true,
  className,
  artifactsOpen: controlledArtifactsOpen,
  onArtifactsOpenChange,
}: {
  header?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  hasProject?: boolean;
  className?: string;
  artifactsOpen?: boolean;
  onArtifactsOpenChange?: (open: boolean) => void;
}) {
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [uncontrolledArtifactsOpen, setUncontrolledArtifactsOpen] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const isArtifactsOpen = controlledArtifactsOpen !== undefined ? controlledArtifactsOpen : uncontrolledArtifactsOpen;
  const setArtifactsOpen = (open: boolean) => {
    setUncontrolledArtifactsOpen(open);
    onArtifactsOpenChange?.(open);
  };

  useEffect(() => {
    if (!hasProject) {
      setRightCollapsed(false);
      setUncontrolledArtifactsOpen(false);
      onArtifactsOpenChange?.(false);
    }
  }, [hasProject, onArtifactsOpenChange]);

  return (
    <div className={cn("bg-background flex h-dvh min-h-0 min-w-0 flex-col overflow-x-hidden", className)}>
      {header}
      <div className="border-border/80 flex items-center gap-2 border-b px-3 py-2 lg:hidden">
        <Button type="button" size="sm" variant="outline" onClick={() => setSessionsOpen(true)} className="h-8 text-xs gap-1.5">
          <Menu className="size-3.5" /> 会话
        </Button>
        <div className="flex-1" />
        {hasProject && (
          <Button type="button" size="sm" variant="outline" onClick={() => setArtifactsOpen(true)} className="h-8 text-xs gap-1.5">
            <PanelRight className="size-3.5" /> 产物
          </Button>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <aside className="border-border hidden w-64 shrink-0 overflow-hidden border-r lg:block xl:w-72" aria-label="会话列表">
          {left}
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{center}</main>
        {hasProject && (
          <aside
            className={cn(
              "border-border hidden shrink-0 overflow-hidden border-l lg:flex lg:flex-col transition-all",
              rightCollapsed ? "w-12" : "w-[22rem] 2xl:w-[28rem]",
            )}
            aria-label="产物面板"
          >
            <div className="border-border flex items-center justify-end border-b px-2 py-1.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={rightCollapsed ? "展开产物栏" : "收起产物栏"}
                onClick={() => setRightCollapsed(value => !value)}
              >
                {rightCollapsed ? <PanelRight className="size-3.5" /> : <PanelRightClose className="size-3.5" />}
              </Button>
            </div>
            {!rightCollapsed && <div className="min-h-0 flex-1 overflow-y-auto">{right}</div>}
          </aside>
        )}
      </div>

      <Sheet open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <SheetContent side="left" className="flex w-[min(20rem,90vw)] flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b"><SheetTitle className="text-sm">会话</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">{left}</div>
        </SheetContent>
      </Sheet>
      {hasProject && (
        <Sheet open={isArtifactsOpen} onOpenChange={setArtifactsOpen}>
          <SheetContent side="right" className="flex w-[min(28rem,95vw)] flex-col p-0">
            <SheetHeader className="px-4 py-3 border-b"><SheetTitle className="text-sm">产物</SheetTitle></SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{right}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
