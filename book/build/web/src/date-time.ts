const localDateTime = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "numeric", day: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** 使用浏览器本地时区，固定中文年月日和24小时制；不改存储时间戳。 */
export function formatLocalDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "时间未知";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  const parts = new Map(localDateTime.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.get("year")}年${parts.get("month")}月${parts.get("day")}日 ${parts.get("hour")}:${parts.get("minute")}`;
}
