import type { ReadOptions } from "./read-options.js";

/** Ordered lowercase registry slugs, from Aries through Pisces. */
export const ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
] as const;

/** One of the twelve lowercase keys in ZODIAC_SIGNS. */
export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

/** Element used to group signs in identity composition. */
export type ZodiacElement = "fire" | "earth" | "air" | "water";

/** Modality used to group signs in identity composition. */
export type ZodiacModality = "cardinal" | "fixed" | "mutable";

/** Chain name used for registry lookups and ownership provenance. */
export type ZodiacChain = "solana" | "base";

/** Distinguishes a token's native origin from its official bridged representation. */
export type ZodiacRepresentationKind = "native" | "bridged";

/** Registry spelling of the Solana or Base token standard. */
export type ZodiacTokenStandard = "SPL" | "ERC20";

/** Provenance of an official bridge from the native mint to Base. */
export interface ZodiacBridgeMetadata {
  readonly status: "official-bridged";
  readonly protocol?: "wormhole";
  readonly sourceChain: "solana";
  readonly destinationChain: "base";
  readonly notes?: string;
}

/** Chain-specific registry entry, including address, token standard and origin. */
export interface ZodiacRepresentation {
  readonly sign: ZodiacSign;
  readonly chain: ZodiacChain;
  readonly chainId?: number;
  readonly kind: ZodiacRepresentationKind;
  readonly tokenStandard: ZodiacTokenStandard;
  readonly address: string;
  readonly decimals?: number;
  readonly symbol?: string;
  readonly name?: string;
  readonly isCanonicalOrigin: boolean;
  readonly isOfficialRepresentation: boolean;
  readonly originChain?: "solana";
  readonly originAddress?: string;
  readonly bridge?: ZodiacBridgeMetadata;
}

/** Display attributes shared by a sign's native and bridged entries. */
export interface ZodiacAssetMetadata {
  readonly element: ZodiacElement;
  readonly modality: ZodiacModality;
  readonly rulingPlanet: string;
  readonly archetype: string;
  readonly dateRange: string;
  readonly shortBio?: string;
}

/** A sign's metadata, canonical native origin and complete set of chain representations. */
export interface ZodiacAsset {
  readonly sign: ZodiacSign;
  readonly displayName: string;
  readonly metadata: ZodiacAssetMetadata;
  readonly native: ZodiacRepresentation;
  readonly representations: readonly ZodiacRepresentation[];
}

/** Registry description of a supported chain and its representation standard. */
export interface ZodiacsSupportedChain {
  readonly chain: ZodiacChain;
  readonly chainId?: number;
  readonly kind: ZodiacRepresentationKind;
  readonly tokenStandard: ZodiacTokenStandard;
}

/** Versioned registry containing supported chains and the twelve official assets. */
export interface ZodiacsRegistry {
  readonly name: "Zodiacs Official Registry";
  readonly source: "https://zodiacs.org";
  readonly sdk: "@zodiacs/sdk";
  readonly version: string;
  readonly nativeChain: "solana";
  readonly supportedChains: readonly ZodiacsSupportedChain[];
  readonly assets: readonly ZodiacAsset[];
}

/** Provider URLs attached to a native token definition. */
export interface ZodiacMarketLinks {
  readonly dexScreener: string;
  readonly jupiter: string;
}

/** Inclusive month-day strings (MM-DD) for a fixed UTC calendar season. */
export interface ZodiacDateRange {
  readonly starts: string;
  readonly ends: string;
}

/** Display name, glyph, calendar range and symbolic attributes for one sign. */
export interface ZodiacMetadata {
  readonly sign: ZodiacSign;
  readonly name: string;
  readonly glyph: string;
  readonly element: ZodiacElement;
  readonly modality: ZodiacModality;
  readonly dateRange: ZodiacDateRange;
  readonly assetLine: string;
}

/** Native mint definition, including raw-unit decimals and display metadata. */
export interface ZodiacToken {
  readonly sign: ZodiacSign;
  readonly name: string;
  readonly slug: ZodiacSign;
  readonly ticker: string;
  readonly order: number;
  readonly element: ZodiacElement;
  readonly modality: ZodiacModality;
  readonly rulingPlanet: string;
  readonly symbol: string;
  readonly archetype: string;
  readonly shortBio: string;
  readonly decimals: number;
  readonly mintAddress: string;
  readonly marketLinks: ZodiacMarketLinks;
  readonly metadataUri?: string;
  readonly imageUri?: string;
}

/** Read-only sign-to-token lookup used by balance readers. */
export type ZodiacTokenRegistry = ReadonlyMap<ZodiacSign, ZodiacToken>;

/** Validity and human-readable diagnostics for a token registry. */
export interface ZodiacRegistryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Injected parsed-account connection or absolute Solana JSON-RPC URL. */
export type ConnectionOrRpcUrl = string | SolanaBalanceConnection;

/** RPC base units as an unsigned decimal string and their scale. Display fields are optional. */
export interface ParsedTokenAccountAmount {
  readonly amount: string;
  readonly decimals: number;
  readonly uiAmount?: number | null;
  readonly uiAmountString?: string;
}

/** Parsed token-account rows returned by Solana owner and mint scans. */
export interface ParsedTokenAccountResponse {
  readonly value: readonly {
    readonly account: {
      readonly data: {
        readonly parsed?: {
          readonly info?: {
            readonly mint?: string;
            readonly tokenAmount?: ParsedTokenAccountAmount;
          };
        };
      };
    };
  }[];
}

/** Selects parsed SPL accounts by mint or by token program. */
export type TokenAccountFilter = { readonly mint: unknown } | { readonly programId: unknown };

/** Minimal injected transport for parsed wallet scans and per-mint reads. */
export interface SolanaBalanceConnection {
  /** Optional transport hook for cancellation. Legacy connections keep their two-argument call. */
  readonly getParsedTokenAccountsByOwnerWithSignal?: (
    ownerAddress: unknown,
    filter: TokenAccountFilter,
    signal: AbortSignal
  ) => Promise<ParsedTokenAccountResponse>;
  readonly getParsedTokenAccountsByOwner: (
    ownerAddress: unknown,
    filter: TokenAccountFilter
  ) => Promise<ParsedTokenAccountResponse>;
}

/** Reader-level token balance with exact raw units and optional approximate UI amount. */
export interface TokenBalance {
  readonly ownerAddress: string;
  readonly mintAddress: string;
  readonly amountRaw: string;
  readonly decimals: number;
  readonly uiAmount: number | null;
}

/** Positive balance, confirmed zero, or an unavailable read. */
export type ZodiacBalanceReadStatus = "ok" | "zero" | "unavailable";

/** Distinguishes a failed Solana RPC call from an invalid parsed response. */
export interface ZodiacBalanceError {
  readonly code: "rpc-error" | "invalid-rpc-response";
  readonly message: string;
}

/** Per-sign native balance and provenance. Inspect status before interpreting its amount. */
export interface ZodiacBalance {
  readonly sign: ZodiacSign;
  readonly token: ZodiacToken;
  readonly representation: ZodiacRepresentation;
  readonly chain: "solana";
  readonly kind: "native";
  readonly tokenStandard: "SPL";
  readonly walletAddress: string;
  readonly mintAddress: string;
  readonly rawAmount: string;
  readonly decimals: number;
  readonly uiAmount: number;
  readonly uiAmountString: string;
  readonly status: ZodiacBalanceReadStatus;
  readonly error?: ZodiacBalanceError;
}

/** Associates a native token and its balance with a positive-ownership flag. */
export interface ZodiacsHolding {
  readonly sign: ZodiacSign;
  readonly token: ZodiacToken;
  readonly balance: ZodiacBalance;
  readonly held: boolean;
}

/** Indicates whether all, some or none of the requested signs could be checked. */
export type ZodiacsOwnershipStatus = "available" | "partial" | "unavailable";

/** Wallet-level Solana snapshot separating held, confirmed-zero and unavailable signs. */
export interface ZodiacsOwnership {
  readonly owner?: string;
  readonly walletAddress: string;
  readonly chain?: "solana";
  readonly checkedAt?: string;
  readonly status: ZodiacsOwnershipStatus;
  readonly holdings: readonly ZodiacsHolding[];
  readonly heldSigns: readonly ZodiacSign[];
  readonly zeroBalanceSigns?: readonly ZodiacSign[];
  readonly unavailableSigns?: readonly ZodiacSign[];
  readonly confirmedAbsentSigns?: readonly ZodiacSign[];
  readonly balancesBySign?: Readonly<Record<ZodiacSign, ZodiacBalance>>;
  readonly representations?: readonly ZodiacRepresentation[];
  readonly totalHeld: number;
  readonly errors: readonly ZodiacBalanceError[];
  readonly warnings?: readonly ZodiacSerializableError[];
}

/** Injected balance lookup. Resolve null for no balance and reject for read failure. */
export interface ReadonlyZodiacBalanceReader {
  readonly getTokenBalance: (
    ownerAddress: string,
    mintAddress: string,
    token: ZodiacToken,
    options?: ReadOptions
  ) => Promise<TokenBalance | null>;
}

/** Reader-level outcome. A not-found result means the reader returned null. */
export type ZodiacBalanceStatus = "available" | "missing-mint" | "not-found" | "unavailable";

/** Token, optional balance and diagnostic reason returned by an injected read. */
export interface ZodiacBalanceResult {
  readonly sign: ZodiacSign;
  readonly token: ZodiacToken;
  readonly balance: TokenBalance | null;
  readonly status: ZodiacBalanceStatus;
  readonly reason?: string;
}

/** Owner, sign, injected reader and optional registry for one balance request. */
export interface ReadZodiacBalanceOptions extends ReadOptions {
  readonly ownerAddress: string;
  readonly sign: ZodiacSign;
  readonly reader: ReadonlyZodiacBalanceReader;
  readonly registry?: ZodiacTokenRegistry;
}

/** Owner, injected reader and optional registry for all twelve balance requests. */
export interface ReadZodiacsBalancesOptions extends ReadOptions {
  readonly ownerAddress: string;
  readonly reader: ReadonlyZodiacBalanceReader;
  readonly registry?: ZodiacTokenRegistry;
}

/** Plain code and message suitable for serializing an SDK read diagnostic. */
export interface ZodiacSerializableError {
  readonly code: string;
  readonly message: string;
}

/** One bridged token's exact ERC-20 base units, formatted balance and read status. */
export interface BaseZodiacBalance {
  readonly sign: ZodiacSign;
  readonly ownerAddress: string;
  readonly representation: ZodiacRepresentation;
  readonly chain: "base";
  readonly kind: "bridged";
  readonly tokenStandard: "ERC20";
  readonly rawAmount: string;
  readonly uiAmountString: string;
  readonly decimals: number;
  readonly status: ZodiacBalanceReadStatus;
  readonly error?: ZodiacSerializableError;
  readonly warning?: ZodiacSerializableError;
}

/** Associates a bridged balance with its threshold-based held flag. */
export interface BaseZodiacsHolding {
  readonly sign: ZodiacSign;
  readonly representation: ZodiacRepresentation;
  readonly balance: BaseZodiacBalance;
  readonly held: boolean;
}

/** Base ownership snapshot with per-sign outcomes and the block number when available. */
export interface BaseZodiacsOwnership {
  readonly owner: string;
  readonly ownerAddress: string;
  readonly chain: "base";
  readonly checkedAt?: string;
  readonly blockNumber?: bigint;
  readonly status: ZodiacsOwnershipStatus;
  readonly holdings: readonly BaseZodiacsHolding[];
  readonly heldSigns: readonly ZodiacSign[];
  readonly zeroBalanceSigns?: readonly ZodiacSign[];
  readonly unavailableSigns?: readonly ZodiacSign[];
  readonly confirmedAbsentSigns?: readonly ZodiacSign[];
  readonly balancesBySign?: Readonly<Record<ZodiacSign, BaseZodiacBalance>>;
  readonly representations?: readonly ZodiacRepresentation[];
  readonly totalHeld: number;
  readonly errors: readonly ZodiacSerializableError[];
  readonly warnings?: readonly ZodiacSerializableError[];
}

/** Independently optional native and bridged ownership snapshots. */
export interface CrossChainZodiacsOwnership {
  readonly solana?: ZodiacsOwnership;
  readonly base?: BaseZodiacsOwnership;
}

/** Per-sign held flags for each representation and their combined result. */
export interface UnifiedZodiacShelfItem {
  readonly sign: ZodiacSign;
  readonly held: boolean;
  readonly nativeHeld: boolean;
  readonly bridgedHeld: boolean;
  readonly representations: readonly ZodiacRepresentation[];
}

/** Twelve-sign shelf with each held sign counted once across chains. */
export interface UnifiedZodiacShelf {
  readonly label: "combined wallet holdings across official representations";
  readonly items: readonly UnifiedZodiacShelfItem[];
  readonly heldSigns: readonly ZodiacSign[];
  readonly totalHeld: number;
}

/** Counts indexed by the registry's element and modality names. */
export type ZodiacComposition = Record<ZodiacElement | ZodiacModality, number>;

/** Fixed UTC season with inclusive ISO calendar dates, including extended years. */
export interface ZodiacSeason {
  readonly sign: ZodiacSign;
  readonly displayName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly isCurrent: boolean;
}

/** Current UTC season plus elapsed percentage rounded to two decimals. */
export interface ZodiacSeasonProgress extends ZodiacSeason {
  readonly progress: number;
}

/** Optional sun, moon and rising sign placements supplied by the caller. */
export interface ZodiacIdentityAlignmentInput {
  readonly sunSign?: ZodiacSign;
  readonly moonSign?: ZodiacSign;
  readonly risingSign?: ZodiacSign;
}

/** One supplied chart placement and whether its sign is held. */
export interface ZodiacIdentityAlignment {
  readonly placement: "sun" | "moon" | "rising";
  readonly sign: ZodiacSign;
  readonly held: boolean;
}

/** Unique signs, dual holdings and separate representation counts across chains. */
export interface ZodiacNativeBridgedSummary {
  readonly nativeHeldSigns: readonly ZodiacSign[];
  readonly bridgedHeldSigns: readonly ZodiacSign[];
  readonly dualRepresentationSigns: readonly ZodiacSign[];
  readonly nativeCount: number;
  readonly bridgedCount: number;
  readonly dualRepresentationCount: number;
  readonly totalUniqueSigns: number;
  readonly totalRepresentationPositions: number;
  /** @deprecated Use nativeCount. */
  readonly nativeHeld: number;
  /** @deprecated Use bridgedCount. */
  readonly bridgedHeld: number;
  /** @deprecated Use totalUniqueSigns. */
  readonly combinedHeld: number;
  readonly heldSigns: readonly ZodiacSign[];
}

/** Display-ready label and value for one public ownership fact. */
export interface ZodiacReceiptFact {
  readonly label: string;
  readonly value: string;
}

/** Display attributes and per-chain held flags for one wheel segment. */
export interface ZodiacWheelDataItem {
  readonly sign: ZodiacSign;
  readonly displayName: string;
  readonly glyph?: string;
  readonly held: boolean;
  readonly nativeHeld: boolean;
  readonly bridgedHeld: boolean;
  readonly element: ZodiacElement;
  readonly modality: ZodiacModality;
}

/** Ordered twelve-segment wheel with percentage coverage and confirmed absence. */
export interface ZodiacWheelData {
  readonly items: readonly ZodiacWheelDataItem[];
  readonly heldSigns: readonly ZodiacSign[];
  readonly confirmedAbsentSigns: readonly ZodiacSign[];
  readonly coverage: number;
  readonly totalUniqueSigns: number;
}

/** Current and next UTC seasons with the current sign's held status. */
export interface ZodiacSeasonalContext {
  readonly currentSeason: ZodiacSeason;
  readonly nextSeason: ZodiacSeason;
  readonly currentSeasonHeld: boolean;
  readonly seasonSign: ZodiacSign;
  readonly seasonDisplayName: string;
  readonly heldSigns: readonly ZodiacSign[];
}

/** Shared and distinct signs, overlap and combined coverage for two shelves. */
export interface ZodiacCompatibilityContext {
  readonly firstHeldSigns: readonly ZodiacSign[];
  readonly secondHeldSigns: readonly ZodiacSign[];
  readonly sharedSigns: readonly ZodiacSign[];
  readonly firstOnlySigns: readonly ZodiacSign[];
  readonly secondOnlySigns: readonly ZodiacSign[];
  readonly overlapCount: number;
  readonly overlapPercentage: number;
  readonly combinedUniqueSigns: readonly ZodiacSign[];
  readonly combinedCoverage: number;
  readonly sharedElements: readonly ZodiacElement[];
  readonly sharedModalities: readonly ZodiacModality[];
  readonly shareTitle: string;
  readonly shareDescription: string;
}

/** Display title, description, season and ownership facts for a shareable summary. */
export interface ZodiacShareCardContext {
  readonly title: string;
  readonly description: string;
  readonly heldSigns: readonly ZodiacSign[];
  readonly wheelCoverage: number;
  readonly currentSeason: ZodiacSeason;
  readonly currentSeasonHeld: boolean;
  readonly facts: readonly ZodiacReceiptFact[];
}

/** Optional public wallet context with presentation copy and season facts. */
export interface ConsumerSafeWalletContext {
  readonly connectedWalletLabel: string;
  readonly readOnly: true;
  readonly walletRequired: false;
  readonly publicAddress?: string;
  readonly verifiedZodiacHoldings: readonly ZodiacSign[];
  readonly currentSeason: ZodiacSeason;
  readonly currentSeasonAppearsInWallet: boolean;
  readonly optionalContextFacts: readonly ZodiacReceiptFact[];
  readonly headline: string;
  readonly description: string;
  readonly emptyState: string;
  readonly provenanceNote: string;
  readonly safetyNote: string;
}

/**
 * Local identity summary combining unique holdings, provenance, season and placement
 * alignments.
 */
export interface ZodiacIdentityContext {
  readonly heldSigns: readonly ZodiacSign[];
  readonly confirmedAbsentSigns: readonly ZodiacSign[];
  readonly totalHeld: number;
  readonly wheelCoverage: number;
  readonly elementComposition: Record<ZodiacElement, number>;
  readonly modalityComposition: Record<ZodiacModality, number>;
  readonly nativeHeldSigns: readonly ZodiacSign[];
  readonly bridgedHeldSigns: readonly ZodiacSign[];
  readonly dualRepresentationSigns: readonly ZodiacSign[];
  readonly nativeCount: number;
  readonly bridgedCount: number;
  readonly dualRepresentationCount: number;
  readonly totalUniqueSigns: number;
  readonly totalRepresentationPositions: number;
  readonly currentSeason: ZodiacSeason;
  readonly currentSeasonHeld: boolean;
  readonly dominantElement: ZodiacElement | null;
  readonly dominantModality: ZodiacModality | null;
  readonly shareTitle: string;
  readonly shareDescription: string;
  readonly receiptFacts: readonly ZodiacReceiptFact[];
  readonly nativeBridgedSummary?: ZodiacNativeBridgedSummary;
  readonly alignments: readonly ZodiacIdentityAlignment[];
}

/** Identity summary with a caller-facing label and held flags for all twelve signs. */
export interface IdentityReceiptData extends ZodiacIdentityContext {
  readonly label: string;
  readonly wheelState: readonly {
    readonly sign: ZodiacSign;
    readonly held: boolean;
  }[];
}
