import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccessToken, setAccessToken } from "@/lib/api";

export function TokenGate({
  userId, onConnected, error,
}: {
  userId?: string;
  onConnected: () => void;
  error?: string;
}) {
  const [token, setToken] = useState(getAccessToken);
  function connect(event: FormEvent) {
    event.preventDefault();
    if (!token.trim()) return;
    setAccessToken(token.trim());
    setToken("");
    onConnected();
  }
  return (
    <form onSubmit={connect} className="border-border bg-card flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <label className="text-sm">访问令牌
        <Input aria-label="访问令牌" type="password" autoComplete="off" value={token}
          onChange={e => setToken(e.target.value)} placeholder="输入访问令牌" className="ml-2 inline-flex w-56" />
      </label>
      <Button type="submit">连接用户</Button>
      {userId && <span className="text-muted-foreground text-sm">当前用户：{userId}</span>}
      <span className="text-muted-foreground text-xs">令牌仅在当前标签页会话保存</span>
      {error && <p className="text-destructive w-full text-sm" role="alert">{error}</p>}
    </form>
  );
}
