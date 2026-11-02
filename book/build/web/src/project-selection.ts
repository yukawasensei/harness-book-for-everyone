import { STAGES, type Stage } from "../../src/contracts/index.js";

const selectionKey = "storyboard-studio.selected-project";
type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;
const browserStorage: StorageAccess = () => window.localStorage;

export function restoreSelectedProject(projects: readonly { id: string }[], access: StorageAccess = browserStorage): string {
  try {
    const saved = access().getItem(selectionKey);
    if (projects.some(project => project.id === saved)) return saved!;
  } catch { /* 隐私模式或存储被禁用时，仍能使用项目列表。 */ }
  return projects[0]?.id ?? "";
}

export function rememberSelectedProject(id: string, access: StorageAccess = browserStorage): void {
  if (!id) return;
  try { access().setItem(selectionKey, id); }
  catch { /* 存储不可用或已满，不影响选择项目。 */ }
}
export function restoreSelectedStage(id: string, access: StorageAccess = browserStorage): Stage {
  try {
    const saved = access().getItem(`${selectionKey}.stage.${id}`);
    if (STAGES.includes(saved as Stage)) return saved as Stage;
  } catch { /* 存储不可用时从选题开始。 */ }
  return "topic";
}

export function rememberSelectedStage(id: string, stage: Stage, access: StorageAccess = browserStorage): void {
  if (!id || !STAGES.includes(stage)) return;
  try { access().setItem(`${selectionKey}.stage.${id}`, stage); }
  catch { /* 存储不可用不影响阶段操作。 */ }
}
