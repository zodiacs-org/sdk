import { UnknownZodiacAddressError, UnsupportedChainError } from "./errors.js";
import {
  getAllOfficialRepresentations,
  getBaseZodiacRepresentation,
  getNativeZodiacRepresentation,
  getZodiacAsset,
  getZodiacRepresentation
} from "./official-registry.js";
import {
  isEvmAddress,
  normalizeEvmAddress,
  normalizeSolanaAddress,
  normalizeZodiacAddress
} from "./address.js";
import type { ZodiacChain, ZodiacRepresentation, ZodiacSign } from "./types.js";

/** Restricts a registry address lookup to the supplied chain. Omit to search both. */
export interface ZodiacAddressLookupOptions {
  readonly chain?: ZodiacChain;
}

/**
 * Normalizes an address and returns its registry entry, or null for malformed or unknown
 * input.
 */
export function getRepresentationByAddress(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): ZodiacRepresentation | null {
  const normalized = normalizeLookupAddress(address, options.chain);

  if (!normalized) {
    return null;
  }

  return (
    getAllOfficialRepresentations().find((representation) => {
      if (options.chain && representation.chain !== options.chain) {
        return false;
      }

      return normalizeLookupAddress(representation.address, representation.chain) === normalized;
    }) ?? null
  );
}

/**
 * Checks an address or the identifying fields of a representation against the bundled
 * registry.
 */
export function isOfficialZodiacRepresentation(
  value: ZodiacRepresentation | string | null | undefined,
  options: ZodiacAddressLookupOptions = {}
): boolean {
  if (typeof value === "string") {
    return isOfficialZodiacAddress(value, options);
  }

  if (!value?.isOfficialRepresentation) {
    return false;
  }

  const official = getRepresentationByAddress(value.address, options);

  if (!official) {
    return false;
  }

  return (
    official.sign === value.sign &&
    official.chain === value.chain &&
    official.kind === value.kind &&
    official.isCanonicalOrigin === value.isCanonicalOrigin &&
    (value.chainId === undefined || official.chainId === value.chainId) &&
    official.tokenStandard === value.tokenStandard
  );
}

/** Checks whether an address resolves to an official representation on the selected chain. */
export function isOfficialZodiacAddress(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): boolean {
  return getRepresentationByAddress(address, options) !== null;
}

/** Checks whether an address resolves to a native Solana registry entry. */
export function isNativeZodiacAddress(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): boolean {
  const representation = getRepresentationByAddress(address, options);
  return representation?.kind === "native";
}

/** Checks whether an address resolves to a bridged Base registry entry. */
export function isBridgedZodiacAddress(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): boolean {
  const representation = getRepresentationByAddress(address, options);
  return representation?.kind === "bridged";
}

/** Checks an EVM address against the official Base entries. */
export function isOfficialBaseZodiacAddress(address: string): boolean {
  return isOfficialZodiacAddress(address, { chain: "base" });
}

/** Checks a case-sensitive mint against the official native Solana entries. */
export function isOfficialSolanaZodiacMint(address: string): boolean {
  return isOfficialZodiacAddress(address, { chain: "solana" });
}

/** Returns the official asset matching an address, or null for an unrecognized address. */
export function getZodiacAssetByAddress(address: string, options: ZodiacAddressLookupOptions = {}) {
  const representation = getRepresentationByAddress(address, options);
  return representation ? getZodiacAsset(representation.sign) : null;
}

/** Returns the sign associated with an official address, or null if it cannot be resolved. */
export function getZodiacSignByAddress(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): ZodiacSign | null {
  return getRepresentationByAddress(address, options)?.sign ?? null;
}

/**
 * Returns the registry entry or throws UnknownZodiacAddressError for an unrecognized
 * address.
 */
export function assertOfficialZodiacAddress(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): ZodiacRepresentation {
  const representation = getRepresentationByAddress(address, options);

  if (!representation) {
    throw new UnknownZodiacAddressError(address);
  }

  return representation;
}

/**
 * Returns bridge metadata for a sign on the target chain, or null for an entry without a
 * bridge.
 */
export function getBridgeProvenance(
  sign: ZodiacSign,
  targetChain: ZodiacChain
): ZodiacRepresentation["bridge"] | null {
  const representation = getZodiacRepresentation(sign, targetChain);
  return representation?.bridge ?? null;
}

/** Resolves an official address to its native Solana origin, or null if unknown. */
export function getOriginForRepresentation(
  address: string,
  options: ZodiacAddressLookupOptions = {}
): ZodiacRepresentation | null {
  const representation = getRepresentationByAddress(address, options);

  if (!representation) {
    return null;
  }

  return representation.isCanonicalOrigin
    ? representation
    : getNativeZodiacRepresentation(representation.sign);
}

/** Alias of getOriginForRepresentation for resolving a registered address to its native mint. */
export const getNativeCounterpart = getOriginForRepresentation;

/**
 * Selects the native entry for Solana or the bridged entry for Base. An unsupported chain
 * throws UnsupportedChainError.
 */
export function getBridgedCounterpart(
  sign: ZodiacSign,
  targetChain: ZodiacChain
): ZodiacRepresentation | null {
  if (targetChain === "solana") {
    return getNativeZodiacRepresentation(sign);
  }

  if (targetChain === "base") {
    return getBaseZodiacRepresentation(sign);
  }

  throw new UnsupportedChainError(targetChain);
}

/** Returns a sign's native Solana entry followed by its official Base entry. */
export function getCounterparts(sign: ZodiacSign): readonly ZodiacRepresentation[] {
  return [getNativeZodiacRepresentation(sign), getBaseZodiacRepresentation(sign)];
}

/** Groups the canonical origin and official bridged entries for one sign. */
export function getZodiacProvenance(sign: ZodiacSign): {
  readonly sign: ZodiacSign;
  readonly native: ZodiacRepresentation;
  readonly bridged: readonly ZodiacRepresentation[];
} {
  const native = getNativeZodiacRepresentation(sign);

  return {
    sign,
    native,
    bridged: getCounterparts(sign).filter((representation) => representation.kind === "bridged")
  };
}

function normalizeLookupAddress(address: string, chain?: ZodiacChain): string | null {
  if (typeof address !== "string") return null;
  const trimmed = address.trim();

  if (!trimmed) {
    return null;
  }

  if (chain === "base") {
    return isEvmAddress(trimmed) ? normalizeEvmAddress(trimmed).toLowerCase() : null;
  }

  if (chain === "solana") {
    try {
      return normalizeSolanaAddress(trimmed);
    } catch {
      return null;
    }
  }

  if (isEvmAddress(trimmed)) {
    return normalizeZodiacAddress(trimmed, "base").toLowerCase();
  }

  try {
    return normalizeZodiacAddress(trimmed, "solana");
  } catch {
    return null;
  }
}
