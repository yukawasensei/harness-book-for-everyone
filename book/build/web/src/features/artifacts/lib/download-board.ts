import { endpoints } from "@/lib/api";

export async function downloadBoard(id: string, version: number) {
  const markdown = await endpoints.projects.exportBoard(id, version);
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `board-v${version}.md`;
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
