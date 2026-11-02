// 离线模型替身：按脚本逐轮返回 assistant 消息，并记录每次发给"模型"的 TranscriptContext。
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
  type TranscriptContext,
  type JsonObject,
} from "@earendil-works/pi-ai";

export type Turn = { text: string } | { call: string; args: JsonObject };

export function fakeStream(model: Model<any>, script: Turn[]) {
  const contexts: TranscriptContext[] = [];
  let i = 0;
  const fn = (_m: Model<any>, context: TranscriptContext) => {
    contexts.push(structuredClone(context));
    const turn = script[i] ?? { text: "done" };
    i += 1;
    const isCall = "call" in turn;
    const message: AssistantMessage = {
      role: "assistant", api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
      stopReason: isCall ? "toolUse" : "stop",
      content: isCall ? [{ type: "toolCall", id: `call_${i}`, name: turn.call, arguments: turn.args }] : [{ type: "text", text: turn.text }],
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: message });
    if (!isCall) { // 文本响应也发流式 delta，覆盖 message_update 事件
      stream.push({ type: "text_start", contentIndex: 0, partial: message });
      stream.push({ type: "text_delta", contentIndex: 0, delta: turn.text, partial: message });
      stream.push({ type: "text_end", contentIndex: 0, content: turn.text, partial: message });
    }
    stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
    return stream;
  };
  return { fn, contexts };
}
