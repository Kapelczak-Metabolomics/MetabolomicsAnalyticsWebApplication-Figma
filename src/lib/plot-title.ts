/** Resolve plot title from saved analysis config with a sensible default. */
export function resolvePlotTitle(configValue: unknown, fallback: string): string {
  if (typeof configValue === "string" && configValue.trim()) return configValue.trim();
  return fallback;
}
