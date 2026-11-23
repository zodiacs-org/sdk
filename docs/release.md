# Release Discipline

This repository ships the official read-only integration layer for the Zodiacs.org registry. Release work should preserve the SDK's role as public registry, provenance, ownership, and symbolic identity infrastructure.

## Release Readiness

Before cutting a release:

- Confirm the package version in `packages/sdk/package.json`.
- Confirm root imports stay React-free and do not export market adapters.
- Confirm React hooks are only available through `@zodiacs/sdk/react`.
- Confirm UI primitives are only available through `@zodiacs/sdk/ui`.
- Confirm market context is only available through `@zodiacs/sdk/market`.
- Confirm core, registry, Base, Solana, identity, and testing modules do not import React.
- Confirm no SDK core module creates wallet clients, signs messages, signs transactions, submits transactions, requests private keys, or moves assets.
- Confirm registry JSON and TypeScript registry exports stay in sync.
- Confirm the registry checksum is current.

## Required Commands

Run from the repository root with Chrome and Swift installed. Set `CHROME_BIN` to use another Chromium executable.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm registry:checksum
corepack pnpm neutrality:guard
corepack pnpm test
corepack pnpm build
corepack pnpm bench
corepack pnpm exports:smoke
corepack pnpm docs:smoke
corepack pnpm pack:dry-run
corepack pnpm package:contents
```

## Offline benchmark

After building the SDK, run `corepack pnpm bench`. A fresh Node process measures startup through the first identity context from the built package. It records JS heap usage at that point. It then computes 12 fixed charts with the pinned engine development dependency and resolves 1,200 SDK contexts against the same cross-chain ownership fixture. Chart and context timings are reported separately. CI checks the number of held Sun placements, startup under 3 seconds and 64 MiB of JS heap, and less than 8 MiB of retained heap growth across the context loop, measured after garbage collection. The benchmark and wallet integration fixtures run without RPC endpoints or credentials.

## Vercel preview settings

| Project            | Dashboard action                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdk-zodia-launch` | Under Settings > Build and Deployment, set Root Directory to `apps/zodia`, Framework Preset to `Next.js`, and use the preset defaults for Build Command and Output Directory. |
| `sdk-zodia`        | Once the budget owner is ready to resume service, open Settings > General > Pause Project and select **Resume Project**.                                                      |

On PRs #28, #29 and #30, the launch project used the repository root and the Other preset. The root build creates the SDK and two Next.js examples. Vercel then looked for a static `public` output and reported `STATIC_BUILD_NO_OUT_DIR`. The Zodia Next.js workspace has its own build, public assets and cron configuration in `apps/zodia/vercel.json`.

The `sdk-zodia` project already used `apps/zodia` and the Next.js preset. Vercel marked all three previews `BLOCKED` before the first build event. Its project activity records a Spend Management pause on 2026-09-20, and the production endpoint returned HTTP 503 with `DEPLOYMENT_PAUSED`. Resuming the project restores production service as well. [Vercel project settings](https://vercel.com/docs/projects/managing-projects#resuming-a-project)

## npm Publishing Checklist

- Review `corepack pnpm pack:dry-run` output and verify it contains only package files needed by downstream consumers.
- Run `corepack pnpm package:contents` to fail on raw source, tests, snapshots,
  build info files, or stale generated junk in the npm package.
- Verify `dist/*.d.ts` exists for every exported subpath.
- Verify `packages/sdk/registry/zodiacs.registry.json` and `zodiacs.registry.sha256` are included.
- Verify `README.md`, `CHANGELOG.md`, `LICENSE`, and package metadata are included.
- Publish only from a clean release branch after CI is green.

## GitHub Release Checklist

- Link the merged pull request.
- Include compatibility notes for root and subpath imports.
- Mention any migration notes for explicit market imports.
- Mention registry checksum status.
- Mention examples and docs added or changed.
- Do not include asset-promotion, trading, crypto-incentive, or wallet ownership access control language.

## 1.0 Candidate Criteria

A 1.0 release candidate should have:

- Batched Base ownership reads with fallback coverage.
- Wallet-level Solana token account discovery with fallback coverage.
- Module-resolution smoke tests for Node16, NodeNext, and Bundler.
- Fixture exports for app test suites.
- Native iOS read-only API docs.
- Base app starter checks in CI.
- `unavailableSigns` and `confirmedAbsentSigns` semantics that never treat
  failed reads as confirmed absent.
- Reconciled native/bridged counts where
  `nativeCount + bridgedCount - dualRepresentationCount === totalUniqueSigns`.
- Clear security posture and read-only threat model docs.
