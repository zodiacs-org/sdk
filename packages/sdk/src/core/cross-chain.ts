import { runRead, type ReadOptions } from "./read-options.js";
import { getBaseZodiacsOwnership } from "./base.js";
import type { ZodiacsBasePublicClient } from "./base.js";
import { getSolanaZodiacsOwnership } from "./solana.js";
import { getCrossChainZodiacShelf } from "./identity.js";
import type {
  BaseZodiacsOwnership,
  ConnectionOrRpcUrl,
  CrossChainZodiacsOwnership,
  UnifiedZodiacShelf,
  ZodiacsOwnership
} from "./types.js";

/**
 * Optional Solana and Base inputs for concurrent ownership reads sharing a cancellation
 * deadline.
 */
export interface ZodiacHoldingsByChainParams extends ReadOptions {
  readonly solana?: {
    readonly connection: ConnectionOrRpcUrl;
    readonly ownerAddress: string;
  };
  readonly base?: {
    readonly publicClient: ZodiacsBasePublicClient;
    readonly ownerAddress: string;
  };
}

/** Ownership snapshots keyed by the chains supplied to the read. */
export interface ZodiacHoldingsByChain {
  readonly solana?: ZodiacsOwnership;
  readonly base?: BaseZodiacsOwnership;
}

/**
 * Reads configured chains concurrently. Omits unspecified chains and rejects on
 * cancellation.
 */
export async function getZodiacHoldingsByChain(
  params: ZodiacHoldingsByChainParams
): Promise<ZodiacHoldingsByChain> {
  return runRead(params, async (signal) => {
    const [solana, base] = await Promise.all([
      params.solana
        ? getSolanaZodiacsOwnership(params.solana.connection, params.solana.ownerAddress, {
            signal
          })
        : Promise.resolve(undefined),
      params.base
        ? getBaseZodiacsOwnership(params.base.publicClient, params.base.ownerAddress, { signal })
        : Promise.resolve(undefined)
    ]);

    return {
      ...(solana ? { solana } : {}),
      ...(base ? { base } : {})
    };
  });
}

/** Alias of getZodiacHoldingsByChain for concurrent public ownership reads. */
export const getCrossChainZodiacsOwnership = getZodiacHoldingsByChain;

/** Reads the configured chains and groups native and bridged holdings by sign. */
export async function getUnifiedZodiacShelf(
  params: ZodiacHoldingsByChainParams
): Promise<UnifiedZodiacShelf> {
  return getCrossChainZodiacShelf(
    (await getCrossChainZodiacsOwnership(params)) as CrossChainZodiacsOwnership
  );
}
