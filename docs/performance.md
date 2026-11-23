# Performance Notes

## Base

`getBaseZodiacsOwnership` uses viem `readContracts` when present. It batches ERC-20 `balanceOf` calls and
caches ERC-20 decimals per public client, chain, and token address. Pass `blockTag: "safe"` for consumer UI
that prefers safer chain state over pending data.

## Solana

`getSolanaZodiacsOwnership` uses wallet-level SPL token account discovery and maps token accounts to official
registry mints. It avoids one RPC request per sign for ownership reads.

If an RPC does not support the parsed wallet-level scan, the SDK falls back to per-mint reads so apps still get
a typed ownership result. Keep network functions injected through a connection object in tests so this fallback
is easy to mock.

## UI

Core, registry, Base, and Solana entrypoints do not import React. React hooks and UI components are imported
only from explicit `react` and `ui` subpaths.

## Imports and tree shaking

The SDK publishes one ESM implementation for each JavaScript entry point. CommonJS
callers can use dynamic `import()` and share the same registry and error classes.
NodeNext and Bundler resolve the `types` condition inside each `import` branch.
A separate `typesVersions` map would duplicate those paths for older resolvers.
For Node16 resolution with viem 2.51, use `skipLibCheck` for viem and ox's mixed
CommonJS and ESM declarations. NodeNext and Bundler support full declaration checking.

The SDK imports address helpers from `ox/Address` and the ERC-20 ABI from
`abitype/abis`. This keeps viem's WebSocket transport and Node builtins out of
worker bundles, including those that omit the `browser` condition.

The package declares `sideEffects: false`. The packed-consumer smoke test bundles
a single root formatting helper and checks that the output omits viem, React,
the registry addresses and the ownership readers. It also exercises all JavaScript
entry points in Chromium, a Web Worker and an Edge Runtime VM.
