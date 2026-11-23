import { erc20Abi } from "abitype/abis";
import { checksum, validate } from "ox/Address";
import type { erc20Abi as viemErc20Abi } from "viem";
import { PartialOwnershipReadError, UnsupportedChainError } from "./errors.js";
import { formatTokenAmount } from "./format.js";
import {
  BASE_CHAIN_ID,
  getAllBaseBridgedZodiacs,
  getBaseZodiacRepresentation
} from "./official-registry.js";
import type {
  BaseZodiacBalance,
  BaseZodiacsHolding,
  BaseZodiacsOwnership,
  ZodiacRepresentation,
  ZodiacSerializableError,
  ZodiacSign,
  ZodiacsOwnershipStatus
} from "./types.js";

export type BaseZodiacsBlockTag = "latest" | "safe" | "finalized" | "pending";

export interface BaseZodiacsReadOptions {
  readonly includeZeroBalances?: boolean;
  readonly minBalance?: bigint;
  readonly blockNumber?: bigint;
  readonly blockTag?: BaseZodiacsBlockTag;
  readonly signal?: AbortSignal;
  readonly onPartialFailure?: "throw" | "warn" | "ignore";
}

type BaseReadBlock = Pick<BaseZodiacsReadOptions, "blockNumber" | "blockTag">;
type BaseContract = { readonly address: `0x${string}`; readonly abi: typeof viemErc20Abi } & (
  | { readonly functionName: "decimals" }
  | { readonly functionName: "balanceOf"; readonly args: readonly [`0x${string}`] }
);
interface BaseBatchRead extends BaseReadBlock {
  readonly contracts: readonly BaseContract[];
  readonly allowFailure: true;
}

export interface ZodiacsBasePublicClient {
  readonly readContract: (parameters: BaseContract & BaseReadBlock) => Promise<unknown>;
  readonly readContracts?: (parameters: BaseBatchRead) => Promise<readonly ReadContractsResult[]>;
  readonly getBlockNumber?: () => Promise<bigint>;
  readonly chain?: { readonly id?: number } | undefined;
}

type ReadContractsResult =
  | { readonly status: "success"; readonly result: unknown }
  | { readonly status: "failure"; readonly error?: unknown };

interface CachedDecimals {
  readonly block: bigint | BaseZodiacsBlockTag;
  readonly decimals: number;
}

const UINT256_LIMIT = 1n << 256n;
const decimalsCache = new WeakMap<object, Map<string, CachedDecimals>>();

export async function getBaseZodiacBalance(
  publicClient: ZodiacsBasePublicClient,
  ownerAddress: string,
  sign: ZodiacSign,
  options: BaseZodiacsReadOptions = {}
): Promise<BaseZodiacBalance> {
  throwIfAborted(options.signal);
  assertBaseChain(publicClient);
  const representation = getBaseZodiacRepresentation(sign);
  const normalizedOwner = normalizeOwnerAddress(ownerAddress);

  if (!normalizedOwner) {
    return unavailableBaseBalance(representation, ownerAddress, {
      code: "invalid-zodiac-address",
      message: `Invalid Base owner address: ${ownerAddress}`
    });
  }

  try {
    const [rawAmount, decimals] = await Promise.all([
      publicClient.readContract({
        address: representation.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [normalizedOwner],
        ...getBlockReadOptions(options)
      }),
      publicClient.readContract({
        address: representation.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        ...getBlockReadOptions(options)
      })
    ]);
    throwIfAborted(options.signal);
    return baseBalanceFromResult(representation, normalizedOwner, rawAmount, decimals);
  } catch (error) {
    throwIfAborted(options.signal);
    return unavailableBaseBalance(representation, normalizedOwner, {
      code: "zodiac-read-unavailable",
      message: error instanceof Error ? error.message : "Base ERC-20 balance read failed."
    });
  }
}

export async function getBaseZodiacBalances(
  publicClient: ZodiacsBasePublicClient,
  ownerAddress: string,
  options: BaseZodiacsReadOptions = {}
): Promise<readonly BaseZodiacBalance[]> {
  assertBaseChain(publicClient);
  if (typeof publicClient.readContracts !== "function") {
    return Promise.all(
      getAllBaseBridgedZodiacs().map((representation) =>
        getBaseZodiacBalance(publicClient, ownerAddress, representation.sign, options)
      )
    );
  }

  return readBaseZodiacBalancesBatched(publicClient, ownerAddress, options);
}

export async function getBaseZodiacsOwnership(
  publicClient: ZodiacsBasePublicClient,
  ownerAddress: string,
  options: BaseZodiacsReadOptions = {}
): Promise<BaseZodiacsOwnership> {
  const checkedAt = new Date().toISOString();
  throwIfAborted(options.signal);
  assertBaseChain(publicClient);
  const block = await getReadBlockNumber(publicClient, options);
  throwIfAborted(options.signal);
  const balances = await getBaseZodiacBalances(publicClient, ownerAddress, {
    ...options,
    ...block
  });
  throwIfAborted(options.signal);
  const minBalance = options.minBalance ?? 1n;
  const holdings = balances
    .map<BaseZodiacsHolding>((balance) => ({
      sign: balance.sign,
      representation: balance.representation,
      balance,
      held: balance.status === "ok" && BigInt(balance.rawAmount) >= minBalance
    }))
    .filter((holding) => (options.includeZeroBalances === false ? holding.held : true));
  const heldSigns = holdings.filter((holding) => holding.held).map((holding) => holding.sign);
  const zeroBalanceSigns = balances
    .filter((balance) => balance.status === "zero")
    .map((balance) => balance.sign);
  const unavailableSigns = balances
    .filter((balance) => balance.status === "unavailable")
    .map((balance) => balance.sign);
  const allHeldSigns = balances
    .filter((balance) => balance.status === "ok" && BigInt(balance.rawAmount) >= minBalance)
    .map((balance) => balance.sign);
  const errors = balances.flatMap((balance) => (balance.error ? [balance.error] : []));
  const warnings = collectBaseWarnings(balances);
  const partialFailureMode = options.onPartialFailure ?? "warn";

  if (errors.length > 0 && partialFailureMode === "throw") {
    throw new PartialOwnershipReadError(errors);
  }

  const owner = normalizeOwnerAddress(ownerAddress) ?? ownerAddress;
  const confirmedAbsentSigns = zeroBalanceSigns;

  return {
    owner,
    ownerAddress: owner,
    chain: "base",
    checkedAt,
    ...block,
    status: getBaseOwnershipStatus(balances),
    holdings,
    heldSigns,
    zeroBalanceSigns,
    unavailableSigns,
    confirmedAbsentSigns,
    balancesBySign: toBalancesBySign(balances),
    representations: getAllBaseBridgedZodiacs(),
    totalHeld: allHeldSigns.length,
    errors: partialFailureMode === "ignore" ? [] : errors,
    warnings: partialFailureMode === "ignore" ? [] : warnings
  };
}

export const getBaseZodiacsOwnershipBatched = getBaseZodiacsOwnership;

export async function getBaseHeldZodiacs(
  publicClient: ZodiacsBasePublicClient,
  ownerAddress: string,
  options: BaseZodiacsReadOptions = {}
): Promise<readonly BaseZodiacsHolding[]> {
  const ownership = await getBaseZodiacsOwnership(publicClient, ownerAddress, options);
  return ownership.holdings.filter((holding) => holding.held);
}

function assertBaseChain(client: ZodiacsBasePublicClient): void {
  const chainId = client.chain?.id;
  if (chainId !== undefined && chainId !== BASE_CHAIN_ID) {
    throw new UnsupportedChainError(String(chainId));
  }
}

function unsignedInteger(value: unknown): bigint | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  if (typeof value === "string" && !/^(?:\d+|0x[\da-f]+)$/iu.test(value)) return null;
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string")
    return null;
  const integer = BigInt(value);
  return integer >= 0n && integer < UINT256_LIMIT ? integer : null;
}

function parseDecimals(value: unknown): number | null {
  const decimals = unsignedInteger(value);
  return decimals !== null && decimals <= 18n ? Number(decimals) : null;
}

function baseBalanceFromResult(
  representation: ZodiacRepresentation,
  ownerAddress: string,
  amount: unknown,
  decimalsValue: unknown
): BaseZodiacBalance {
  const raw = unsignedInteger(amount);
  const decimals = parseDecimals(decimalsValue);
  if (raw === null || decimals === null) {
    return unavailableBaseBalance(representation, ownerAddress, {
      code: "zodiac-read-unavailable",
      message: "Invalid Base ERC-20 balance or decimals."
    });
  }
  return {
    sign: representation.sign,
    ownerAddress,
    representation,
    chain: "base",
    kind: "bridged",
    tokenStandard: "ERC20",
    rawAmount: raw.toString(),
    uiAmountString: formatTokenAmount(raw, decimals),
    decimals,
    status: raw === 0n ? "zero" : "ok"
  };
}

async function readBaseBatch(
  publicClient: ZodiacsBasePublicClient,
  request: BaseBatchRead
): Promise<readonly ReadContractsResult[]> {
  try {
    return await publicClient.readContracts!(request);
  } catch (error) {
    return request.contracts.map(() => ({ status: "failure", error }));
  }
}

function unavailableBaseBalance(
  representation: ZodiacRepresentation,
  ownerAddress: string,
  error: ZodiacSerializableError
): BaseZodiacBalance {
  return {
    sign: representation.sign,
    ownerAddress,
    representation,
    chain: "base",
    kind: "bridged",
    tokenStandard: "ERC20",
    rawAmount: "0",
    uiAmountString: "0",
    decimals: representation.decimals ?? 0,
    status: "unavailable",
    error
  };
}

function getBaseOwnershipStatus(balances: readonly BaseZodiacBalance[]): ZodiacsOwnershipStatus {
  const unavailableCount = balances.filter((balance) => balance.status === "unavailable").length;

  if (unavailableCount === 0) {
    return "available";
  }

  return unavailableCount === balances.length ? "unavailable" : "partial";
}

function normalizeOwnerAddress(ownerAddress: string): `0x${string}` | null {
  return validate(ownerAddress) ? checksum(ownerAddress) : null;
}

async function readBaseZodiacBalancesBatched(
  publicClient: ZodiacsBasePublicClient,
  ownerAddress: string,
  options: BaseZodiacsReadOptions
): Promise<readonly BaseZodiacBalance[]> {
  throwIfAborted(options.signal);
  const representations = getAllBaseBridgedZodiacs();
  const normalizedOwner = normalizeOwnerAddress(ownerAddress);

  if (!normalizedOwner) {
    return representations.map((representation) =>
      unavailableBaseBalance(representation, ownerAddress, {
        code: "invalid-zodiac-address",
        message: `Invalid Base owner address: ${ownerAddress}`
      })
    );
  }

  const { decimalsByAddress, warningsByAddress } = await getBaseDecimals(
    publicClient,
    representations,
    options
  );
  throwIfAborted(options.signal);
  const balanceResults = await readBaseBatch(publicClient, {
    contracts: representations.map((representation) => ({
      address: representation.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [normalizedOwner]
    })),
    allowFailure: true,
    ...getBlockReadOptions(options)
  });
  throwIfAborted(options.signal);

  return representations.map((representation, index) => {
    const result = balanceResults?.[index];
    const addressKey = representation.address.toLowerCase();
    const decimals = decimalsByAddress.get(addressKey) ?? representation.decimals ?? 0;
    const warning = warningsByAddress.get(addressKey);

    if (result?.status !== "success") {
      return unavailableBaseBalance(representation, normalizedOwner, {
        code: "zodiac-read-unavailable",
        message: formatUnknownError(
          result?.error,
          `${representation.sign} Base ERC-20 balance read failed.`
        )
      });
    }

    const balance = baseBalanceFromResult(representation, normalizedOwner, result.result, decimals);
    return warning ? { ...balance, warning } : balance;
  });
}

async function getBaseDecimals(
  publicClient: ZodiacsBasePublicClient,
  representations: readonly ZodiacRepresentation[],
  options: BaseZodiacsReadOptions
): Promise<{
  readonly decimalsByAddress: Map<string, number>;
  readonly warningsByAddress: Map<string, ZodiacSerializableError>;
}> {
  const block = options.blockNumber ?? options.blockTag ?? "latest";
  let cache = decimalsCache.get(publicClient);
  if (!cache) {
    cache = new Map<string, CachedDecimals>();
    decimalsCache.set(publicClient, cache);
  }
  const decimalsByAddress = new Map<string, number>();
  const warningsByAddress = new Map<string, ZodiacSerializableError>();
  const uncached = representations.filter((representation) => {
    const address = representation.address.toLowerCase();
    const cached = cache.get(address);
    if (cached?.block !== block || (typeof block !== "bigint" && block !== "latest")) return true;
    decimalsByAddress.set(address, cached.decimals);
    return false;
  });
  if (!uncached.length) return { decimalsByAddress, warningsByAddress };

  const results = await readBaseBatch(publicClient, {
    contracts: uncached.map((representation) => ({
      address: representation.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "decimals"
    })),
    allowFailure: true,
    ...getBlockReadOptions(options)
  });

  uncached.forEach((representation, index) => {
    const result = results?.[index];
    const address = representation.address.toLowerCase();

    const decimals = result?.status === "success" ? parseDecimals(result.result) : null;
    if (decimals !== null) {
      cache.set(address, { block, decimals });
      decimalsByAddress.set(address, decimals);
      return;
    }

    if (typeof representation.decimals === "number") {
      warningsByAddress.set(address, {
        code: "zodiac-read-unavailable",
        message: `${representation.sign} Base ERC-20 decimals read failed; used registry decimals.`
      });
    }
  });

  return { decimalsByAddress, warningsByAddress };
}

function toBalancesBySign(
  balances: readonly BaseZodiacBalance[]
): Readonly<Record<ZodiacSign, BaseZodiacBalance>> {
  return Object.fromEntries(balances.map((balance) => [balance.sign, balance])) as Readonly<
    Record<ZodiacSign, BaseZodiacBalance>
  >;
}

function collectBaseWarnings(
  balances: readonly BaseZodiacBalance[]
): readonly ZodiacSerializableError[] {
  return balances.flatMap((balance) => {
    const warnings: ZodiacSerializableError[] = [];

    if (balance.warning) {
      warnings.push(balance.warning);
    }

    if (balance.status === "unavailable" && balance.error) {
      warnings.push({
        code: "zodiac-read-unavailable",
        message: `${balance.sign}: ${balance.error?.message ?? "Base read unavailable."}`
      });
    }

    return warnings;
  });
}

async function getReadBlockNumber(
  publicClient: ZodiacsBasePublicClient,
  options: BaseZodiacsReadOptions
): Promise<{ readonly blockNumber?: bigint }> {
  if (options.blockNumber !== undefined) {
    return { blockNumber: options.blockNumber };
  }

  if (
    (options.blockTag && options.blockTag !== "latest") ||
    typeof publicClient.getBlockNumber !== "function"
  ) {
    return {};
  }

  try {
    return { blockNumber: await publicClient.getBlockNumber() };
  } catch {
    return {};
  }
}

function getBlockReadOptions(options: BaseZodiacsReadOptions): {
  readonly blockNumber?: bigint;
  readonly blockTag?: BaseZodiacsBlockTag;
} {
  if (options.blockNumber !== undefined) return { blockNumber: options.blockNumber };
  return options.blockTag === undefined ? {} : { blockTag: options.blockTag };
}

function formatUnknownError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Base Zodiacs ownership read aborted.");
  }
}
