import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endpoints, queryKeys } from "@/lib/api";

export function useAutopilot(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (autopilot: boolean) => endpoints.projects.patch(projectId, { autopilot }),
    onSuccess: project => {
      client.setQueryData(queryKeys.project(projectId), project);
      void client.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
