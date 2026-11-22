export function parsePriceUsd(value: unknown): number | null {
  if (typeof value === "string" && !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim()))
    return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}
