export function formatMapMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token));
}
