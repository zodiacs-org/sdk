import { runRead } from "../core/read-options.js";
import type { ZodiacMarketAdapter, ZodiacMarketData, ZodiacMarketReadOptions } from "./types.js";
import { unavailableMarketData } from "./unavailable.js";

/**
 * Runs an adapter under the requested deadline. Failures and cancellation resolve to an
 * unavailable snapshot.
 */
export async function readMarketSafely(
  adapter: ZodiacMarketAdapter,
  options: ZodiacMarketReadOptions
): Promise<ZodiacMarketData> {
  try {
    const { timeoutMs: _timeout, ...input } = options;
    return await runRead(options, (controls) => adapter.readMarket({ ...input, ...controls }));
  } catch (error) {
    return unavailableMarketData(options, adapter.id, {
      code: "adapter-error",
      message: error instanceof Error ? error.message : "Market adapter failed."
    });
  }
}

/** Apply the same read contract to direct calls on built-in network adapters. */
export function cancellableMarketAdapter(adapter: ZodiacMarketAdapter): ZodiacMarketAdapter {
  return { ...adapter, readMarket: (options) => readMarketSafely(adapter, options) };
}
