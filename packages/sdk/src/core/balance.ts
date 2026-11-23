import { runRead } from "./read-options.js";
import { DEFAULT_ZODIAC_TOKEN_REGISTRY, getZodiacToken } from "./registry.js";
import {
  ZODIAC_SIGNS,
  type ReadZodiacsBalancesOptions,
  type ReadZodiacBalanceOptions,
  type ZodiacBalanceResult
} from "./types.js";

/**
 * Queries an injected reader for one sign. A null balance yields not-found, reader failures
 * yield unavailable, and cancellation rejects.
 */
export async function readZodiacBalance(
  options: ReadZodiacBalanceOptions
): Promise<ZodiacBalanceResult> {
  return runRead(options, (controls) => readBalance({ ...options, ...controls }));
}

async function readBalance(options: ReadZodiacBalanceOptions): Promise<ZodiacBalanceResult> {
  options.signal?.throwIfAborted();
  const registry = options.registry ?? DEFAULT_ZODIAC_TOKEN_REGISTRY;
  const token = getZodiacToken(options.sign, registry);

  try {
    const balance = await options.reader.getTokenBalance(
      options.ownerAddress,
      token.mintAddress,
      token,
      ...(options.signal ? [{ signal: options.signal }] : [])
    );

    return {
      sign: options.sign,
      token,
      balance,
      status: balance ? "available" : "not-found"
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    return {
      sign: options.sign,
      token,
      balance: null,
      status: "unavailable",
      reason: error instanceof Error ? error.message : "Balance reader failed."
    };
  }
}

/** Queries the injected reader for each sign in registry order under one deadline. */
export async function readZodiacsBalances(
  options: ReadZodiacsBalancesOptions
): Promise<readonly ZodiacBalanceResult[]> {
  return runRead(options, (controls) =>
    Promise.all(ZODIAC_SIGNS.map((sign) => readBalance({ ...options, sign, ...controls })))
  );
}
