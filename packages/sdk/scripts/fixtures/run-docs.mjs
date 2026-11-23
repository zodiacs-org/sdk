// Copied into the standalone consumer so imports resolve only from its installation.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { createMockOwnership } from "@zodiacs/sdk/testing";
import { getBaseZodiacRepresentation } from "@zodiacs/sdk/base";

const baseAddress = "0x1111111111111111111111111111111111111111";
const solanaAddress = "CWKQJJYec89wcx871C8vmyTPc3jhsdoAYs5aGffUtELJ";
process.env.BASE_RPC_URL = "https://base.invalid";
process.env.SOLANA_RPC_URL = "https://solana.invalid";
const unexpected = [];
const methods = new Set();
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const { id, method, params } = await request.json();
  methods.add(method);
  let result;
  if (method === "getTokenAccountsByOwner") result = { value: [] };
  else if (method === "eth_blockNumber") result = "0x64";
  else if (method === "eth_call") {
    const call = params[0];
    const amount = call.data.startsWith("0x313ce567")
      ? 18
      : Number(
          call.to.toLowerCase() === getBaseZodiacRepresentation("aries").address.toLowerCase()
        );
    result = "0x" + amount.toString(16).padStart(64, "0");
  } else {
    unexpected.push(method);
    throw new Error(`Unexpected RPC method ${method}`);
  }
  return Response.json({ jsonrpc: "2.0", id, result });
};

const ownership = createMockOwnership({ heldSigns: ["aries"] });
const publicClient = createPublicClient({ chain: base, transport: http() });
for (const { path, location, expectedLogs } of JSON.parse(readFileSync("modules.json", "utf8"))) {
  console.log(location);
  try {
    const logs = [];
    const log = console.log;
    let snippet;
    try {
      console.log = (...values) => logs.push(values);
      snippet = await import(`./js/${path}`);
    } finally {
      console.log = log;
    }
    expectedLogs.forEach((expected, i) => {
      if (expected.length) assert.deepEqual(logs[i], expected);
    });
    for (const [name, fn] of Object.entries(snippet)) {
      if (name === "GET") {
        const url = new URL("https://example.org/api/zodiacs/context");
        url.search = new URLSearchParams({ baseAddress, solanaAddress });
        // Single-chain routes read the path parameter. Choose its chain from the documented read.
        const address = path.endsWith("/solana-route.js") ? solanaAddress : baseAddress;
        const response = await fn(new Request(url), { params: Promise.resolve({ address }) });
        const body = await response.json();
        const result = body.ownership ?? body;
        if (result.base) {
          assert.deepEqual(result.base.heldSigns, ["aries"]);
          assert.equal(result.base.blockNumber, "100");
          assert.deepEqual(result.solana.errors, []);
          const empty = await (
            await fn(new Request("https://example.org/api/zodiacs/context"))
          ).json();
          assert.deepEqual(empty.identity.heldSigns, []);
        } else {
          assert.deepEqual(result.errors, []);
          assert.deepEqual(result.heldSigns, result.chain === "base" ? ["aries"] : []);
        }
      } else if (name === "walletContext") {
        assert.deepEqual((await fn()).verifiedZodiacHoldings, []);
        const context = await fn(baseAddress, solanaAddress);
        assert.deepEqual(context.verifiedZodiacHoldings, ["aries"]);
        writeFileSync("wallet-context.json", JSON.stringify(context));
      } else if (name === "getResonancePreview") {
        assert.deepEqual(fn(ownership)[0].facets, ["Courage", "Momentum", "Initiative"]);
      } else {
        assert.ok(
          renderToStaticMarkup(createElement(fn, { ownership, publicClient, address: baseAddress }))
            .length > 0
        );
      }
    }
  } catch (cause) {
    throw new Error(`Failed documentation example at ${location}`, { cause });
  }
}
assert.deepEqual(unexpected, []);
assert.deepEqual([...methods].sort(), ["eth_blockNumber", "eth_call", "getTokenAccountsByOwner"]);
