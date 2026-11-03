import { authenticate, hostingFromEnv, publicData, TenantQuota, validateHosting, type HostingOptions } from "./hosting.js";
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
  hosting?: HostingOptions;
}

/** 工厂不会监听端口。local 固定 loopback；hosted 使用显式监听配置。 */
export function createLocalServer(options: ServerOptions) {
  const hosting = options.hosting ?? hostingFromEnv();
  validateHosting(hosting);
  const hosted = hosting.mode === "hosted";
  if (hosted && options.store) throw new Error("hosted 必须使用按用户分区的 ProjectStore");
  const sanitize = (data: unknown) => hosted ? publicData(data, options.root, Object.values(hosting.tokens!)) : data;
  const contexts = new Map<string, { store: ProjectStore; events: ProjectEvents; runs: StageRuns; quota?: TenantQuota }>();
  function context(user: string) {
    let value = contexts.get(user);
    if (!value) {
      const store = hosted ? new ProjectStore(options.root, user) : options.store ?? new ProjectStore(options.root);
      const quota = hosted ? new TenantQuota(options.root, user, hosting) : undefined;
      const events = new ProjectEvents(sanitize);
      const runs = new StageRuns(options.root, store, events, options.sessionFactory, quota ? (id, stage) => quota.reserve(id, stage) : undefined);
      value = { store, events, runs, quota }; contexts.set(user, value);
    }
    return value;
  }
  if (!hosted) context("local");
  const server = createServer((request, response) => {
    const send = (status: number, data: unknown) => json(response, status, sanitize(data));
    void route().catch(error => {
      if (response.headersSent) { response.end(); return; }
      if (error instanceof HttpError) send(error.status, { error: error.message });
      else send(500, { error: "服务内部错误，请检查本地项目与会话记录" });
    });
    async function route() {
      if (!hosted) guardLocalRequest(request);
      else if (request.headers.origin && request.headers.origin !== hosting.origin) throw new HttpError(403, "拒绝其他站点的请求，请检查站点来源配置");
      const user = hosted ? authenticate(request, hosting) : "local";
      const { store, events, runs, quota } = context(user);
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      let parts: string[];
      try { parts = url.pathname.split("/").filter(Boolean).map(part => decodeURIComponent(part)); }
      catch { throw new HttpError(400, "路径编码不合法"); }
      const method = request.method;
      if (method === "GET" && url.pathname === "/api/config") {
        return send(200, {
          mode: options.demo ? "demo" : "model",
          deployment: hosting.mode, user_id: hosted ? user : undefined,
          runnable_stages: Object.keys(STAGE_PROMPTS).filter(stage => STAGE_PROMPTS[stage as Stage] !== null),
        });
      }
      if (url.pathname === "/api/quota" && method === "GET" && quota) return send(200, quota.snapshot());
      if (url.pathname === "/api/projects") {
        if (method === "GET") return send(200, store.list().map(project => runs.detail(project.id)));
        if (method === "POST") {
          const input = await body(request);
          if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 200) {
            throw new HttpError(400, "项目标题需为 1–200 字文本");
          }
          return send(201, runs.detail(store.create(input.title).id));
        }
      }
      if (parts[0] !== "api" || parts[1] !== "projects" || !parts[2]) throw new HttpError(404, "接口不存在");
      const id = parts[2];
      validation(() => store.projectDir(id));
      try { store.load(id); }
      catch (error) {
        if (error instanceof Error && error.message.startsWith("项目不存在：")) throw new HttpError(404, hosted ? "项目不存在" : error.message);
        throw error;
      }
      if (parts.length === 4 && parts[3] === "ratings" && method === "GET") return send(200, store.exportRatings(id));
      if (parts.length === 3 && method === "GET") return send(200, runs.detail(id));
      if (parts.length === 4 && parts[3] === "events" && method === "GET") {
        events.connect(id, response, { type: "project_state", project: runs.detail(id) });
        return;
      }
      if (parts.length === 4 && parts[3] === "abort" && method === "POST") {
        await body(request);
        return send(202, runs.abort(id));
      }
      if (parts.length >= 6 && parts[3] === "stages") {
        const stage = validation(() => parseStage(parts[4]));
        if (parts.length === 6 && parts[5] === "rating" && method === "POST") {
          const input = await body(request); runs.assertIdle(id);
          if (typeof input.version !== "number" || !Number.isSafeInteger(input.version)) throw new HttpError(400, "评分版本号必须为整数");
          validation(() => store.saveRating(id, stage, input.version as number, { scores: input.scores, note: input.note }));
          runs.notify(id); return send(200, runs.detail(id));
        }
        if (parts.length === 6 && parts[5] === "run" && method === "POST") {
          const input = await body(request);
          const instructions = input.instructions ?? "";
          if (typeof instructions !== "string" || instructions.length > 8000) throw new HttpError(400, "补充要求需为最多 8000 字文本");
          const reviseFrom = input.revise_from;
          if (reviseFrom !== undefined && (typeof reviseFrom !== "number" || !Number.isSafeInteger(reviseFrom) || reviseFrom < 1)) {
            throw new HttpError(400, "revise_from 必须为正整数版本号");
          }
          if (input.staging !== undefined && input.staging !== "resume" && input.staging !== "restart") throw new HttpError(400, "暂存选择必须是 resume 或 restart");
          return send(202, await runs.start(id, stage, instructions, reviseFrom as number | undefined, { confirmed: input.confirmed === true, staging: input.staging as "resume" | "restart" | undefined }));
        }
        if (parts.length === 6 && ["confirm-valid", "reassemble"].includes(parts[5]) && method === "POST") {
          const input = await body(request); runs.assertIdle(id);
          validation(() => {
            if (parts[5] === "reassemble") {
              if (stage !== "prompts") throw new Error("只有提示词阶段可重新拼装");
              store.reassemblePrompts(id, input.confirmed === true);
            } else {
              if (typeof input.reason !== "string" || input.reason.length > 8000) throw new Error("请填写最多 8000 字的理由");
              store.confirmValid(id, stage, input.reason, input.confirmed === true);
            }
          });
          runs.notify(id); return send(200, runs.detail(id));
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
            if (parts[5] === "adopt") store.adopt(id, stage, version, input.confirmed === true);
            else if (parts[5] === "discard") store.discard(id, stage, version, note as string | undefined);
            else store.requestChanges(id, stage, version, note as string);
          });
          runs.notify(id);
          return send(200, runs.detail(id));
        }
        if (parts.length === 7 && parts[5] === "versions" && method === "GET") {
          if (!/^[1-9][0-9]*$/.test(parts[6])) throw new HttpError(400, "版本号必须为正整数");
          return send(200, validation(() => store.readVersion(id, stage, Number(parts[6]))));
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
        server.listen(port, hosted ? hosting.host ?? "127.0.0.1" : "127.0.0.1", () => { server.off("error", reject); resolve(); });
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("服务监听失败");
      return `http://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`;
    },
    async close() {
      const closed = new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      await Promise.all([...contexts.values()].map(async ({ runs, events }) => { await runs.close(); events.close(); }));
      server.closeIdleConnections();
      await closed;
    },
  };
}
