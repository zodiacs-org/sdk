import { checksum, validate } from "ox/Address";
import type { ZodiacChain } from "./types.js";
import { InvalidZodiacAddressError } from "./errors.js";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_VALUES = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));
const SOLANA_PUBLIC_KEY_BYTES = 32;

/** Checks an untrimmed EVM address, including checksum validation for mixed case. */
export function isEvmAddress(address: string): boolean {
  return validate(address);
}

/** Trims and checksums an EVM address. Throws InvalidZodiacAddressError for invalid input. */
export function normalizeEvmAddress(address: string): string {
  if (typeof address !== "string") throw new InvalidZodiacAddressError(address);
  const trimmed = address.trim();

  if (!validate(trimmed)) {
    throw new InvalidZodiacAddressError(address);
  }

  return checksum(trimmed);
}

/** Checks whether the trimmed Base58 string decodes to a 32-byte public key. */
export function isSolanaAddressLike(address: string): boolean {
  return normalizeSolanaAddressOrNull(address) !== null;
}

/** Returns a trimmed, case-preserving 32-byte Base58 key or throws InvalidZodiacAddressError. */
export function normalizeSolanaAddress(address: string): string {
  const normalized = normalizeSolanaAddressOrNull(address);

  if (!normalized) {
    throw new InvalidZodiacAddressError(address);
  }

  return normalized;
}

/** Normalizes an address for the supplied chain. With no chain, tries EVM first, then Solana. */
export function normalizeZodiacAddress(address: string, chain?: ZodiacChain): string {
  if (typeof address !== "string") throw new InvalidZodiacAddressError(address);
  const trimmed = address.trim();

  if (chain === "base") {
    return normalizeEvmAddress(trimmed);
  }

  if (chain === "solana") {
    return normalizeSolanaAddress(trimmed);
  }

  if (isEvmAddress(trimmed)) {
    return normalizeEvmAddress(trimmed);
  }

  return normalizeSolanaAddress(trimmed);
}

function normalizeSolanaAddressOrNull(address: string): string | null {
  if (typeof address !== "string") return null;
  const trimmed = address.trim();

  return hasBase58Width(trimmed, SOLANA_PUBLIC_KEY_BYTES, 44) ? trimmed : null;
}

/** Checks the Base58 encoding of a 64-byte Solana signature. Performs no cryptographic verification. */
export function isSolanaSignatureLike(value: unknown): boolean {
  return typeof value === "string" && hasBase58Width(value, 64, 88);
}

function hasBase58Width(value: string, bytes: number, maxLength: number): boolean {
  if (value.length < bytes || value.length > maxLength) return false;
  try {
    return decodeBase58(value).length === bytes;
  } catch {
    return false;
  }
}

function decodeBase58(value: string): Uint8Array {
  const bytes: number[] = [];

  for (const character of value) {
    const alphabetIndex = BASE58_VALUES.get(character);

    if (alphabetIndex === undefined) {
      throw new Error("Invalid base58 character.");
    }

    let carry = alphabetIndex;

    for (let index = 0; index < bytes.length; index += 1) {
      const nextValue = bytes[index]! * BASE58_ALPHABET.length + carry;
      bytes[index] = nextValue & 0xff;
      carry = nextValue >> 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const character of value) {
    if (character !== "1") {
      break;
    }

    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
}
