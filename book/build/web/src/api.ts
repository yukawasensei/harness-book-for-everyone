export async function api<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    ...(data === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `请求失败：${response.status}`);
  return result as T;
}
