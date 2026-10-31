/** Parse EVAL_ALLOWED_TOOLS / ALLOWED_TOOLS env into a non-empty string[]. */

export function parseAllowedTools(
  raw: string | undefined,
  defaultTools: string[] = ["read"],
): string[] {
  if (raw === undefined || raw.trim() === "") {
    return [...defaultTools];
  }
  const tools = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (tools.length === 0) {
    throw new Error("ALLOWED_TOOLS must list at least one tool name");
  }
  return tools;
}
