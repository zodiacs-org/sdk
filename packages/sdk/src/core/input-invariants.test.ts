import { describe, expect, it, vi } from "vitest";
import { fromBytes } from "ox/Base58";
import { isSolanaSignatureLike } from "../solana.js";
import { formatUnits, parseUnits } from "viem";
import {
  ZODIAC_METADATA,
  ZODIAC_SIGNS,
  getZodiacSeasonForDate,
  getNextZodiacSeason,
  getSolanaZodiacsOwnership,
  getSolanaZodiacBalance,
  getBaseZodiacsOwnership,
  getZodiacToken,
  type ParsedTokenAccountResponse,
  type ZodiacsBasePublicClient,
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

describe("public input roundtrips", () => {
  it("recognizes independently encoded keys and signatures only at their decoded width", () => {
    const next = seededGenerator(0x52da);
    for (const width of [31, 32, 33, 63, 64, 65]) {
      for (let trial = 0; trial < 100; trial++) {
        const bytes = Uint8Array.from({ length: width }, () => next() >>> 24);
        bytes.fill(0, 0, trial % (width + 1));
        // Each zero byte encodes as one leading "1", including the all-zero vector.
        const encoded = bytes.some((byte) => byte !== 0) ? fromBytes(bytes) : "1".repeat(width);
        expect(validateWalletAddress(encoded), encoded).toBe(width === 32);
        expect(validateMintAddress(encoded), encoded).toBe(width === 32);
        expect(isSolanaSignatureLike(encoded), encoded).toBe(width === 64);
        for (const invalid of ["0", "I", "l", "O", "\u200b"]) {
          const offset = next() % encoded.length;
          const mutated = encoded.slice(0, offset) + invalid + encoded.slice(offset + 1);
          expect(validateWalletAddress(mutated)).toBe(false);
          expect(isSolanaSignatureLike(mutated)).toBe(false);
        }
      }
    }
  });

  it("roundtrips uint256 base units at every supported scale", () => {
    const next = seededGenerator(0xdec1a1);
    for (let decimals = 0; decimals <= 18; decimals++) {
      for (let trial = 0; trial < 48; trial++) {
        let raw = 0n;
        for (let word = 0; word < 8; word++) raw = (raw << 32n) | BigInt(next());
        const digits = "0".repeat(trial % 5) + raw;
        const text = formatTokenAmount(digits, decimals);
        expect(parseUnits(text, decimals), digits).toBe(raw);
        expect(formatTokenAmount(raw, decimals)).toBe(text);
        expect(() => formatTokenAmount([digits] as never, decimals)).toThrow(TypeError);
      }
    }
  });

  it("selects the same season and progress for offset spellings around UTC cutovers", () => {
    for (const year of ["0000", "0099", "1900", "2000", "2024", "+010000"]) {
      for (const { dateRange } of ZODIAC_METADATA) {
        const midnight = Date.parse(year + "-" + dateRange.starts + "T00:00:00Z");
        for (const delta of [-1, 0, 1]) {
          const instant = new Date(midnight + delta);
          for (const [offset, suffix] of [
            [840, "+14:00"],
            [-720, "-12:00"],
            [345, "+05:45"]
          ] as const) {
            const local = new Date(instant.getTime() + offset * 60000).toISOString();
            const equivalent = new Date(local.slice(0, -1) + suffix);
            expect(getZodiacSeasonProgress(equivalent)).toEqual(getZodiacSeasonProgress(instant));
            expect(getNextZodiacSeason(equivalent)).toEqual(getNextZodiacSeason(instant));
          }
        }
      }
    }
  });

  it("handles both date limits and rejects malformed or out-of-range instants", () => {
    const limit = 8_640_000_000_000_000;
    for (const [time, sign] of [
      [-limit, "taurus"],
      [limit, "virgo"]
    ] as const) {
      expect(getZodiacSeasonForDate(new Date(time)).sign).toBe(sign);
    }
    for (const value of [
      new Date(limit + 1),
      new Date(-limit - 1),
      new Date(NaN),
      null,
      {},
      "2000-01-01"
    ]) {
      for (const read of [getZodiacSeasonForDate, getNextZodiacSeason, getZodiacSeasonProgress]) {
        expect(() => read(value as Date)).toThrow("Invalid date.");
      }
    }
  });
});

describe("seeded RPC response mutations", () => {
  const wallet = "1".repeat(32);
  it("classifies malformed JSON and mismatched JSON-RPC envelopes as invalid responses", async () => {
    const id = "zodiacs-sdk-token-accounts";
    const result = { value: [] };
    const messages = [
      null,
      [],
      {},
      { id, result },
      { jsonrpc: "2.0", id: "wrong", result },
      { id, jsonrpc: "2.0", result, error: { message: "conflict" } }
    ];
    try {
      for (const text of ["{", ...messages.map((value) => JSON.stringify(value))]) {
        vi.stubGlobal("fetch", async () => new Response(text));
        const balance = await getSolanaZodiacBalance("https://solana.example", wallet, "aries");
        expect(balance, text).toMatchObject({
          status: "unavailable",
          error: { code: "invalid-rpc-response" }
        });
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("isolates invalid SPL raw amounts or scales among valid wallet rows", async () => {
    const next = seededGenerator(0x52c0);
    const max = (1n << 64n) - 1n;
    const malformed = [null, [], {}, false, 1, "1e4", "-1", "3.5", "0x2", String(max + 1n)];
    for (let trial = 0; trial < 120; trial++) {
      const badIndex = (next() >>> 8) % 12;
      const rows = ZODIAC_SIGNS.map((sign, index) => {
        const badAmount = index === badIndex && trial % 2 === 0;
        const amount = badAmount ? malformed[(trial >> 1) % malformed.length] : String(max);
        const decimals =
          index === badIndex && !badAmount ? [-1, 19, "6", null][(trial >> 1) % 4] : 6;
        return {
          account: {
            data: {
              parsed: {
                info: { mint: getZodiacToken(sign).mintAddress, tokenAmount: { amount, decimals } }
              }
            }
          }
        };
      });
      const ownership = await getSolanaZodiacsOwnership(
        {
          getParsedTokenAccountsByOwner: async () => ({ value: rows }) as ParsedTokenAccountResponse
        },
        wallet
      );
      expect(ownership.unavailableSigns, String(trial)).toEqual([ZODIAC_SIGNS[badIndex]]);
      expect(ownership.confirmedAbsentSigns).toEqual([]);
      expect(ownership.totalHeld).toBe(11);
    }
  });

  it("rejects malformed Base batch containers even when they have numeric properties", async () => {
    const next = seededGenerator(0x52ba);
    for (let trial = 0; trial < 32; trial++) {
      const rows = Object.fromEntries(
        ZODIAC_SIGNS.map((_, index) => [index, { status: "success", result: BigInt(next()) + 1n }])
      );
      const client: ZodiacsBasePublicClient = {
        readContract: async () => 0n,
        readContracts: async () => rows as never
      };
      const ownership = await getBaseZodiacsOwnership(client, "0x" + "1".repeat(40));
      expect(ownership.status).toBe("unavailable");
      expect(ownership.totalHeld).toBe(0);
      expect(ownership.confirmedAbsentSigns).toEqual([]);
    }
  });
});
