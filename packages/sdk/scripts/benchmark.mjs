import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

// The package script starts a fresh Node process. Include startup, the built
// public entry and its first usable result, before loading any fixtures.
const { getZodiacIdentityContext } = await import("@zodiacs/sdk");
const first = getZodiacIdentityContext(
  { holdings: [] },
  { date: new Date("2000-01-15T12:00:00Z") }
);
const coldMs = performance.now();
const coldHeapMiB = process.memoryUsage().heapUsed / 2 ** 20;
assert.equal(first.currentSeason.sign, "capricorn");

const { natalChart, signForLongitude } = await import("@zodiacs/engine/core");
const { mockMixedCrossChainOwnership } = await import("@zodiacs/sdk/testing");
const chartStart = performance.now();
const placements = Array.from({ length: 12 }, (_, month) => {
  const date = new Date(Date.UTC(2000, month, 15, 12));
  const chart = natalChart({ utc: date, latitude: 40, longitude: -74 });
  return {
    date,
    sunSign: chart.bodies.find((row) => row.body === "Sun").sign,
    moonSign: chart.bodies.find((row) => row.body === "Moon").sign,
    risingSign: signForLongitude(chart.angles.asc).slug
  };
});
const chartMs = performance.now() - chartStart;

function resolveBatch() {
  let heldSuns = 0;
  for (const placement of placements) {
    const context = getZodiacIdentityContext(mockMixedCrossChainOwnership, placement);
    heldSuns += Number(context.alignments[0].held);
  }
  return heldSuns;
}

assert.equal(resolveBatch(), 3);
global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const rounds = 100;
let heldSuns = 0;
const start = performance.now();
for (let i = 0; i < rounds; i++) heldSuns += resolveBatch();
const contextMs = performance.now() - start;
global.gc();
const retainedMiB = (process.memoryUsage().heapUsed - heapBefore) / 2 ** 20;

console.log(
  `Node ${process.versions.node}: cold start ${coldMs.toFixed(1)} ms (${coldHeapMiB.toFixed(2)} MiB heap), ` +
    `${placements.length} charts in ${chartMs.toFixed(1)} ms, ` +
    `${rounds * placements.length} contexts in ${contextMs.toFixed(1)} ms, ` +
    `retained heap change ${retainedMiB.toFixed(2)} MiB`
);
assert.equal(heldSuns, 3 * rounds);
assert.ok(coldMs < 3000, "SDK startup through first context exceeded 3000 ms");
assert.ok(coldHeapMiB < 64, "SDK startup used 64 MiB or more of JS heap");
assert.ok(retainedMiB < 8, "SDK retained heap grew by 8 MiB or more");
