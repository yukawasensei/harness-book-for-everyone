import type { ServerResponse } from "node:http";
import { scrubSecrets } from "../agent/model.js";
import type { ProjectEvent } from "./protocol.js";

/** 每项目递增序号；不承诺历史重放，重连后以项目快照为准。 */
export class ProjectEvents {
  private channels = new Map<string, { sequence: number; clients: Set<ServerResponse> }>();

  private channel(id: string) {
    let channel = this.channels.get(id);
    if (!channel) {
      channel = { sequence: 0, clients: new Set() };
      this.channels.set(id, channel);
    }
    return channel;
  }

  publish(id: string, event: ProjectEvent, only?: ServerResponse) {
    const channel = this.channel(id);
    const frame = `id: ${++channel.sequence}\ndata: ${scrubSecrets(JSON.stringify(event))}\n\n`;
    for (const response of only ? [only] : channel.clients) {
      // 慢客户端断开后走快照轮询，避免无限积压文本。
      if (!response.write(frame)) response.destroy();
    }
  }

  connect(id: string, response: ServerResponse, snapshot: ProjectEvent) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    const clients = this.channel(id).clients;
    clients.add(response);
    this.publish(id, snapshot, response);
    const heartbeat = setInterval(() => {
      if (!response.write(": heartbeat\n\n")) response.destroy();
    }, 15_000);
    response.on("close", () => { clearInterval(heartbeat); clients.delete(response); });
  }

  close() {
    for (const channel of this.channels.values()) {
      for (const response of channel.clients) response.end();
    }
  }
}
