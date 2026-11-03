import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ServerConfig } from "../../../../../src/server/protocol.js";
import { ApiError, endpoints, queryKeys } from "@/lib/api";
import { rememberSelectedProject, restoreSelectedProject } from "../lib/project-selection.js";
import { readerMessage } from "@/features/artifacts";
import { useProjects } from "./use-projects";

const errorMessage = (error: unknown) => error instanceof Error ? readerMessage(error.message) : "操作失败";

/** 顶栏会话列表、鉴权与新建任务。项目列表走 Query，以便 SSE 写入后左侧进度同步。 */
export function useStudioSession() {
  const client = useQueryClient();
  const projectsQuery = useProjects();
  const restoredRef = useRef(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);
  const [id, setId] = useState("");
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const projects = projectsQuery.data;

  useEffect(() => {
    const controller = new AbortController();
    void endpoints.config().then(settings => {
      if (controller.signal.aborted) return;
      setAuthRequired(settings.deployment === "hosted");
      setConfig(settings);
      client.setQueryData(queryKeys.config, settings);
    }).catch(err => {
      if (!controller.signal.aborted) {
        setError(errorMessage(err));
        if (err instanceof ApiError && err.status === 401) setAuthRequired(true);
      }
    });
    return () => controller.abort();
  }, [authRevision, client]);

  useEffect(() => {
    if (projectsQuery.isError && projectsQuery.error) {
      setError(errorMessage(projectsQuery.error));
      if (projectsQuery.error instanceof ApiError && projectsQuery.error.status === 401) {
        setAuthRequired(true);
      }
    }
  }, [projectsQuery.isError, projectsQuery.error]);

  useEffect(() => {
    if (restoredRef.current || !projects?.length) return;
    restoredRef.current = true;
    const restored = restoreSelectedProject(projects);
    if (restored) setId(restored);
  }, [projects]);

  useEffect(() => {
    if (id && projects?.length && !projects.some(project => project.id === id)) {
      setId("");
    }
  }, [id, projects]);

  useEffect(() => {
    if (id) rememberSelectedProject(id);
  }, [id]);

  async function create(message?: string) {
    setCreating(true); setError("");
    try {
      const text = message?.trim();
      const body = text ? { title: text.slice(0, 20), message: text } : { title: "新任务" };
      const project = await endpoints.projects.create(body);
      client.setQueryData(queryKeys.projects, (list: typeof projects | undefined) =>
        list ? [...list.filter(item => item.id !== project.id), project] : [project]);
      setId(project.id);
      void client.invalidateQueries({ queryKey: queryKeys.projects });
      return project;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setCreating(false);
    }
  }

  function reconnect() {
    setId(""); setConfig(null); setError("");
    void client.resetQueries({ queryKey: queryKeys.projects });
    setAuthRevision(value => value + 1);
  }

  return {
    authRequired, authRevision, projects: projects ?? [], id, setId,
    config, error, creating, create, reconnect,
  };
}
