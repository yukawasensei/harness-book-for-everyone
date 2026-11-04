import type { IncomingMessage, ServerResponse } from "node:http";
import { scrubSecrets } from "../agent/model.js";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(scrubSecrets(JSON.stringify(data)));
}

export function localAllowedOrigins(host: string, webPort = process.env.WEB_PORT ?? "5173") {
  return [`http://${host}`, `http://127.0.0.1:${webPort}`, `http://localhost:${webPort}`];
}

export function guardLocalRequest(request: IncomingMessage) {
  const host = request.headers.host ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new HttpError(403, "只接受本机 Host");
  const origin = request.headers.origin;
  if (origin && !localAllowedOrigins(host).includes(origin)) throw new HttpError(403, "拒绝其他站点的请求");
}

export async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
    request.resume();
    throw new HttpError(415, "请发送 application/json");
  }
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.from(chunk);
      length += buffer.length;
      if (length > 65_536) throw new HttpError(413, "请求不能超过 64 KiB");
      chunks.push(buffer);
    }
  } catch (error) { request.resume(); throw error; }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "请求不是合法 JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "请求必须是 JSON 对象");
  return value as Record<string, unknown>;
}

/** 业务校验的文案可见；文件系统错误可能含本地路径，保持为通用错误。 */
export function validation<T>(operation: () => T): T {
  try { return operation(); }
  catch (error) {
    if (error instanceof Error && !("code" in error) && !(error instanceof SyntaxError)) {
      throw new HttpError(422, scrubSecrets(error.message));
    }
    throw error;
  }
}
