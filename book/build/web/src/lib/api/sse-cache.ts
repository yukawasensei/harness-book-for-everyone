import type { QueryClient } from "@tanstack/react-query";
import type { ProjectDetail, ProjectEvent, TimelineItem, TimelineResponse } from "../../../../src/server/protocol.js";
import { queryKeys } from "./query-keys.js";

/** 按 id 去重或替换；后到的条目覆盖同 id，新 id 追加到末尾。 */
export function mergeTimelineItems(current: TimelineItem[], incoming: TimelineItem[]): TimelineItem[] {
  const byId = new Map(current.map(item => [item.id, item]));
  const order = current.map(item => item.id);
  for (const item of incoming) {
    if (!byId.has(item.id)) order.push(item.id);
    byId.set(item.id, item);
  }
  return order.map(id => byId.get(id)!);
}

/** 将 SSE 事件写入 Query 缓存；组件不直接订阅 EventSource。 */
export function applyProjectEvent(client: QueryClient, projectId: string, event: ProjectEvent) {
  if (event.type === "project_state") {
    client.setQueryData(queryKeys.project(projectId), event.project);
    client.setQueryData<ProjectDetail[]>(queryKeys.projects, list =>
      list?.map(item => item.id === projectId ? event.project : item) ?? list);
    return;
  }
  if (event.type === "timeline_item") {
    client.setQueryData<TimelineResponse>(queryKeys.timeline(projectId), current => ({
      items: mergeTimelineItems(current?.items ?? [], [event.item]),
    }));
    return;
  }
  if (event.type === "run_started" || event.type === "run_ended") {
    void client.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    void client.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
  }
}

export type { TimelineItem, ProjectDetail, ProjectEvent };
