import { useQuery } from "@tanstack/react-query";
import { endpoints, queryKeys } from "@/lib/api";

export function useConfig(enabled = true) {
  return useQuery({
    queryKey: queryKeys.config,
    enabled,
    queryFn: () => endpoints.config(),
  });
}
