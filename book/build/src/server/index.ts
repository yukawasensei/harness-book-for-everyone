import { createServer } from "node:http";
import { ProjectStore } from "../project/store.js";
import { parseStage } from "../contracts/index.js";
import { STAGE_PROMPTS } from "../agent/prompts.js";
import type { Stage } from "../contracts/index.js";
import { ProjectEvents } from "./events.js";
import { body, guardLocalRequest, HttpError, json, validation } from "./http.js";
import { StageRuns, type SessionFactory } from "./runs.js";

export interface ServerOptions {
  root: string;
  store?: ProjectStore;
  sessionFactory?: SessionFactory;
  demo?: boolean;
}

/** 工厂不会监听端口。生产入口和测试统一通过 listen 绑定 loopback。 */
export function createLocalServer(options: ServerOptions) {
  const store = options.store ?? new ProjectStore(options.root);
  const events = new ProjectEvents();
  const runs = new StageRuns(options.root, store, events, options.sessionFactory);
  const server = createServer((request, response) => {
    void route().catch(error => {
      if (response.headersSent) { response.end(); return; }
      if (error instanceof HttpError) json(response, error.status, { error: error.message });
      else json(response, 500, { error: "服务内部错误，请检查本地项目与会话记录" });
    });
    async function route() {
      guardLocalRequest(request);
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const parts = url.pathname.split("/").filter(Boolean);
      const method = request.method;
      if (method === "GET" && url.pathname === "/api/config") {
        return json(response, 200, {
          mode: options.demo ? "demo" : "model",
          runnable_stages: Object.keys(STAGE_PROMPTS).filter(stage => STAGE_PROMPTS[stage as Stage] !== null),
        });
      }
      if (url.pathname === "/api/projects") {
        if (method === "GET") return json(response, 200, store.list().map(project => runs.detail(project.id)));
        if (method === "POST") {
          const input = await body(request);
          if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 200) {
            throw new HttpError(400, "项目标题需为 1–200 字文本");
          }
          return json(response, 201, runs.detail(store.create(input.title).id));
        }
      }
      if (parts[0] !== "api" || parts[1] !== "projects" || !parts[2]) throw new HttpError(404, "接口不存在");
      const id = parts[2];
      validation(() => store.projectDir(id));
      try { store.load(id); }
      catch (error) {
        if (error instanceof Error && error.message.startsWith("项目不存在：")) throw new HttpError(404, error.message);
        throw error;
      }
      if (parts.length === 3 && method === "GET") return json(response, 200, runs.detail(id));
      if (parts.length === 4 && parts[3] === "events" && method === "GET") {
        events.connect(id, response, { type: "project_state", project: runs.detail(id) });
        return;
      }
      if (parts.length === 4 && parts[3] === "abort" && method === "POST") {
        await body(request);
        return json(response, 202, runs.abort(id));
      }
      if (parts.length >= 6 && parts[3] === "stages") {
        const stage = validation(() => parseStage(parts[4]));
        if (parts.length === 6 && parts[5] === "run" && method === "POST") {
          const input = await body(request);
          const instructions = input.instructions ?? "";
          if (typeof instructions !== "string" || instructions.length > 8000) throw new HttpError(400, "补充要求需为最多 8000 字文本");
          const reviseFrom = input.revise_from;
          if (reviseFrom !== undefined && (typeof reviseFrom !== "number" || !Number.isSafeInteger(reviseFrom) || reviseFrom < 1)) {
            throw new HttpError(400, "revise_from 必须为正整数版本号");
          }
          return json(response, 202, await runs.start(id, stage, instructions, reviseFrom as number | undefined));
        }
        if (parts.length === 6 && ["adopt", "discard", "request-changes"].includes(parts[5]) && method === "POST") {
          const input = await body(request);
          runs.assertIdle(id);
          if (typeof input.version !== "number" || !Number.isSafeInteger(input.version) || input.version < 1) {
            throw new HttpError(400, "版本号必须为正整数");
          }
          const note = input.note;
          if (note !== undefined && (typeof note !== "string" || note.length > 8000)) throw new HttpError(400, "审阅意见需为最多 8000 字文本");
          if (parts[5] === "request-changes" && (typeof note !== "string" || !note.trim())) throw new HttpError(400, "修改意见不能为空");
          validation(() => {
            const version = input.version as number;
            if (parts[5] === "adopt") store.adopt(id, stage, version);
            else if (parts[5] === "discard") store.discard(id, stage, version, note as string | undefined);
            else store.requestChanges(id, stage, version, note as string);
          });
          runs.notify(id);
          return json(response, 200, runs.detail(id));
        }
        if (parts.length === 7 && parts[5] === "versions" && method === "GET") {
          if (!/^[1-9][0-9]*$/.test(parts[6])) throw new HttpError(400, "版本号必须为正整数");
          return json(response, 200, validation(() => store.readVersion(id, stage, Number(parts[6]))));
        }
      }
      throw new HttpError(404, "接口不存在");
    }
  });
  return {
    server,
    async listen(port = 3001) {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("服务监听失败");
      return `http://127.0.0.1:${address.port}`;
    },
    async close() {
      const closed = new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      await runs.close();
      events.close();
      server.closeIdleConnections();
      await closed;
    },
  };
}
