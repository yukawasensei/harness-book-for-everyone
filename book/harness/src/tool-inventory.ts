import type { AgentSession } from "@earendil-works/pi-coding-agent";

export async function injectToolInventory(session: AgentSession, enabled = true) {
  if (!enabled) return;
  await session.sendCustomMessage({
    customType: "harness_tool_inventory",
    content: `Actual available tools / 本次实际可用工具: ${session.getActiveToolNames().join(", ") || "(none)"}. These tools are callable in this run; use their declared schemas. 本次可直接调用这些工具，参数须遵守工具 schema。`,
    display: false,
  }, { triggerTurn: false });
}
