import type { ZodiacMarketAdapter } from "./types.js";
import { unavailableMarketData } from "./unavailable.js";

/** Returns a local adapter that always reports not-configured with the supplied message. */
export function createPlaceholderMarketAdapter(
  message = "Market data is not configured."
): ZodiacMarketAdapter {
  return {
    id: "placeholder",
    readMarket: async (options) =>
      unavailableMarketData(options, "placeholder", {
        code: "not-configured",
        message
      })
  };
}
