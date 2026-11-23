import type { ReadOptions } from "../core/read-options.js";
import type { ZodiacSign, ZodiacToken } from "../core/index.js";

/** Whether a provider supplied a usable snapshot. */
export type MarketDataStatus = "ok" | "unavailable";

/** Machine-readable reason and message for an unavailable market snapshot. */
export interface MarketDataError {
  readonly code:
    | "not-configured"
    | "no-market"
    | "http-error"
    | "invalid-response"
    | "adapter-error";
  readonly message: string;
}

/** Provider snapshot with USD price, optional metrics and an ISO timestamp when available. */
export interface MarketSnapshot {
  readonly sign: ZodiacSign;
  readonly token: ZodiacToken;
  readonly priceUsd: number | null;
  readonly marketCap: number | null;
  readonly fdv: number | null;
  readonly liquidity: number | null;
  readonly volume24h: number | null;
  readonly change24h: number | null;
  readonly supply: number | null;
  readonly source: string;
  readonly lastUpdated: string | null;
  readonly status: MarketDataStatus;
  readonly error?: MarketDataError;
}

/** Requested sign, token address and optional controls for a provider read. */
export interface MarketDataReadOptions extends ReadOptions {
  readonly sign: ZodiacSign;
  readonly token: ZodiacToken;
}

/** Named provider implementing a read-only snapshot request. */
export interface MarketDataAdapter {
  readonly id: string;
  readonly readMarket: (options: MarketDataReadOptions) => Promise<MarketSnapshot>;
}

/** Overrides the built-in provider endpoint or fetch implementation. */
export interface MarketAdapterConfig {
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
}

/** Compatibility name for MarketDataStatus. */
export type ZodiacMarketStatus = MarketDataStatus;
/** Compatibility name for MarketSnapshot. */
export type ZodiacMarketData = MarketSnapshot;
/** Compatibility name for MarketDataReadOptions. */
export type ZodiacMarketReadOptions = MarketDataReadOptions;
/** Compatibility name for MarketDataAdapter. */
export type ZodiacMarketAdapter = MarketDataAdapter;
