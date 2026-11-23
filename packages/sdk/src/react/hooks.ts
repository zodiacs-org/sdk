import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCompatibilityContext,
  getCrossChainZodiacsOwnership,
  getBaseZodiacBalance,
  getBaseZodiacsOwnership,
  getIdentityReceiptData,
  getCurrentZodiacSeason,
  getRepresentationByAddress,
  getSolanaZodiacsOwnership,
  getZodiacAsset,
  getZodiacIdentityContext,
  getZodiacMetadata,
  getZodiacToken,
  getZodiacWheelData,
  getZodiacsRegistry,
  isOfficialZodiacAddress,
  readZodiacBalance,
  type BaseZodiacsReadOptions,
  type ReadOptions,
  type SolanaZodiacsReadOptions,
  type ZodiacHoldingsByChainParams,
  type BaseZodiacBalance,
  type BaseZodiacsOwnership,
  type ZodiacCompatibilityContext,
  type ConnectionOrRpcUrl,
  type IdentityReceiptData,
  type IdentityReceiptDataOptions,
  type CrossChainZodiacsOwnership,
  type ZodiacsOwnership,
  type ZodiacAddressLookupOptions,
  type ZodiacAsset,
  type ZodiacBalanceResult,
  type ZodiacIdentityContext,
  type ZodiacIdentityContextOptions,
  type ZodiacIdentityOwnershipInput,
  type ZodiacMetadata,
  type ZodiacRepresentation,
  type ZodiacSeason,
  type ZodiacSign,
  type ZodiacToken,
  type ZodiacWheelData,
  type ZodiacsBasePublicClient,
  type ZodiacsRegistry
} from "../core/index.js";
import { useZodiacs } from "./context.js";

const balanceReaderNotConfiguredMessage =
  "Balance reader is not configured. Provide rpcUrl or balanceReader to ZodiacsProvider.";

/** Bundled symbolic metadata paired with the provider registry's token definition. */
export interface UseZodiacTokenResult {
  readonly metadata: ZodiacMetadata;
  readonly token: ZodiacToken;
}

/** Current data, error and loading state plus a callback to repeat the read. */
export interface AsyncHookState<T> {
  readonly data: T | null;
  readonly error: Error | null;
  readonly loading: boolean;
  readonly refetch: () => void;
}

/** Legacy market hook options, retained for callers of the inactive hook. */
export interface UseZodiacMarketOptions {
  readonly enabled?: boolean;
}

/** Legacy unavailable response shape for the inactive market hook. */
export interface DeprecatedZodiacMarketData {
  readonly sign: ZodiacSign;
  readonly status: "unavailable";
  readonly source: "not-configured";
  readonly error: {
    readonly code: "market-explicit-import-required";
    readonly message: string;
  };
}

/**
 * Legacy unavailable market data type used by the inactive React hook.
 * @deprecated Import market helpers explicitly from @zodiacs/sdk/market.
 */
export type ZodiacMarketData = DeprecatedZodiacMarketData;

/** Controls an optional balance request. Disabled reads leave the hook idle. */
export interface UseZodiacBalanceOptions extends ReadOptions {
  readonly enabled?: boolean;
}

/** Returns the bundled official registry synchronously. */
export function useZodiacsRegistry(): ZodiacsRegistry {
  return getZodiacsRegistry();
}

/** Memoizes the official asset and chain representations for a sign. */
export function useOfficialZodiacToken(sign: ZodiacSign): ZodiacAsset {
  return useMemo(() => getZodiacAsset(sign), [sign]);
}

/** Checks registry membership for an optional address, returning false when absent. */
export function useIsOfficialZodiacAddress(
  address: string | null | undefined,
  options: ZodiacAddressLookupOptions = {}
): boolean {
  const chain = options.chain;
  return useMemo(
    () => (address ? isOfficialZodiacAddress(address, chain ? { chain } : {}) : false),
    [address, chain]
  );
}

/** Resolves an optional address and chain to a registry entry or null. */
export function useZodiacRepresentation(
  address: string | null | undefined,
  options: ZodiacAddressLookupOptions = {}
): ZodiacRepresentation | null {
  const chain = options.chain;
  return useMemo(
    () => (address ? getRepresentationByAddress(address, chain ? { chain } : {}) : null),
    [address, chain]
  );
}

/** Memoizes the fixed UTC season for an instant, defaulting to the current date. */
export function useCurrentZodiacSeason(date?: Date): ZodiacSeason {
  const time = date?.getTime() ?? null;

  return useMemo(() => getCurrentZodiacSeason(date), [time]);
}

/** Memoizes identity facts from supplied holdings, placements and UTC date. */
export function useZodiacIdentityContext(
  ownership: ZodiacIdentityOwnershipInput,
  options: ZodiacIdentityContextOptions = {}
): ZodiacIdentityContext {
  const dateTime = options.date?.getTime() ?? null;

  return useMemo(
    () => getZodiacIdentityContext(ownership, options),
    [ownership, dateTime, options.sunSign, options.moonSign, options.risingSign]
  );
}

/** Memoizes a labeled receipt and wheel state from existing holdings. */
export function useIdentityReceiptData(
  ownership: ZodiacIdentityOwnershipInput,
  options: IdentityReceiptDataOptions = {}
): IdentityReceiptData {
  const dateTime = options.date?.getTime() ?? null;

  return useMemo(
    () => getIdentityReceiptData(ownership, options),
    [ownership, dateTime, options.sunSign, options.moonSign, options.risingSign, options.label]
  );
}

/** Memoizes the twelve-sign display wheel for supplied holdings. */
export function useZodiacWheelData(ownership: ZodiacIdentityOwnershipInput): ZodiacWheelData {
  return useMemo(() => getZodiacWheelData(ownership), [ownership]);
}

/** Memoizes overlap and coverage for two sets of holdings. */
export function useCompatibilityContext(
  first: ZodiacIdentityOwnershipInput,
  second: ZodiacIdentityOwnershipInput
): ZodiacCompatibilityContext {
  return useMemo(() => getCompatibilityContext(first, second), [first, second]);
}

/** Pairs bundled metadata with a token from the nearest provider registry. */
export function useZodiacToken(sign: ZodiacSign): UseZodiacTokenResult {
  const { registry } = useZodiacs();

  return useMemo(
    () => ({
      metadata: getZodiacMetadata(sign),
      token: getZodiacToken(sign, registry)
    }),
    [registry, sign]
  );
}

/**
 * Reads one native balance through the provider. A blank owner or disabled read leaves the
 * hook idle.
 */
export function useZodiacBalance(
  sign: ZodiacSign,
  ownerAddress: string | null | undefined,
  options: UseZodiacBalanceOptions = {}
): AsyncHookState<ZodiacBalanceResult> {
  const { balanceReader, registry } = useZodiacs();
  const { token } = useZodiacToken(sign);
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((current) => current + 1), []);
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<AsyncHookState<ZodiacBalanceResult>>({
    data: null,
    error: null,
    loading: false,
    refetch
  });

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false, refetch });
      return;
    }

    const normalizedOwnerAddress = ownerAddress?.trim();

    if (!normalizedOwnerAddress) {
      setState({ data: null, error: null, loading: false, refetch });
      return;
    }

    if (!balanceReader) {
      const error = new Error(balanceReaderNotConfiguredMessage);
      setState({
        data: unavailableZodiacBalanceResult(sign, token, error.message),
        error,
        loading: false,
        refetch
      });
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, error: null, loading: true }));

    runHookRead(controller, options, (signal) =>
      readZodiacBalance({
        ...options,
        signal,
        ownerAddress: normalizedOwnerAddress,
        reader: balanceReader,
        registry,
        sign
      })
    )
      .then((data: ZodiacBalanceResult) => {
        if (mounted) {
          const error =
            data.status === "unavailable" ? new Error(data.reason ?? "Balance unavailable.") : null;
          setState({ data, error, loading: false, refetch });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error("Balance request failed."),
            loading: false,
            refetch
          });
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [
    balanceReader,
    enabled,
    ownerAddress,
    registry,
    sign,
    token,
    version,
    refetch,
    options.signal,
    options.timeoutMs
  ]);

  return state;
}

/** Legacy hook returning idle state. Use the market entry point for provider reads. */
export function useZodiacMarket(
  sign: ZodiacSign,
  _options: UseZodiacMarketOptions = {}
): AsyncHookState<ZodiacMarketData> {
  void _options;
  const refetch = useCallback(() => undefined, []);
  const [state] = useState<AsyncHookState<ZodiacMarketData>>({
    data: null,
    error: null,
    loading: false,
    refetch
  });

  void sign;

  return state;
}

/** Reads a single bridged balance, exposing read failures in the hook state. */
export function useBaseZodiacBalance(
  publicClient: ZodiacsBasePublicClient | null | undefined,
  ownerAddress: string | null | undefined,
  sign: ZodiacSign,
  options: BaseZodiacsReadOptions = {}
): AsyncHookState<BaseZodiacBalance> {
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((current) => current + 1), []);
  const [state, setState] = useState<AsyncHookState<BaseZodiacBalance>>({
    data: null,
    error: null,
    loading: false,
    refetch
  });

  useEffect(() => {
    if (!publicClient || !ownerAddress?.trim()) {
      setState({ data: null, error: null, loading: false, refetch });
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, error: null, loading: true }));

    runHookRead(controller, options, (signal) =>
      getBaseZodiacBalance(publicClient, ownerAddress, sign, { ...options, signal })
    )
      .then((data) => {
        if (mounted) {
          const error =
            data.status === "unavailable"
              ? new Error(data.error?.message ?? "Base balance unavailable.")
              : null;
          setState({ data, error, loading: false, refetch });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error("Base balance request failed."),
            loading: false,
            refetch
          });
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [
    ownerAddress,
    publicClient,
    sign,
    version,
    refetch,
    options.blockNumber,
    options.blockTag,
    options.signal,
    options.timeoutMs
  ]);

  return state;
}

/** Reads the Base ownership snapshot when both a client and owner are available. */
export function useBaseZodiacsOwnership(
  publicClient: ZodiacsBasePublicClient | null | undefined,
  ownerAddress: string | null | undefined,
  options: BaseZodiacsReadOptions = {}
): AsyncHookState<BaseZodiacsOwnership> {
  return useAsyncOwnership(
    publicClient && ownerAddress?.trim()
      ? (signal) => getBaseZodiacsOwnership(publicClient, ownerAddress, { ...options, signal })
      : null,
    [
      ownerAddress,
      publicClient,
      options.blockNumber,
      options.blockTag,
      options.includeZeroBalances,
      options.minBalance,
      options.onPartialFailure
    ],
    options
  );
}

/** Reads the native ownership snapshot when both a connection and owner are available. */
export function useSolanaZodiacsOwnership(
  connection: ConnectionOrRpcUrl | null | undefined,
  ownerAddress: string | null | undefined,
  options: SolanaZodiacsReadOptions = {}
): AsyncHookState<ZodiacsOwnership> {
  return useAsyncOwnership(
    connection && ownerAddress?.trim()
      ? (signal) => getSolanaZodiacsOwnership(connection, ownerAddress, { ...options, signal })
      : null,
    [connection, ownerAddress, options.onPartialFailure],
    options
  );
}

/** Reads each configured chain with a nonblank owner and shares a cancellation deadline. */
export function useCrossChainZodiacsOwnership(
  params: ZodiacHoldingsByChainParams
): AsyncHookState<CrossChainZodiacsOwnership> {
  const solanaConnection = params.solana?.connection ?? null;
  const solanaOwnerAddress = params.solana?.ownerAddress.trim() ?? "";
  const basePublicClient = params.base?.publicClient ?? null;
  const baseOwnerAddress = params.base?.ownerAddress.trim() ?? "";
  const enabled = Boolean(
    (solanaConnection && solanaOwnerAddress) || (basePublicClient && baseOwnerAddress)
  );

  return useAsyncOwnership(
    enabled
      ? (signal) =>
          getCrossChainZodiacsOwnership({
            ...(solanaConnection && solanaOwnerAddress
              ? { solana: { connection: solanaConnection, ownerAddress: solanaOwnerAddress } }
              : {}),
            ...(basePublicClient && baseOwnerAddress
              ? { base: { publicClient: basePublicClient, ownerAddress: baseOwnerAddress } }
              : {}),
            ...(params.timeoutMs === undefined ? {} : { timeoutMs: params.timeoutMs }),
            signal
          })
      : null,
    [solanaConnection, solanaOwnerAddress, basePublicClient, baseOwnerAddress],
    params
  );
}

function unavailableZodiacBalanceResult(
  sign: ZodiacSign,
  token: ZodiacToken,
  reason: string
): ZodiacBalanceResult {
  return {
    sign,
    token,
    balance: null,
    status: "unavailable",
    reason
  };
}

function useAsyncOwnership<T>(
  loader: ((signal: AbortSignal) => Promise<T>) | null,
  deps: readonly unknown[],
  options: ReadOptions
): AsyncHookState<T> {
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((current) => current + 1), []);
  const [state, setState] = useState<AsyncHookState<T>>({
    data: null,
    error: null,
    loading: false,
    refetch
  });

  useEffect(() => {
    if (!loader) {
      setState({ data: null, error: null, loading: false, refetch });
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, error: null, loading: true }));

    runHookRead(controller, options, loader)
      .then((data) => {
        if (mounted) {
          setState({ data, error: null, loading: false, refetch });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error("Zodiacs ownership request failed."),
            loading: false,
            refetch
          });
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [...deps, version, refetch, options.signal, options.timeoutMs]);

  return state;
}

async function runHookRead<T>(
  controller: AbortController,
  options: ReadOptions,
  load: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const caller = options.signal;
  const abort = () => controller.abort(caller?.reason);
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort);
  try {
    return await load(controller.signal);
  } finally {
    caller?.removeEventListener("abort", abort);
  }
}
