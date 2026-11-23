import { natalChart, signForLongitude } from "@zodiacs/engine/core";
import { assert, describe, expect, it, vi } from "vitest";
import {
  getCrossChainZodiacsOwnership,
  getMintAddress,
  getZodiacIdentityContext,
  ZODIAC_SIGNS
} from "../index.js";
import {
  mockBasePublicClient,
  mockMixedCrossChainOwnership,
  mockSolanaConnection
} from "../testing.js";

const ownerAddress = "CWKQJJYec89wcx871C8vmyTPc3jhsdoAYs5aGffUtELJ";
const date = new Date("2000-02-29T12:00:00Z");

describe("chart and wallet integration", () => {
  it("resolves a mixed batch with distinct birth times and an unknown-time leap day", () => {
    const births = [
      { utc: "1990-05-03T12:00:00Z", latitude: 40, longitude: -74 },
      { utc: "2000-02-29", timeKnown: false },
      { utc: "1990-05-03T02:00:00Z", latitude: -34, longitude: 151 }
    ];
    const contexts = births.map((birth) => {
      const chart = natalChart(birth);
      const sun = chart.bodies.find((row) => row.body === "Sun");
      const moon = chart.bodies.find((row) => row.body === "Moon");
      assert(sun && moon);
      return getZodiacIdentityContext(mockMixedCrossChainOwnership, {
        date: chart.input.utc,
        sunSign: sun.sign,
        moonSign: moon.sign,
        ...(chart.angles && { risingSign: signForLongitude(chart.angles.asc).slug })
      });
    });
    expect(contexts.map((context) => context.currentSeason.sign)).toEqual([
      "taurus",
      "pisces",
      "taurus"
    ]);
    expect(contexts.map((context) => context.alignments)).toEqual([
      [
        { placement: "sun", sign: "taurus", held: true },
        { placement: "moon", sign: "virgo", held: false },
        { placement: "rising", sign: "gemini", held: true }
      ],
      [
        { placement: "sun", sign: "pisces", held: false },
        { placement: "moon", sign: "sagittarius", held: false }
      ],
      [
        { placement: "sun", sign: "taurus", held: true },
        { placement: "moon", sign: "leo", held: false },
        { placement: "rising", sign: "cancer", held: false }
      ]
    ]);
  });

  it("preserves known holdings during RPC failures and reconciles both chains on retry", async () => {
    const connection = mockSolanaConnection({ heldSigns: ["taurus", "leo"] });
    const scan = connection.getParsedTokenAccountsByOwner;
    const publicClient = mockBasePublicClient({ heldSigns: ["taurus", "gemini"] });
    const batch = publicClient.readContracts!;
    let outage = true;
    const wallet = {
      solana: {
        ownerAddress,
        connection: {
          getParsedTokenAccountsByOwner: vi.fn<typeof scan>(async (owner, filter) => {
            if (
              outage &&
              ("programId" in filter || String(filter.mint) === getMintAddress("leo"))
            ) {
              throw new Error("Solana read unavailable");
            }
            return scan(owner, filter);
          })
        }
      },
      base: {
        ownerAddress: "0x0000000000000000000000000000000000000001",
        publicClient: {
          ...publicClient,
          readContracts: async (request: Parameters<typeof batch>[0]) => {
            if (outage && request.contracts[0]?.functionName === "balanceOf") {
              throw new Error("Base batch unavailable");
            }
            return batch(request);
          }
        }
      }
    };

    const partial = await getCrossChainZodiacsOwnership(wallet);
    expect(partial.solana).toMatchObject({ status: "partial", unavailableSigns: ["leo"] });
    expect(partial.base).toMatchObject({ status: "unavailable", unavailableSigns: ZODIAC_SIGNS });
    expect(getZodiacIdentityContext(partial, { date })).toMatchObject({
      heldSigns: ["taurus"],
      confirmedAbsentSigns: []
    });
    expect(wallet.solana.connection.getParsedTokenAccountsByOwner).toHaveBeenCalledTimes(13);

    outage = false;
    const recovered = await getCrossChainZodiacsOwnership(wallet);
    expect(wallet.solana.connection.getParsedTokenAccountsByOwner).toHaveBeenCalledTimes(14);
    for (const chain of [recovered.solana, recovered.base]) {
      expect(chain).toMatchObject({ status: "available", unavailableSigns: [], errors: [] });
    }
    const held = ["taurus", "gemini", "leo"];
    expect(getZodiacIdentityContext(recovered, { date })).toMatchObject({
      heldSigns: held,
      confirmedAbsentSigns: ZODIAC_SIGNS.filter((sign) => !held.includes(sign)),
      dualRepresentationSigns: ["taurus"],
      totalUniqueSigns: 3,
      totalRepresentationPositions: 4
    });
  });

  it("recovers from an invalid wallet without making an RPC for it", async () => {
    const connection = mockSolanaConnection();
    const scan = vi.spyOn(connection, "getParsedTokenAccountsByOwner");
    const readWallet = (address: string) =>
      getCrossChainZodiacsOwnership({ solana: { connection, ownerAddress: address } });

    await expect(readWallet("invalid")).rejects.toMatchObject({ code: "invalid-wallet-address" });
    expect(scan).not.toHaveBeenCalled();
    const empty = await readWallet(ownerAddress);
    expect(scan).toHaveBeenCalledOnce();
    expect(getZodiacIdentityContext(empty, { date })).toMatchObject({
      heldSigns: [],
      confirmedAbsentSigns: ZODIAC_SIGNS
    });
  });
});
