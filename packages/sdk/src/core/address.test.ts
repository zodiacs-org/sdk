import { describe, expect, it } from "vitest";
import {
  InvalidZodiacAddressError,
  UnknownZodiacAddressError,
  assertOfficialZodiacAddress,
  getRepresentationByAddress,
  isOfficialZodiacAddress,
  isSolanaAddressLike,
  validateWalletAddress,
  validateMintAddress,
  normalizeEvmAddress,
  normalizeSolanaAddress,
  normalizeZodiacAddress
} from "./index.js";

describe("address normalization and lookup", () => {
  it("normalizes valid EVM and Solana addresses", () => {
    expect(normalizeEvmAddress("0x3ffb5282f5891dd8c813e64059edb0607537ec91")).toBe(
      "0x3ffB5282F5891Dd8c813E64059EdB0607537eC91"
    );
    expect(normalizeSolanaAddress(" GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv ")).toBe(
      "GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv"
    );
    expect(normalizeZodiacAddress("0x3ffb5282f5891dd8c813e64059edb0607537ec91")).toBe(
      "0x3ffB5282F5891Dd8c813E64059EdB0607537eC91"
    );
  });

  it("validates decoded public key width including all-zero keys", () => {
    for (const [address, expected] of [
      ["1".repeat(31), false],
      ["1".repeat(32), true],
      ["1".repeat(33), false],
      ["1".repeat(31) + "2", true],
      ["2".repeat(32), false],
      ["z".repeat(44), false]
    ] as const) {
      for (const validate of [isSolanaAddressLike, validateWalletAddress, validateMintAddress]) {
        expect(validate(address)).toBe(expected);
      }
    }
  });

  it("throws typed errors for invalid addresses", () => {
    expect(() => normalizeEvmAddress("not-an-address")).toThrow(InvalidZodiacAddressError);
    expect(() => normalizeSolanaAddress("not-an-address")).toThrow(InvalidZodiacAddressError);
    expect(() => normalizeZodiacAddress("not-an-address")).toThrow(InvalidZodiacAddressError);
  });

  it("distinguishes unknown valid addresses from invalid addresses", () => {
    const unknownBase = "0x0000000000000000000000000000000000000000";

    expect(isOfficialZodiacAddress(unknownBase)).toBe(false);
    expect(getRepresentationByAddress(unknownBase)).toBeNull();
    expect(() => assertOfficialZodiacAddress(unknownBase)).toThrow(UnknownZodiacAddressError);
  });
});
