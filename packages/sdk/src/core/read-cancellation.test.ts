import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDexScreenerMarketAdapter,
  createJupiterMarketAdapter,
  getSolanaZodiacMarket
} from "../market.js";
import {
  createReadonlySolanaBalanceReader,
  createSolanaConnection,
  getBaseZodiacBalances,
  getBaseZodiacsOwnership,
  getCrossChainZodiacsOwnership,
  getSolanaZodiacBalance,
  getSolanaZodiacsOwnership,
  getZodiacToken,
  readZodiacsBalances,
  type SolanaBalanceConnection
} from "./index.js";

const wallet = "1".repeat(32);
const owner = "0x" + "1".repeat(40);
const pending = () => new Promise<never>(() => {});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("cancelled reads", () => {
  it("rejects a pre-aborted call with its reason before contacting either chain", async () => {
    const controller = new AbortController();
    const reason = new Error("view closed");
    controller.abort(reason);
    const read = vi.fn(pending);
    await expect(
      getCrossChainZodiacsOwnership({
        solana: { ownerAddress: wallet, connection: { getParsedTokenAccountsByOwner: read } },
        base: { ownerAddress: owner, publicClient: { readContract: read } },
        signal: controller.signal,
        timeoutMs: 100
      })
    ).rejects.toBe(reason);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([-1, 0.5, NaN, Infinity, 2147483648])(
    "rejects invalid timeout %s before dispatch",
    async (timeoutMs) => {
      const read = vi.fn(pending);
      await expect(
        getSolanaZodiacBalance({ getParsedTokenAccountsByOwner: read }, wallet, "aries", {
          timeoutMs
        })
      ).rejects.toThrow(RangeError);
      expect(read).not.toHaveBeenCalled();
    }
  );

  it("treats a zero deadline as immediately expired", async () => {
    const read = vi.fn(pending);
    await expect(
      getBaseZodiacBalances({ readContract: read }, owner, { timeoutMs: 0 })
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(read).not.toHaveBeenCalled();
  });

  it("cancels fetch body decoding on a connection created before the read", async () => {
    const controller = new AbortController();
    const body = vi.fn(pending);
    const fetch = vi.fn(async (_url, _init: RequestInit) => ({ ok: true, json: body }));
    vi.stubGlobal("fetch", fetch);
    const connection = createSolanaConnection("https://solana.example");
    const read = getSolanaZodiacsOwnership(connection, wallet, { signal: controller.signal });
    await Promise.resolve();
    expect(body).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1].signal).toBe(controller.signal);
    controller.abort();
    await expect(read).rejects.toBe(controller.signal.reason);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("shares one deadline across wallet scan and all fallback mints", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const connection: SolanaBalanceConnection = {
      getParsedTokenAccountsByOwner: vi.fn(pending),
      getParsedTokenAccountsByOwnerWithSignal: async (_owner, filter, signal) => {
        signals.push(signal);
        if ("programId" in filter) {
          await new Promise((resolve) => setTimeout(resolve, 8));
          throw new Error("unsupported scan");
        }
        return pending();
      }
    };
    const result = expect(
      getSolanaZodiacsOwnership(connection, wallet, { timeoutMs: 10, onPartialFailure: "ignore" })
    ).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(8);
    expect(signals).toHaveLength(13);
    expect(new Set(signals).size).toBe(1);
    await vi.advanceTimersByTimeAsync(2);
    await result;
    expect(signals[0]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops after a cancelled Base block lookup even if the client finishes later", async () => {
    vi.useFakeTimers();
    const batch = vi.fn(pending);
    const getBlockNumber = vi.fn(
      () => new Promise<bigint>((resolve) => setTimeout(() => resolve(100n), 30))
    );
    const result = expect(
      getBaseZodiacsOwnership(
        { readContract: pending, readContracts: batch, getBlockNumber },
        owner,
        { timeoutMs: 5 }
      )
    ).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(5);
    await result;
    await vi.advanceTimersByTimeAsync(25);
    expect(batch).not.toHaveBeenCalled();
  });

  it("prevents a late Base decimals result from warming the cache for a later read", async () => {
    const controller = new AbortController();
    let finish!: (value: unknown) => void;
    const batch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce(Array(12).fill({ status: "success", result: 2 }))
      .mockResolvedValueOnce(Array(12).fill({ status: "success", result: 100n }));
    const client = { readContract: pending, readContracts: batch };
    const first = getBaseZodiacBalances(client, owner, { signal: controller.signal });
    expect(batch.mock.calls[0]?.[0].signal).toBe(controller.signal);
    controller.abort();
    await expect(first).rejects.toBe(controller.signal.reason);
    finish(Array(12).fill({ status: "success", result: 6 }));
    await Promise.resolve();
    await Promise.resolve();
    const second = await getBaseZodiacBalances(client, owner);
    expect(second[0]?.uiAmountString).toBe("1");
    expect(batch).toHaveBeenCalledTimes(3);
  });

  it("cancels injected balance readers as a group, including the URL-backed reader", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(pending);
    const subscribe = vi.spyOn(controller.signal, "addEventListener");
    vi.stubGlobal("fetch", fetch);
    const reader = createReadonlySolanaBalanceReader("https://solana.example");
    const read = readZodiacsBalances({ reader, ownerAddress: wallet, signal: controller.signal });
    expect(fetch).toHaveBeenCalledTimes(12);
    expect(subscribe).toHaveBeenCalledOnce();
    controller.abort();
    await expect(read).rejects.toBe(controller.signal.reason);
  });

  it.each([createDexScreenerMarketAdapter, createJupiterMarketAdapter])(
    "keeps direct market reads and safe wrappers cancellable",
    async (createAdapter) => {
      vi.useFakeTimers();
      const fetch = vi.fn(async (_url, _init?: RequestInit) => pending());
      const adapter = createAdapter({ fetchImpl: fetch });
      const options = { sign: "aries", token: getZodiacToken("aries"), timeoutMs: 7 } as const;
      const reads = [
        adapter.readMarket(options),
        getSolanaZodiacMarket(adapter, "aries", { timeoutMs: 7 })
      ];
      await vi.advanceTimersByTimeAsync(7);
      for (const read of reads) {
        await expect(read).resolves.toMatchObject({
          status: "unavailable",
          error: { code: "adapter-error" }
        });
      }
      for (const [, init] of fetch.mock.calls)
        expect(init?.signal?.reason.name).toBe("TimeoutError");
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("releases listeners and timers whichever of completion, abort or deadline wins", async () => {
    vi.useFakeTimers();
    // Exhaust all orderings, including ties (timers fire in registration order).
    for (const completion of [1, 2, 3]) {
      for (const abortAt of [1, 2, 3]) {
        const controller = new AbortController();
        const add = vi.spyOn(controller.signal, "addEventListener");
        const remove = vi.spyOn(controller.signal, "removeEventListener");
        const connection = {
          getParsedTokenAccountsByOwner: () =>
            new Promise<{ value: [] }>((resolve) =>
              setTimeout(() => resolve({ value: [] }), completion)
            )
        };
        const read = getSolanaZodiacBalance(connection, wallet, "aries", {
          timeoutMs: 2,
          signal: controller.signal
        });
        const result =
          completion === 1
            ? expect(read).resolves.toMatchObject({ status: "zero" })
            : expect(read).rejects.toMatchObject({
                name: abortAt === 1 ? "AbortError" : "TimeoutError"
              });
        setTimeout(() => controller.abort(), abortAt);
        await vi.runAllTimersAsync();
        await result;
        expect(remove.mock.calls).toEqual(add.mock.calls);
        expect(vi.getTimerCount()).toBe(0);
      }
    }
  });
});
