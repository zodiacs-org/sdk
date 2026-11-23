import type { TokenBalance, ZodiacToken } from "./types.js";

/**
 * Fraction digit limits for display. Exact raw formatting truncates by default and uses a
 * decimal point.
 */
export interface FormatTokenAmountOptions {
  /** Maximum displayed digits after the decimal point. Defaults to the token scale in exact mode. */
  readonly maximumFractionDigits?: number;
  /** Pad to this many fractional digits. Defaults to zero. */
  readonly minimumFractionDigits?: number;
  /** Locale for the approximate UI-number path of formatZodiacBalance. */
  readonly locale?: string;
  readonly roundingMode?: "round" | "truncate";
}

/** Formats a number with locale-specific compact notation and up to two fractional digits. */
export function formatCompactNumber(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    notation: "compact"
  }).format(value);
}

/**
 * Formats a finite currency amount with Intl. Missing or non-finite values display as
 * "Unavailable".
 */
export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  locale = "en-US"
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: value >= 1 ? 2 : 6,
    style: "currency"
  }).format(value);
}

/**
 * Formats percentage points with a sign and up to two decimal places. Missing or non-finite
 * values display as "Unavailable".
 */
export function formatPercentChange(value: number | null | undefined, locale = "en-US"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
    style: "percent"
  }).format(value / 100);
}

/**
 * Formats unsigned base units exactly at a scale of 0 to 18. Accepts digit strings, bigint
 * or safe integer numbers. Invalid inputs throw. Rounding is half-up when requested.
 */
export function formatTokenAmount(
  amountRaw: string | number | bigint,
  decimals: number,
  options: FormatTokenAmountOptions = {}
): string {
  const raw = normalizeRawAmountString(amountRaw);
  assertDecimals(decimals);
  const maximumFractionDigits = options.maximumFractionDigits ?? decimals;
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  assertFractionDigits(minimumFractionDigits, maximumFractionDigits);
  const normalizedRaw =
    options.roundingMode === "round" ? roundRawAmount(raw, decimals, maximumFractionDigits) : raw;
  const padded = normalizedRaw.padStart(decimals + 1, "0");
  const whole = decimals === 0 ? padded : padded.slice(0, -decimals);
  const fractional = decimals === 0 ? "" : padded.slice(-decimals);
  const trimmedFractional = fractional.slice(0, maximumFractionDigits).replace(/0+$/u, "");
  const displayFractional = trimmedFractional.padEnd(
    Math.min(Math.max(minimumFractionDigits, trimmedFractional.length), maximumFractionDigits),
    "0"
  );

  return displayFractional ? `${whole}.${displayFractional}` : whole;
}

/**
 * Appends the ticker to a display balance. Null displays as zero. Setting maximumFractionDigits or
 * roundingMode selects raw-unit formatting.
 */
export function formatZodiacBalance(
  balance: TokenBalance | null,
  token: ZodiacToken,
  options: FormatTokenAmountOptions = {}
): string {
  if (!balance) {
    return `0 ${token.ticker}`;
  }

  const useRawFormatter =
    balance.uiAmount === null ||
    options.maximumFractionDigits !== undefined ||
    options.roundingMode !== undefined;
  const amount = useRawFormatter
    ? formatTokenAmount(balance.amountRaw, balance.decimals, options)
    : new Intl.NumberFormat(options.locale ?? "en-US", {
        maximumFractionDigits: options.maximumFractionDigits ?? 6,
        minimumFractionDigits: options.minimumFractionDigits ?? 0
      }).format(balance.uiAmount);

  return `${amount} ${token.ticker}`;
}

/**
 * Converts unsigned base units to an approximate JS number. Use formatTokenAmount to retain
 * exact digits.
 */
export function rawAmountToNumber(amountRaw: string | number | bigint, decimals: number): number {
  const raw = normalizeRawAmountString(amountRaw);
  assertDecimals(decimals);

  return Number(`${raw}e-${decimals}`);
}

function normalizeRawAmountString(amountRaw: string | number | bigint): string {
  if (typeof amountRaw === "number" && !Number.isSafeInteger(amountRaw)) {
    throw new RangeError(
      "Numeric token amounts must be safe integers. Use a string or bigint for larger amounts."
    );
  }
  if (
    typeof amountRaw !== "string" &&
    typeof amountRaw !== "number" &&
    typeof amountRaw !== "bigint"
  ) {
    throw new TypeError("Token amount must be a string, number or bigint.");
  }
  const raw = String(amountRaw);

  if (!/^\d+$/u.test(raw)) {
    throw new Error(`Token amount must be an unsigned integer string: ${raw}`);
  }

  return raw.replace(/^0+(?=\d)/u, "");
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`Token decimals must be an integer from 0 to 18: ${decimals}`);
  }
}

function assertFractionDigits(minimumFractionDigits: number, maximumFractionDigits: number): void {
  if (
    !Number.isInteger(minimumFractionDigits) ||
    !Number.isInteger(maximumFractionDigits) ||
    minimumFractionDigits < 0 ||
    maximumFractionDigits < 0 ||
    minimumFractionDigits > maximumFractionDigits
  ) {
    throw new Error(
      `Fraction digit options must be non-negative integers with minimum <= maximum: ${minimumFractionDigits}, ${maximumFractionDigits}`
    );
  }
}

function roundRawAmount(raw: string, decimals: number, maximumFractionDigits: number): string {
  const digitsToDrop = decimals - maximumFractionDigits;

  if (digitsToDrop <= 0) {
    return raw;
  }

  const divisor = 10n ** BigInt(digitsToDrop);
  const rounded = (BigInt(raw) + divisor / 2n) / divisor;

  return (rounded * divisor).toString();
}
