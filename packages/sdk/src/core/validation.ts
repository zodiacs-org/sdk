import { isSolanaAddressLike } from "./address.js";
import { InvalidZodiacSignError } from "./errors.js";
import { ZODIAC_SIGNS, type ZodiacSign, type ZodiacToken } from "./types.js";

const signSet = new Set<string>(ZODIAC_SIGNS);
const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/u;

/** Removes whitespace and hyphens and folds case. Returns null for an unknown sign. */
export function normalizeZodiacSign(value: string): ZodiacSign | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll(/\s|-/gu, "");
  return isZodiacSign(normalized) ? normalized : null;
}

/** Narrows a value to one of the twelve exact lowercase registry slugs. */
export function isZodiacSign(value: unknown): value is ZodiacSign {
  return typeof value === "string" && signSet.has(value);
}

/** Normalizes a sign or throws InvalidZodiacSignError if it cannot be recognized. */
export function assertZodiacSign(value: string): ZodiacSign {
  const sign = normalizeZodiacSign(value);

  if (!sign) {
    throw new InvalidZodiacSignError(value);
  }

  return sign;
}

/**
 * Checks Base58 characters and encoded length only. Use validateWalletAddress to check byte
 * width.
 */
export function isLikelyBase58Address(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44 &&
    base58Pattern.test(value)
  );
}

/** Checks an unpadded Base58 wallet string for an exact decoded width of 32 bytes. */
export function validateWalletAddress(value: string): boolean {
  return isLikelyBase58Address(value) && isSolanaAddressLike(value);
}

/** Checks an unpadded Base58 mint string for an exact decoded width of 32 bytes. */
export function validateMintAddress(value: string): boolean {
  return isLikelyBase58Address(value) && isSolanaAddressLike(value);
}

/** Lists invalid fields in a Solana token definition. An empty list indicates success. */
export function validateZodiacToken(token: ZodiacToken): readonly string[] {
  if (!token || typeof token !== "object") return ["Token must be an object."];
  const errors: string[] = [];

  if (!ZODIAC_SIGNS.includes(token.sign)) {
    errors.push(`Unsupported sign: ${token.sign}`);
  }

  if (typeof token.name !== "string" || !token.name.trim()) {
    errors.push("Token name is required.");
  }

  if (token.slug !== token.sign) {
    errors.push(`Token slug must match sign: ${token.slug}`);
  }

  if (typeof token.ticker !== "string" || !/^[A-Z0-9._-]{2,16}$/u.test(token.ticker)) {
    errors.push(`Token ticker is invalid: ${token.ticker}`);
  }

  if (!Number.isInteger(token.order) || token.order < 1 || token.order > 12) {
    errors.push(`Token order must be an integer from 1 to 12: ${token.order}`);
  }

  if (typeof token.symbol !== "string" || !token.symbol.trim()) {
    errors.push("Token symbol is required.");
  }

  if (typeof token.archetype !== "string" || !token.archetype.trim()) {
    errors.push("Token archetype is required.");
  }

  if (typeof token.shortBio !== "string" || !token.shortBio.trim()) {
    errors.push("Token shortBio is required.");
  }

  if (!Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 18) {
    errors.push(`Token decimals must be an integer from 0 to 18: ${token.decimals}`);
  }

  if (!validateMintAddress(token.mintAddress)) {
    errors.push(`Mint address is invalid for ${token.sign}.`);
  }

  return errors;
}
