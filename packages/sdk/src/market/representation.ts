import type { ReadOptions } from "../core/read-options.js";
import {
  getBaseZodiacRepresentation,
  getSolanaZodiacRepresentation,
  getZodiacToken,
  type ZodiacChain,
  type ZodiacRepresentation,
  type ZodiacSign
} from "../core/index.js";
import type { ZodiacMarketAdapter, ZodiacMarketData } from "./types.js";
import { readMarketSafely } from "./safe-read.js";

/** Reads the official address for the requested chain. Defaults to Solana. */
export async function getZodiacMarket(
  adapter: ZodiacMarketAdapter,
  sign: ZodiacSign,
  options: ReadOptions & { readonly chain?: ZodiacChain } = {}
): Promise<ZodiacMarketData> {
  const representation =
    options.chain === "base"
      ? getBaseZodiacRepresentation(sign)
      : getSolanaZodiacRepresentation(sign);

  return getZodiacMarketByRepresentation(adapter, representation, options);
}

/** Reads a provider snapshot for the sign's official native mint. */
export function getSolanaZodiacMarket(
  adapter: ZodiacMarketAdapter,
  sign: ZodiacSign,
  options: ReadOptions = {}
): Promise<ZodiacMarketData> {
  return getZodiacMarket(adapter, sign, { ...options, chain: "solana" });
}

/** Reads a provider snapshot for the sign's official bridged address. */
export function getBaseZodiacMarket(
  adapter: ZodiacMarketAdapter,
  sign: ZodiacSign,
  options: ReadOptions = {}
): Promise<ZodiacMarketData> {
  return getZodiacMarket(adapter, sign, { ...options, chain: "base" });
}

/** Passes the given representation's address to the adapter as the token lookup key. */
export function getZodiacMarketByRepresentation(
  adapter: ZodiacMarketAdapter,
  representation: ZodiacRepresentation,
  options: ReadOptions = {}
): Promise<ZodiacMarketData> {
  const token = {
    ...getZodiacToken(representation.sign),
    mintAddress: representation.address
  };

  return readMarketSafely(adapter, {
    sign: representation.sign,
    token,
    ...options
  });
}
