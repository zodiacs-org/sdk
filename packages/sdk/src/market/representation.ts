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
  return options.chain === "base"
    ? getBaseZodiacMarket(adapter, sign, options)
    : getSolanaZodiacMarket(adapter, sign, options);
}

/** Reads a provider snapshot for the sign's official native mint. */
export async function getSolanaZodiacMarket(
  adapter: ZodiacMarketAdapter,
  sign: ZodiacSign,
  options: ReadOptions = {}
): Promise<ZodiacMarketData> {
  return getZodiacMarketByRepresentation(adapter, getSolanaZodiacRepresentation(sign), options);
}

/** Reads a provider snapshot for the sign's official bridged address. */
export async function getBaseZodiacMarket(
  adapter: ZodiacMarketAdapter,
  sign: ZodiacSign,
  options: ReadOptions = {}
): Promise<ZodiacMarketData> {
  return getZodiacMarketByRepresentation(adapter, getBaseZodiacRepresentation(sign), options);
}

/** Passes the given representation's address to the adapter as the token lookup key. */
export function getZodiacMarketByRepresentation(
  adapter: ZodiacMarketAdapter,
  representation: ZodiacRepresentation,
  { signal, timeoutMs }: ReadOptions = {}
): Promise<ZodiacMarketData> {
  const token = {
    ...getZodiacToken(representation.sign),
    mintAddress: representation.address
  };

  return readMarketSafely(adapter, {
    sign: representation.sign,
    token,
    ...(signal && { signal }),
    ...(timeoutMs !== undefined && { timeoutMs })
  });
}
