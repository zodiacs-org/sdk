# Native iOS Integration Guide

Native iOS apps should consume Zodiacs through a small read-only backend API
that imports `@zodiacs/sdk`. Swift and SwiftUI code should call that backend
over HTTPS and should not import the TypeScript SDK directly.

Wallet context is optional. A public address can add optional symbolic context
when verified zodiac holdings appear in the official registry. Wallet ownership
must not control paid digital features or core app access through this SDK.

## Architecture

```txt
Native SwiftUI app
-> Swift protocols
-> read-only backend API
-> @zodiacs/sdk on server
-> public Solana/Base reads
-> normalized JSON response
```

The backend accepts public addresses only. It never accepts wallet secrets,
never creates wallet clients, never signs messages, and never submits
transactions.

## Product Rules

- No wallet required.
- Wallet context disabled by default.
- Public ownership context is optional symbolic context.
- Wallet ownership must not control paid digital features or readings.
- No valuation, exchange, performance, or asset-acquisition flows.
- No wallet secrets, signatures, approvals, asset movement, custody, or on-chain
  action helpers.
- Treat Zodiacs as cultural assets and symbolic identity context.

## Recommended Swift Protocols

```swift
public protocol WalletReadOnlyProvider {
    var publicAddress: String? { get }
    var chain: String? { get }
}

public protocol ZodiacsIdentityProvider {
    func fetchZodiacsContext(
        wallet: WalletReadOnlyProvider?
    ) async throws -> ZodiacsContextResponse
}

public protocol ZodiacsReadOnlyAPIClient {
    func signs() async throws -> [ZodiacSign]
    func solanaOwnership(address: String) async throws -> ZodiacsOwnership
    func baseOwnership(address: String) async throws -> ZodiacsOwnership
    func context(request: ZodiacsContextRequest) async throws -> ZodiacsContextResponse
}
```

## Minimal Models

```swift
public typealias ZodiacSign = String

public struct ZodiacsOwnership: Decodable {
    public let heldSigns: [ZodiacSign]
}

public struct ZodiacsContextRequest: Encodable {
    public let baseAddress: String?
    public let solanaAddress: String?
}

public struct ZodiacsContextResponse: Decodable, Sendable {
    public let readOnly: Bool
    public let walletRequired: Bool
    public let headline: String
    public let description: String
    public let verifiedZodiacHoldings: [String]
    public let optionalContextFacts: [ZodiacFact]
}

public struct ZodiacFact: Decodable, Sendable {
    public let label: String
    public let value: String
}
```

## Backend SDK Usage

```ts
import { getCrossChainZodiacsOwnership } from "@zodiacs/sdk/core";
import { getConsumerSafeWalletContext } from "@zodiacs/sdk/identity";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });

export async function walletContext(baseAddress?: string, solanaAddress?: string) {
  const ownership = await getCrossChainZodiacsOwnership({
    ...(baseAddress && { base: { publicClient, ownerAddress: baseAddress } }),
    ...(solanaAddress && {
      solana: { connection: process.env.SOLANA_RPC_URL!, ownerAddress: solanaAddress }
    })
  });
  const publicAddress = baseAddress || solanaAddress;
  return getConsumerSafeWalletContext(ownership, publicAddress ? { publicAddress } : {});
}
```

## App Review Notes

Viewing publicly owned cultural assets can be framed as identity/profile
context. Keep wallet ownership optional, read-only, and separate from paid
digital access. Keep exchange, custody, asset movement, and crypto-incentive
flows outside SDK-backed experiences.
