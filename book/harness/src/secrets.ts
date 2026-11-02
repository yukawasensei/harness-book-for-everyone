/** Never send credentials to logs or disk, even when a provider echoes them in an error. */
export function scrubSecrets(text: string): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return text;
  // Serialized JSON escapes quotes/backslashes; redact both representations.
  const forms = [JSON.stringify(key).slice(1, -1), key].sort((a, b) => b.length - a.length);
  for (const value of new Set(forms)) text = text.split(value).join("[REDACTED]");
  return text;
}
