import { useQuery } from "@tanstack/react-query";
import { endpoints, PROJECT_POLL_MS, queryKeys } from "@/lib/api";

/** 断线轮询期间与项目快照同频刷新时间线，避免对话卡落后于右栏阶段。 */
export function useTimeline(projectId: string | undefined, options?: { polling?: boolean }) {
  return useQuery({
    queryKey: queryKeys.timeline(projectId ?? ""),
    enabled: !!projectId,
    queryFn: ({ signal }) => endpoints.projects.timeline(projectId!, signal),
    refetchInterval: options?.polling ? PROJECT_POLL_MS : false,
  });
}
