import { Value } from 'typebox/value';
import type { TSchema } from 'typebox';

export interface ArgumentStats { coerced_args: number }
type Shape = { type?: string; properties?: Record<string, Shape>; items?: Shape; anyOf?: Shape[]; const?: unknown };
const labels: Record<string, string> = { object: '对象(object)', array: '数组(array)', string: '字符串(string)', number: '数字(number)', integer: '整数(integer)', boolean: '布尔值(boolean)', null: '空值(null)', undefined: '缺失(undefined)' };
const actualType = (value: unknown) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const pathParts = (pointer: string) => pointer.split('/').slice(1).map(p => p.replaceAll('~1', '/').replaceAll('~0', '~'));
const exampleValue = (type: string) => type === 'array' ? [] : type === 'object' ? {} : ['number', 'integer'].includes(type) ? 3 : type === 'boolean' ? true : '示例文字';

/** 只用字面量判别字段选择 union 分支，不做业务类型推断或默认值填充。 */
function branch(schema: Shape, value: unknown): Shape {
  if (!schema.anyOf) return schema;
  const object = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  return schema.anyOf.find(candidate => Object.entries(candidate.properties ?? {}).some(([key, child]) =>
    child.const !== undefined && child.const === object[key])) ?? schema.anyOf[0];
}
function valueAt(value: unknown, parts: string[]): unknown {
  return parts.reduce<unknown>((current, key) => current !== null && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, value);
}
function typeAdvice(path: string, expected: string, value: unknown, reason = ''): string {
  const numeric = ['number', 'integer'].includes(expected) && typeof value === 'string' ? '数字字符串不自动转换，请去掉数字外的引号。' : '';
  return `参数 ${path}：期望 ${labels[expected] ?? expected}，实际 ${labels[actualType(value)] ?? actualType(value)}${reason}；${numeric}正确示例（此处的值）：${JSON.stringify(exampleValue(expected))}。保留其余必填字段。`;
}

/** 仅在契约要求对象/数组的位置解码一次；原始调用参数不改写，文字与数字不转换。 */
function decode(value: unknown, inputSchema: Shape, path: string, stats: ArgumentStats): unknown {
  let schema = branch(inputSchema, value);
  const expected = schema.type;
  if (expected !== 'object' && expected !== 'array') return value;
  if (typeof value === 'string') {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw new Error(typeAdvice(path, expected, value, '，但不是合法 JSON；请检查双引号、逗号和括号')); }
    stats.coerced_args += 1; // 解码后即计数，即使随后被 schema 或业务规则拒绝。
    value = parsed;
    schema = branch(inputSchema, value);
  }
  if (actualType(value) !== expected) throw new Error(typeAdvice(path, expected, value));
  if (expected === 'array') return (value as unknown[]).map((item, index) => schema.items ? decode(item, schema.items, `${path}.${index}`, stats) : item);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key, schema.properties?.[key] ? decode(item, schema.properties[key], `${path}.${key}`, stats) : item,
  ]));
}

/** schema 不变：先解码传输表示，再给模型可修正的错误；存储层仍复核全部业务闸门。 */
export function decodeToolArgument(value: unknown, schema: TSchema, parameter: string, label: string, stats: ArgumentStats): unknown {
  const decoded = decode(value, schema as Shape, parameter, stats);
  const errors = Value.Errors(schema, decoded);
  if (!errors.length) return decoded;
  const advice = errors.slice(0, 6).map(error => {
    const path = [parameter, ...pathParts(error.instancePath)].join('.');
    const current = valueAt(decoded, pathParts(error.instancePath));
    if (error.keyword === 'type') return typeAdvice(path, String(error.params.type), current);
    if (error.keyword === 'required') {
      const keys = error.params.requiredProperties as string[];
      return `参数 ${path}：期望 含必填字段 ${keys.join('、')} 的对象，实际 ${labels[actualType(current)]} 缺少这些字段；正确示例（参数形态）：${JSON.stringify({ [parameter]: {} })}，请在该对象内补齐上述字段，不要使用扁平参数或点号键。`;
    }
    return `参数 ${path}：期望 满足契约规则（${error.message}），实际 ${labels[actualType(current)]} 未满足规则；正确示例请按工具描述中的完整阶段契约与采用上游填写。`;
  });
  // 保留结构化路径和原始约束，兼容现有错误展示；中文建议直接返回模型。
  throw new Error(`${label} schema 不合规：${errors.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ')}\n${advice.join('\n')}`);
}
