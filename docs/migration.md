# Migration Notes

Existing Solana read APIs remain available:

- `getZodiacBalance`
- `getZodiacsOwnership`
- `getHeldZodiacs`

These compatibility helpers continue to read native Solana SPL assets.

React hooks and UI components now live behind explicit optional entrypoints so
server and backend imports from `@zodiacs/sdk` do not load React:

- move `useZodiacBalance`, `useZodiacToken`, and ownership hooks to
  `@zodiacs/sdk/react`
- move `ZodiacsPanel`, `ZodiacAssetCard`, `ZodiacShelf`, receipt, wheel, and
  profile components to `@zodiacs/sdk/ui`

New integrations should prefer explicit names:

- `getSolanaZodiacBalance`
- `getSolanaZodiacsOwnership`
- `getBaseZodiacBalance`
- `getBaseZodiacsOwnership`
- `getCrossChainZodiacsOwnership`

New integrations should also prefer subpath imports:

- `@zodiacs/sdk/core`
- `@zodiacs/sdk/market`
- `@zodiacs/sdk/registry`
- `@zodiacs/sdk/base`
- `@zodiacs/sdk/solana`
- `@zodiacs/sdk/identity`
- `@zodiacs/sdk/react`
- `@zodiacs/sdk/ui`
- `@zodiacs/sdk/testing`

Market adapters are no longer exported from the root entrypoint. Import them
from `@zodiacs/sdk/market` so server and registry consumers do not load optional
market context code by accident.

`useZodiacMarket` and `ZodiacMarketStrip` are deprecated compatibility shapes
and do not fetch or render market context. New market integrations should use
`@zodiacs/sdk/market` explicitly and keep that data outside consumer-safe SDK UI.

The key model change is that the SDK now exposes a canonical multi-chain
registry. Solana SPL mints are the native originals. Base ERC-20 addresses are
official bridged representations that point back to the Solana mint for the
same sign.

## Using engine 2.0.0 with SDK identity context

Apps that compute natal placements can install `@zodiacs/engine@2.0.0`
alongside `@zodiacs/sdk`. The engine computes charts. The SDK accepts the
resulting lowercase sign slugs and compares them with verified holdings.
The SDK's optional `date` selects a fixed UTC calendar season for the
display. Pass a birth instant there only for a view of the season at birth.

This example uses a known birth time and synthetic ownership.

```ts
import { natalChart, signForLongitude } from "@zodiacs/engine";
import { getZodiacIdentityContext } from "@zodiacs/sdk/identity";
import { createMockOwnership } from "@zodiacs/sdk/testing";

const natal = natalChart({
  utc: "1990-05-03T12:00:00Z",
  latitude: 40,
  longitude: -74,
  houseSystem: "whole"
});
const sun = natal.bodies.find((row) => row.body === "Sun");
const ownership = createMockOwnership({ heldSigns: ["taurus"] });
const context = getZodiacIdentityContext(ownership, {
  ...(sun && { sunSign: sun.sign }),
  ...(natal.angles && { risingSign: signForLongitude(natal.angles.asc).slug })
});

console.log(context.alignments);
```

- **Birth inputs.** Supply a full instant with an offset, a `Date`, or epoch
  milliseconds for a known time. For an unknown time, pass
  `{ utc: "1990-05-03", timeKnown: false }`. The chart has a `no-time` flag
  and null angles and houses. Omit the rising placement. For a local date
  with no time, `resolveLocalBirth` uses local noon with `timeKnown: false`.
  Bare birth dates and near-miss keys such as `lat`, `lng`, `houses`, and
  `scale` throw `RangeError`. Use `latitude`, `longitude`, `houseSystem`,
  and `timeScale` on birth objects.
- **Time and cached results.** After the last IERS instant
  (`2027-10-02T00:00:00.000Z`), unpinned UTC input uses TT = UTC + 69.184 s.
  The result can report `timeScale.basis === "continuous-utc"` and
  `timeScale.ut1MinusUtc?.source === "model"`. The input scale takes
  `"utc"`, `"ut1"`, or `"tt"`. Recompute affected cached calculations and
  prepare historical wall times with `await prepareLocalTime(date, timeZone)`
  before resolving them again. Preserve engine natal envelopes and their
  conventions for replay. A 1.1.0 reader returns `unsupported_feature` for a
  record requiring `time-basis-continuous-utc`. SDK identity receipts
  summarize verified holdings.
- **Result flags.** Use the engine's exported `ChartFlag`, `InstantFlag`, and
  `TimeScale` types for chart displays. Handle `polar-angles`,
  `calendar-unknown`, and `host-zone-data-differs`. The last two can also
  appear on a local resolution. Check optional `zone.hostCheck?.status`
  before reading probe offsets. Position, transit, and progressed rows can
  omit `flags`. Use `row.flags ?? []` when displaying warnings.
- **Imports and errors.** The engine root defaults to the shipped DE440 pack.
  The optional `@zodiacs/engine/core` entry uses astronomy-engine without the
  pack. Import `julianDayNumber`, `dateOfJulianDayNumber`, and
  `localMeanTimeOffset` from `@zodiacs/engine/geo`. The offset is in seconds
  east of Greenwich. On Node use 20.x from 20.19.0, or 22.7.0 and later,
  when loading the engine. CommonJS callers can use dynamic `import()`.
  Engine `require()` throws `ERR_ZODIACS_ESM_ONLY`, and an unknown body name
  in a crossing search throws `RangeError`.

[Engine 2.0.0 migration guide](https://github.com/zodiacs-org/engine/blob/v2.0.0/docs/migrating-to-2.md)
