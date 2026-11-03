import { authorizationHeaders } from "./client.js";
import type { EventConnection } from "./sse.js";

/** fetch 流式 SSE 可带 Authorization；不把令牌放进 URL、日志或 Referer。 */
export function authenticatedEvents(url: string): EventConnection {
  const controller = new AbortController();
  let retry: ReturnType<typeof setTimeout> | undefined;
  const source: EventConnection = { onmessage: null, onerror: null, close() { controller.abort(); clearTimeout(retry); } };
  async function connect() {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(url, { headers: authorizationHeaders(), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("事件连接失败");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new Error("事件连接已关闭");
        buffer += decoder.decode(value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const data = frame.match(/^data: (.*)$/m)?.[1], id = frame.match(/^id: (\d+)$/m)?.[1];
          if (data && id && !controller.signal.aborted) source.onmessage?.(new MessageEvent("message", { data, lastEventId: id }));
        }
      }
    } catch {
      if (!controller.signal.aborted) { source.onerror?.(new Event("error")); retry = setTimeout(() => void connect(), 2000); }
    } finally { await reader?.cancel().catch(() => {}); }
  }
  void connect();
  return source;
}
