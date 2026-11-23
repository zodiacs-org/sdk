# API Reference

Use subpath imports for tree-shakable apps:

```ts
import { getZodiacIdentityContext } from "@zodiacs/sdk/core";
import { getBaseZodiacsOwnership } from "@zodiacs/sdk/base";
import { getSolanaZodiacsOwnership } from "@zodiacs/sdk/solana";
import { getConsumerSafeWalletContext } from "@zodiacs/sdk/identity";
import { getZodiacIconAsset } from "@zodiacs/sdk/assets";
import { useBaseZodiacsOwnership } from "@zodiacs/sdk/react";
import { ProfileSummaryCard } from "@zodiacs/sdk/ui";
```

## Entrypoints

- `@zodiacs/sdk`: compatibility root export.
- `@zodiacs/sdk/core`: registry, verification, identity, seasons, cross-chain helpers.
- `@zodiacs/sdk/registry`: registry/provenance/address verification helpers.
- `@zodiacs/sdk/base`: Base bridged ERC-20 read helpers.
- `@zodiacs/sdk/solana`: Solana native SPL read helpers.
- `@zodiacs/sdk/identity`: identity, receipt, wheel, share-card, seasonal, compatibility, and consumer-safe helpers.
- `@zodiacs/sdk/market`: optional market context adapters.
- `@zodiacs/sdk/react`: optional React hooks.
- `@zodiacs/sdk/ui`: optional React UI primitives.
- `@zodiacs/sdk/testing`: typed fixtures and mock clients.
- `@zodiacs/sdk/assets`: official display asset metadata and packaged icon paths.

The SDK JavaScript entrypoints use ESM. From CommonJS, load them with
`await import("@zodiacs/sdk")` or a documented subpath. Synchronous `require()`
has no export target.

## Read APIs

- `getBaseZodiacsOwnership(publicClient, owner, options)`
- `getBaseZodiacsOwnershipBatched(publicClient, owner, options)`
- `getSolanaZodiacsOwnership(connection, owner, options)`
- `getSolanaZodiacsOwnershipBatched(connection, owner, options)`
- `getCrossChainZodiacsOwnership({ base, solana, signal, timeoutMs })`

Base options include `includeZeroBalances`, `minBalance`, `blockNumber`, `blockTag`, `signal`, and
`onPartialFailure`. A client with an explicit chain ID must target Base mainnet
(8453). When the client supplies a latest block number, the ownership reader
pins both balance and decimals calls to that height. Tagged reads such as
`safe` and `finalized` omit the numeric height. Failed reads appear in
`unavailableSigns`, and cancelled ownership requests reject.

Ownership responses distinguish checked absence from read failures:

- `heldSigns`: signs with balances that satisfy the read threshold.
- `confirmedAbsentSigns`: signs that were checked and had zero balance.
- `unavailableSigns`: signs that could not be checked because an RPC or parsing
  step failed.

### Cancellation and deadlines

Pass `{ signal, timeoutMs }` to a balance or ownership read, or include the fields in
the options object for an injected reader, cross-chain read or network-backed hook.
Both are optional. The deadline covers the entire call, including block lookup,
batch reads, response decoding and per-mint fallback. Use a whole number of
milliseconds from 0 to 2147483647. A zero deadline expires before the first request.

Balance and ownership promises reject with the caller's abort reason or a
`TimeoutError` DOMException. An invalid timeout rejects with `RangeError`. Hooks
surface failures in their error state and cancel stale reads on cleanup.
Market adapters retain their snapshot contract and map cancellation to
`status: "unavailable"` with an `adapter-error`.

The SDK passes the signal to its own fetch calls, injected balance readers
and Base contract requests. A custom Solana connection can implement
`getParsedTokenAccountsByOwnerWithSignal(owner, filter, signal)` to cancel transport work.
Legacy clients may finish an outstanding request after the SDK promise settles.

### Input and formatting contracts

`validateWalletAddress` and `validateMintAddress` require Base58 strings decoding
to exactly 32 bytes. `isSolanaSignatureLike` from `@zodiacs/sdk/solana` checks
the Base58 encoding and 64-byte width alone. Authenticity requires separate
cryptographic verification.

`formatTokenAmount` preserves exact unsigned base units at scales from 0 to 18.
Use a digit string or bigint for amounts above the safe integer range. Its
default output uses a decimal point and trims trailing fractional zeroes.
`rawAmountToNumber` is approximate. Season helpers take a valid JavaScript
`Date`, use UTC calendar boundaries and return inclusive ISO dates.

## Identity APIs

- `getZodiacIdentityContext`
- `getIdentityReceiptData`
- `getIdentityReceiptFacts`
- `getDominantElement`
- `getDominantModality`
- `getZodiacWheelData`
- `getShareCardContext`
- `getCompatibilityContext`
- `getSeasonalContext`
- `getConsumerSafeWalletContext`
- `mergeZodiacsOwnership`

These return display-ready facts, not horoscopes, price predictions, or financial advice.

## Asset APIs

- `getAllZodiacIconAssets()`
- `getZodiacIconAsset(sign)`
- `getZodiacIconAssetPath(sign)`

The package also exports direct PNG subpaths such as
`@zodiacs/sdk/assets/zodiac-icons/circle/leo.png` for bundlers and build
pipelines that copy image assets.

## Use-Case Guides

- [Symbolic resonance](./symbolic-resonance.md): app-side aura, tooltip, and
  share-card patterns powered by verified Zodiacs holdings.
