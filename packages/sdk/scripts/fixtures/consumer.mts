import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { getBaseZodiacsOwnership, type BaseZodiacsReadOptions } from "@zodiacs/sdk";
import { getZodiacIconAsset, type ZodiacIconAsset } from "@zodiacs/sdk/assets";
import { getBaseZodiacRepresentation, type BaseZodiacsOwnership } from "@zodiacs/sdk/base";
import { getZodiacIdentityContext, type ZodiacIdentityContext } from "@zodiacs/sdk/core";
import {
  getConsumerSafeWalletContext,
  type ConsumerSafeWalletContext
} from "@zodiacs/sdk/identity";
import { createPlaceholderMarketAdapter } from "@zodiacs/sdk/market";
import { useBaseZodiacsOwnership } from "@zodiacs/sdk/react";
import { getZodiacsRegistry, type ZodiacsRegistry } from "@zodiacs/sdk/registry";
import { getSolanaZodiacRepresentation, type ZodiacsOwnership } from "@zodiacs/sdk/solana";
import { createMockOwnership } from "@zodiacs/sdk/testing";
import { ProfileSummaryCard } from "@zodiacs/sdk/ui";

const ownership = createMockOwnership({ heldSigns: ["aries"] }) satisfies ZodiacsOwnership;
const context = getZodiacIdentityContext(ownership) satisfies ZodiacIdentityContext;
getConsumerSafeWalletContext(ownership) satisfies ConsumerSafeWalletContext;
getZodiacIconAsset("aries") satisfies ZodiacIconAsset;
getZodiacsRegistry() satisfies ZodiacsRegistry;
getBaseZodiacRepresentation("aries");
getSolanaZodiacRepresentation("aries");
createPlaceholderMarketAdapter();
ProfileSummaryCard({ context });

const publicClient = createPublicClient({ chain: base, transport: http() });
const options = { blockTag: "safe" } satisfies BaseZodiacsReadOptions;
const owner = "0x1111111111111111111111111111111111111111";
getBaseZodiacsOwnership(publicClient, owner, options) satisfies Promise<BaseZodiacsOwnership>;
useBaseZodiacsOwnership(publicClient, owner, options);
// @ts-expect-error Optional fields must be omitted when the value is unknown.
getBaseZodiacsOwnership(publicClient, owner, { blockTag: undefined });
