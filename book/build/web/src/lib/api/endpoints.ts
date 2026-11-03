import type { Stage } from "../../../../src/contracts/index.js";
import type {
  MessageResponse,
  ProjectDetail,
  ServerConfig,
  TimelineResponse,
} from "../../../../src/server/protocol.js";
import { api } from "./client.js";

export const endpoints = {
  config: () => api<ServerConfig>("/api/config"),
  projects: {
    list: (signal?: AbortSignal) => api<ProjectDetail[]>("/api/projects", undefined, signal),
    create: (body: { title?: string; message?: string }) => api<ProjectDetail>("/api/projects", body),
    get: (id: string, signal?: AbortSignal) =>
      api<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`, undefined, signal),
    patch: (id: string, body: { autopilot?: boolean; title?: string }) =>
      api<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`, body, undefined, "PATCH"),
    timeline: (id: string, signal?: AbortSignal) =>
      api<TimelineResponse>(`/api/projects/${encodeURIComponent(id)}/timeline`, undefined, signal),
    message: (id: string, text: string) =>
      api<MessageResponse>(`/api/projects/${encodeURIComponent(id)}/messages`, { text }),
    abort: (id: string) => api(`/api/projects/${encodeURIComponent(id)}/abort`, {}),
    stageVersion: (id: string, stage: Stage, version: number, signal?: AbortSignal) =>
      api<unknown>(`/api/projects/${encodeURIComponent(id)}/stages/${stage}/versions/${version}`, undefined, signal),
    run: (id: string, stage: Stage, body: unknown) =>
      api(`/api/projects/${encodeURIComponent(id)}/stages/${stage}/run`, body),
    review: (id: string, stage: Stage, operation: string, body: unknown) =>
      api(`/api/projects/${encodeURIComponent(id)}/stages/${stage}/${operation}`, body),
    rating: (id: string, stage: Stage, body: unknown) =>
      api(`/api/projects/${encodeURIComponent(id)}/stages/${stage}/rating`, body),
  },
};
