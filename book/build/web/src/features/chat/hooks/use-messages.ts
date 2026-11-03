import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endpoints, queryKeys } from "@/lib/api";

export function useSendMessage(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => endpoints.projects.message(projectId, text),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
      void client.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}
