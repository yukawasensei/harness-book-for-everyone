import { useState } from "react";
import type { Stage } from "../../src/contracts/index.js";
import { stageNames } from "./presentation";

const STEPS = [
  { title: "运行这一道", body: "在下方写补充要求（可留空），点「运行阶段」。" },
  { title: "看 AI 的稿", body: "右侧会出现草稿，先读完再决定。" },
  { title: "采用 / 丢弃 / 要求修改", body: "点「采用」后，下一道才会解锁。" },
] as const;

const PIPELINE: Stage[] = ["topic", "synopsis", "script", "bible", "storyboard", "prompts"];

export const PIPELINE_LINE = "六道工序：选题 → 梗概 → 剧本 → 设定集 → 分镜脚本 → 分镜提示词";

type Layout = "hero" | "sidebar";

/** 首次进入主区域的引导；有进度后收成可展开的「怎么用」。 */
export function GettingStarted({
  compact = false,
  layout = "sidebar",
}: {
  compact?: boolean;
  layout?: Layout;
}) {
  const [open, setOpen] = useState(!compact);
  if (compact) {
    return (
      <details className="getting-started compact" open={open} onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary>怎么用</summary>
        <SidebarGuide />
      </details>
    );
  }
  if (layout === "hero") {
    return (
      <section className="getting-started hero" aria-label="怎么用分镜工坊">
        <header className="getting-started-header">
          <span className="getting-started-badge">新手必读</span>
          <h2>分镜工坊怎么用？</h2>
          <p className="getting-started-subtitle">三步搞懂人机协同：AI 逐道工序出草稿，你来把关审阅，确认采用后下一道才会解锁。</p>
        </header>
        <PipelineFlow />
        <div className="guide-steps" role="list" aria-label="使用步骤">
          {STEPS.map((step, index) => (
            <div className="guide-step-card" role="listitem" key={step.title}>
              <div className="step-badge">步骤 {index + 1}</div>
              <div className="step-content">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="guide-action-tip"><strong>开始使用：</strong>在上方输入项目名称并点击【新建项目】，即可从第 1 道「选题」开启创作。</p>
      </section>
    );
  }
  return (
    <section className="getting-started" aria-label="怎么用分镜工坊">
      <h2>怎么用分镜工坊</h2>
      <SidebarGuide />
    </section>
  );
}

function SidebarGuide() {
  return (
    <>
      <ol className="getting-started-steps">
        {STEPS.map(step => <li key={step.title}><strong>{step.title}</strong>：{step.body}</li>)}
      </ol>
      <p className="getting-started-pipeline">{PIPELINE_LINE}</p>
    </>
  );
}

function PipelineFlow() {
  return (
    <div className="pipeline-flow-container">
      <div className="pipeline-label">六道工序：</div>
      <div className="pipeline-flow" role="list" aria-label="六道工序流程">
        {PIPELINE.map((stage, index) => (
          <span key={stage} className="pipeline-flow-item">
            <span className="pipeline-step" role="listitem">
              <span className="step-num">{index + 1}</span>
              <span className="step-name">{stageNames[stage]}</span>
            </span>
            {index < PIPELINE.length - 1 && <span className="pipeline-arrow" aria-hidden="true">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
