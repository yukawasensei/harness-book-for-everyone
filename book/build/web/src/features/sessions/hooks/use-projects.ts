import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints, queryKeys } from "@/lib/api";

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: ({ signal }) => endpoints.projects.list(signal) });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; message?: string }) => endpoints.projects.create(body),
    onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.projects }); },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(id ?? ""),
    enabled: !!id,
    queryFn: ({ signal }) => endpoints.projects.get(id!, signal),
  });
}
