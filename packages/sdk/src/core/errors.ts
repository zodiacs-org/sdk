/** Stable diagnostic codes used by SDK validation and read errors. */
export type ZodiacsValidationErrorCode =
  | "invalid-zodiac-sign"
  | "invalid-wallet-address"
  | "invalid-mint-address"
  | "invalid-rpc-endpoint"
  | "invalid-solana-connection"
  | "invalid-zodiac-address"
  | "unsupported-zodiacs-chain"
  | "unofficial-zodiac-address"
  | "zodiac-read-unavailable"
  | "zodiac-registry-integrity";

/** Base SDK error carrying a machine-readable code and message. */
export class ZodiacsError extends Error {
  override readonly name: string = "ZodiacsError";
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** An input or configuration error with a typed SDK diagnostic code. */
export class ZodiacsValidationError extends ZodiacsError {
  override readonly name: string = "ZodiacsValidationError";

  constructor(code: ZodiacsValidationErrorCode, message: string) {
    super(code, message);
  }
}

/** Indicates a sign that cannot be normalized to a registry slug. */
export class InvalidZodiacSignError extends ZodiacsValidationError {
  override readonly name: string = "InvalidZodiacSignError";

  constructor(value: string) {
    super("invalid-zodiac-sign", `Invalid zodiac sign: ${value}`);
  }
}

/** Indicates an address that fails normalization for the selected chain. */
export class InvalidZodiacAddressError extends ZodiacsValidationError {
  override readonly name: string = "InvalidZodiacAddressError";

  constructor(value: string) {
    super("invalid-zodiac-address", `Invalid Zodiacs address: ${value}`);
  }
}

/** Indicates a chain outside the SDK's supported networks. */
export class UnsupportedZodiacsChainError extends ZodiacsValidationError {
  override readonly name: string = "UnsupportedZodiacsChainError";

  constructor(value: string) {
    super("unsupported-zodiacs-chain", `Unsupported Zodiacs chain: ${value}`);
  }
}

/** Concrete unsupported-network error raised by Base reads and counterpart lookups. */
export class UnsupportedChainError extends UnsupportedZodiacsChainError {
  override readonly name: string = "UnsupportedChainError";
}

/** Indicates that an address has no matching official registry entry. */
export class UnofficialZodiacAddressError extends ZodiacsValidationError {
  override readonly name: string = "UnofficialZodiacAddressError";

  constructor(value: string) {
    super(
      "unofficial-zodiac-address",
      `Address not found in the official Zodiacs.org registry: ${value}`
    );
  }
}

/** Raised by assertOfficialZodiacAddress when lookup fails. */
export class UnknownZodiacAddressError extends UnofficialZodiacAddressError {
  override readonly name: string = "UnknownZodiacAddressError";
}

/** Represents a failed read with the zodiac-read-unavailable code. */
export class ZodiacReadUnavailableError extends ZodiacsError {
  override readonly name: string = "ZodiacReadUnavailableError";

  constructor(message = "Zodiacs read is unavailable.") {
    super("zodiac-read-unavailable", message);
  }
}

/** Carries per-sign read diagnostics when the caller selects the throw failure mode. */
export class PartialOwnershipReadError extends ZodiacsError {
  override readonly name: string = "PartialOwnershipReadError";

  readonly errors: readonly { readonly code: string; readonly message: string }[];

  constructor(errors: readonly { readonly code: string; readonly message: string }[]) {
    super("zodiac-read-unavailable", errors.map((error) => error.message).join(" "));
    this.errors = errors;
  }
}

/** Indicates that registry data violates an integrity rule. */
export class ZodiacRegistryIntegrityError extends ZodiacsError {
  override readonly name: string = "ZodiacRegistryIntegrityError";

  constructor(message: string) {
    super("zodiac-registry-integrity", message);
  }
}

/** Raised by schema assertions and normalization for invalid registry data. */
export class RegistryInvariantError extends ZodiacRegistryIntegrityError {
  override readonly name: string = "RegistryInvariantError";
}
