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
