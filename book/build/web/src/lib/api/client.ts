const TOKEN_KEY = "storyboard-access-token";
let accessToken = "";
try { accessToken = globalThis.sessionStorage?.getItem(TOKEN_KEY) ?? ""; } catch { /* 内存仍可连接。 */ }
export function getAccessToken() { return accessToken; }
export function setAccessToken(value: string) {
  accessToken = value;
  try { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* 存储不可用时仅留内存。 */ }
}
export function authorizationHeaders(): Record<string, string> { return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}; }
export class ApiError extends Error {
  constructor(readonly status: number, detail?: string) {
    const fallback: Record<number, string> = { 401: "请填写有效的访问令牌后连接", 403: "访问被拒绝，请检查权限或站点来源", 429: "已达到运行配额，请稍后重试" };
    super(detail ?? fallback[status] ?? `请求失败：${status}`);
  }
}

async function request(
  path: string,
  data?: unknown,
  signal?: AbortSignal,
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
): Promise<Response> {
  const verb = method ?? (data === undefined ? "GET" : "POST");
  const headers: Record<string, string> = {
    ...authorizationHeaders(),
    ...(data === undefined || verb === "GET" ? {} : { "Content-Type": "application/json" }),
  };
  const response = await fetch(path, {
    method: verb,
    headers,
    ...(data === undefined || verb === "GET" ? {} : { body: JSON.stringify(data) }),
    signal,
  });
  if (response.status === 401) throw new ApiError(401, headers.Authorization ? "令牌无效或已失效" : "未填写访问令牌");
  if (!response.ok) {
    const result = await response.json();
    throw new ApiError(response.status, result.error);
  }
  return response;
}

export async function api<T>(...args: Parameters<typeof request>): Promise<T> {
  return (await request(...args)).json() as Promise<T>;
}

export async function apiText(path: string): Promise<string> {
  return (await request(path)).text();
}

/** 仅收到服务端接收结果后，才向对话追加本次运行要求。 */
export async function submitRun(path: string, data: unknown, onAccepted: () => void) {
  await api(path, data);
  onAccepted();
}
