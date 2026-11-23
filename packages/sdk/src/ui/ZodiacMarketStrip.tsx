import type { CSSProperties } from "react";

/** Compatibility props accepted by the retired market strip. */
export interface ZodiacMarketStripProps {
  /** @deprecated SDK UI no longer renders market context. Import market helpers explicitly from @zodiacs/sdk/market. */
  readonly market?: unknown;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Compatibility component that renders null.
 * @deprecated SDK UI is reserved for read-only registry, provenance, and symbolic identity display.
 */
export function ZodiacMarketStrip(_props: ZodiacMarketStripProps) {
  return null;
}
