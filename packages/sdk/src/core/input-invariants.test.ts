import { describe, expect, it } from "vitest";
import { formatUnits } from "viem";
import {
  ZODIAC_METADATA,
  formatTokenAmount,
  getZodiacSeasonProgress,
  isSolanaAddressLike,
  validateMintAddress,
  validateWalletAddress
} from "./index.js";

function seededGenerator(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
}

describe("seeded SDK input checks", () => {
  it("matches the decoded byte width of generated Base58 strings", () => {
    const next = seededGenerator(0x37e039ab);
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    for (let index = 0; index < 1800; index++) {
      const length = 30 + (next() % 17);
      const leadingZeros = next() % (length + 1);
      let address = "1".repeat(leadingZeros);
      let number = 0n;
      for (let i = leadingZeros; i < length; i++) {
        const digit = 1 + (next() % 57);
        address += alphabet[digit];
        number = number * 58n + BigInt(digit);
      }
      const width = leadingZeros + (number === 0n ? 0 : Math.ceil(number.toString(16).length / 2));
      for (const check of [isSolanaAddressLike, validateMintAddress, validateWalletAddress]) {
        expect(check(address), address).toBe(width === 32);
      }
    }
  });

  it("rounds and truncates padded amounts against integer arithmetic", () => {
    const next = seededGenerator(0xb35e);
    for (let i = 0; i < 2400; i++) {
      const raw = BigInt(next()) * BigInt(next());
      const decimals = next() % 19;
      const digits = next() % (decimals + 1);
      const unit = 10n ** BigInt(decimals - digits);
      const padded = "0".repeat(next() % 5) + raw;
      for (const mode of ["round", "truncate"] as const) {
        const scaled = (raw + (mode === "round" ? unit / 2n : 0n)) / unit;
        expect(
          formatTokenAmount(padded, decimals, { maximumFractionDigits: digits, roundingMode: mode })
        ).toBe(formatUnits(scaled, digits));
      }
    }
  });

  it("matches registry calendar ranges over extended ISO years", () => {
    const next = seededGenerator(0x140);
    const limit = 8640000000000000;
    const times = [-limit, -limit + 1, limit - 1, limit];
    for (let i = 0; i < 2000; i++) times.push(Math.trunc(((next() / 2 ** 32) * 2 - 1) * limit));
    for (const time of times) {
      const date = new Date(time);
      const monthDay = date.toISOString().split("T")[0]!.slice(-5);
      const expected = ZODIAC_METADATA.find(({ dateRange: { starts, ends } }) =>
        starts <= ends
          ? monthDay >= starts && monthDay <= ends
          : monthDay >= starts || monthDay <= ends
      );
      const season = getZodiacSeasonProgress(date);
      expect(season.sign, date.toISOString()).toBe(expected?.sign);
      expect(season.progress).toBeGreaterThanOrEqual(0);
      expect(season.progress).toBeLessThanOrEqual(100);
    }
  });
});
