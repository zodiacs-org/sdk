import { getZodiacMetadata } from "./metadata.js";
import { DEFAULT_ZODIAC_TOKENS } from "./registry.js";
import type {
  ZodiacAsset,
  ZodiacChain,
  ZodiacRepresentation,
  ZodiacSign,
  ZodiacsRegistry
} from "./types.js";

/** Version of the bundled registry data, independent of the npm package version. */
export const ZODIACS_REGISTRY_VERSION = "0.2.0";
/** Numeric identifier of Base mainnet. */
export const BASE_CHAIN_ID = 8453;

/** Official bridged ERC-20 addresses on Base mainnet keyed by zodiac sign. */
export const BASE_BRIDGED_ZODIAC_ADDRESSES = {
  aries: "0x3ffB5282F5891Dd8c813E64059EdB0607537eC91",
  taurus: "0xd5356c6E529569c6912978433DAfb7ca72B5f09C",
  gemini: "0x8F6eb25aB4CD2F8f064f7da5E35136D4EC600b4f",
  cancer: "0xb9Fd3c3157C7b69260Ca285FbbC74F6309226378",
  leo: "0x4f7B4c12DE5d47314C86Ed3BA25E289aA139CF75",
  virgo: "0xAcFd97106bbE5D931aC430Be76A8E362832D48f4",
  libra: "0x4201eff5F419CD6EEDFb28fa240edeaFc9002204",
  scorpio: "0x0057C9cB6D16C2ecA808788f14d0d0c367b26676",
  sagittarius: "0xD21fAb1EB5E11AC3C281F7cF8096eCC4683eEa9c",
  capricorn: "0xbFB102C18FDf49f2ffCB9B3aF4522f7DC9f51018",
  aquarius: "0xccA7CD4F96336Fd26eF6c5F579eaC651bAC5535F",
  pisces: "0x43fA1855a89b7A3e07426Fa7a1B44b4187d29Daf"
} as const satisfies Record<ZodiacSign, string>;

function createNativeRepresentation(
  token: (typeof DEFAULT_ZODIAC_TOKENS)[number]
): ZodiacRepresentation {
  return {
    sign: token.sign,
    chain: "solana",
    kind: "native",
    tokenStandard: "SPL",
    address: token.mintAddress,
    decimals: token.decimals,
    symbol: token.ticker,
    name: token.name,
    isCanonicalOrigin: true,
    isOfficialRepresentation: true
  };
}

function createBaseRepresentation(
  token: (typeof DEFAULT_ZODIAC_TOKENS)[number],
  native: ZodiacRepresentation
): ZodiacRepresentation {
  return {
    sign: token.sign,
    chain: "base",
    chainId: BASE_CHAIN_ID,
    kind: "bridged",
    tokenStandard: "ERC20",
    address: BASE_BRIDGED_ZODIAC_ADDRESSES[token.sign],
    decimals: token.decimals,
    symbol: token.ticker,
    name: token.name,
    isCanonicalOrigin: false,
    isOfficialRepresentation: true,
    originChain: "solana",
    originAddress: native.address,
    bridge: {
      status: "official-bridged",
      protocol: "wormhole",
      sourceChain: "solana",
      destinationChain: "base",
      notes: "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
    }
  };
}

function createAsset(token: (typeof DEFAULT_ZODIAC_TOKENS)[number]): ZodiacAsset {
  const metadata = getZodiacMetadata(token.sign);
  const native = createNativeRepresentation(token);
  const bridgedBase = createBaseRepresentation(token, native);

  return {
    sign: token.sign,
    displayName: token.name,
    metadata: {
      element: token.element,
      modality: token.modality,
      rulingPlanet: token.rulingPlanet,
      archetype: token.archetype,
      dateRange: `${metadata.dateRange.starts} to ${metadata.dateRange.ends}`,
      shortBio: token.shortBio
    },
    native,
    representations: [native, bridgedBase]
  };
}

/** Bundled registry of signs, supported chains and official token representations. */
export const ZODIACS_REGISTRY = {
  name: "Zodiacs Official Registry",
  source: "https://zodiacs.org",
  sdk: "@zodiacs/sdk",
  version: ZODIACS_REGISTRY_VERSION,
  nativeChain: "solana",
  supportedChains: [
    {
      chain: "solana",
      kind: "native",
      tokenStandard: "SPL"
    },
    {
      chain: "base",
      chainId: BASE_CHAIN_ID,
      kind: "bridged",
      tokenStandard: "ERC20"
    }
  ],
  assets: DEFAULT_ZODIAC_TOKENS.map(createAsset)
} as const satisfies ZodiacsRegistry;

/** Returns the bundled registry synchronously without a network lookup. */
export function getZodiacsRegistry(): ZodiacsRegistry {
  return ZODIACS_REGISTRY;
}

/** Alias of getZodiacsRegistry for the bundled official registry. */
export const getCanonicalZodiacsRegistry = getZodiacsRegistry;

/** Returns the version embedded in the official registry. */
export function getRegistryVersion(): string {
  return ZODIACS_REGISTRY.version;
}

/** Returns the twelve official assets in zodiac order. */
export function getAllZodiacAssets(): readonly ZodiacAsset[] {
  return ZODIACS_REGISTRY.assets;
}

/** Returns the official asset for a sign. An unknown sign throws. */
export function getZodiacAsset(sign: ZodiacSign): ZodiacAsset {
  const asset = ZODIACS_REGISTRY.assets.find((item) => item.sign === sign);

  if (!asset) {
    throw new Error(`No Zodiacs asset for ${sign}.`);
  }

  return asset;
}

/** Lists the official native and bridged entries for one sign. */
export function getZodiacRepresentations(sign: ZodiacSign): readonly ZodiacRepresentation[] {
  return getZodiacAsset(sign).representations;
}

/** Selects the entry for a sign and chain, or null if no chain entry exists. */
export function getZodiacRepresentation(
  sign: ZodiacSign,
  chain: ZodiacChain
): ZodiacRepresentation | null {
  return (
    getZodiacRepresentations(sign).find((representation) => representation.chain === chain) ?? null
  );
}

/** Returns the canonical Solana origin for a sign. */
export function getNativeZodiacRepresentation(sign: ZodiacSign): ZodiacRepresentation {
  return getZodiacAsset(sign).native;
}

/** Alias of getNativeZodiacRepresentation for the canonical Solana origin. */
export const getSolanaZodiacRepresentation = getNativeZodiacRepresentation;

/** Returns the official Base ERC-20 entry for a sign. A missing entry throws. */
export function getBaseZodiacRepresentation(sign: ZodiacSign): ZodiacRepresentation {
  const representation = getZodiacRepresentation(sign, "base");

  if (!representation) {
    throw new Error(`No Base representation for ${sign}.`);
  }

  return representation;
}

/** Lists official chain entries for one sign or, by default, for all twelve. */
export function getAllOfficialRepresentations(sign?: ZodiacSign): readonly ZodiacRepresentation[] {
  return sign
    ? getZodiacRepresentations(sign)
    : ZODIACS_REGISTRY.assets.flatMap((asset) => asset.representations);
}

/** Lists the official Base ERC-20 representations in zodiac order. */
export function getAllBaseBridgedZodiacs(): readonly ZodiacRepresentation[] {
  return getAllOfficialRepresentations().filter(
    (representation) => representation.chain === "base"
  );
}

/** Lists the official native SPL representations in zodiac order. */
export function getAllSolanaNativeZodiacs(): readonly ZodiacRepresentation[] {
  return getAllOfficialRepresentations().filter(
    (representation) => representation.chain === "solana"
  );
}
