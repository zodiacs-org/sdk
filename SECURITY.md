# Security

## Reporting a vulnerability

Please report security problems privately, not in a public issue: by email
to admin@zodiacs.org, or through the **Report a vulnerability** button on
this repository's Security tab where GitHub shows it.

Include:

- the version: the `@zodiacs/sdk` version you installed, or the commit you
  built;
- where the problem is: the entry point and function, the file and line, or
  the app's API route;
- how to reproduce it: the smallest input or script that shows it, and what
  happens when you run it;
- what someone could do with it, as far as you can tell.

Leave private keys and seed phrases out of the report; the SDK never needs
them.

Please do not publish the details until a fix is released or we have agreed
a date with you.

## Scope

The SDK is read-only. It must not request private keys, sign messages,
submit transactions, approve transfers, custody assets, swap, trade, or move
assets. Security reviews should focus on registry correctness, provenance,
address validation, RPC error handling, and accidental transaction-capable
code entering core modules.

This policy covers:

- **The package**, `@zodiacs/sdk`: its source in `packages/sdk/src/`, every
  entry point and file it ships, and the official registry in
  `packages/sdk/registry/` with its SHA-256 checksum.
- **Its build scripts and workflows**: the npm scripts in `package.json` and
  `packages/sdk/package.json`, the scripts in `packages/sdk/scripts/`, and
  the workflows in `.github/workflows/`.
- **The examples** in `examples/`.
- **The Zodia app** in `apps/zodia/`, a separate consumer app built on the
  SDK: its pages, API routes and server code.

Examples of what to report: an address that the SDK treats as official, or
matches to the wrong sign, chain or origin, when the published Zodiacs.org
registry says otherwise; a registry file in a published package that does
not match its checksum; an RPC response that makes an ownership read hang,
or report a sign as held or confirmed absent when the read failed; code in a
core module that can request a private key, sign, or build or submit a
transaction; an app API route that accepts a request without the wallet
session, signature or secret it should require; a workflow that exposes a
token or runs code from a pull request it should not trust.

These are not vulnerabilities in themselves:

- false balances or other chain state from an RPC endpoint or client the
  caller supplies, which the SDK trusts;
- values that DEX Screener or Jupiter return, which the optional market
  adapters pass on as display context;
- any other wrong value, such as a season, identity context or a formatted
  amount. Report it with the "Wrong result" issue form.

The zodiacs.org website is covered by the security policy of
[zodiacs-org/site](https://github.com/zodiacs-org/site); the same email
address applies. Problems in viem itself belong to
[its repository](https://github.com/wevm/viem); tell us as well if this
package is affected.

## Supported versions

Only the latest release of `@zodiacs/sdk` is supported, and fixes ship in a
new release. Earlier versions, including 1.0.0-rc.1, are not patched. The
examples and the Zodia app are supported on `main` only.
