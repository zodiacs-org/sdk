import { getZodiacAsset } from "./official-registry.js";
import type { ZodiacSeason, ZodiacSeasonProgress, ZodiacSign } from "./types.js";

interface ZodiacSeasonDefinition {
  readonly sign: ZodiacSign;
  readonly startMonth: number;
  readonly startDay: number;
  readonly endMonth: number;
  readonly endDay: number;
}

const ZODIAC_SEASONS = [
  { sign: "capricorn", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { sign: "aquarius", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { sign: "pisces", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
  { sign: "aries", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { sign: "taurus", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { sign: "gemini", startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { sign: "cancer", startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { sign: "leo", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { sign: "virgo", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { sign: "libra", startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { sign: "scorpio", startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { sign: "sagittarius", startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 }
] as const satisfies readonly ZodiacSeasonDefinition[];

/** Returns the fixed calendar season containing the supplied instant in UTC. Defaults to now. */
export function getCurrentZodiacSeason(date: Date = new Date()): ZodiacSeason {
  return getZodiacSeasonForDate(date);
}

/** Finds the inclusive UTC date range containing a valid Date. Invalid dates throw. */
export function getZodiacSeasonForDate(date: Date): ZodiacSeason {
  const definition = getSeasonDefinitionForDate(date);
  return buildSeason(definition, getStartYearForSeason(definition, date), true);
}

/** Returns the following fixed UTC calendar season, advancing the year across December. */
export function getNextZodiacSeason(date: Date = new Date()): ZodiacSeason {
  const current = getSeasonDefinitionForDate(date);
  const next = ZODIAC_SEASONS[(ZODIAC_SEASONS.indexOf(current) + 1) % ZODIAC_SEASONS.length]!;
  const year = getStartYearForSeason(current, date) + Number(next.startMonth < current.startMonth);
  return buildSeason(next, year, false);
}

/**
 * Measures elapsed UTC time through the current season, as a percentage rounded to two
 * decimal places.
 */
export function getZodiacSeasonProgress(date: Date = new Date()): ZodiacSeasonProgress {
  const definition = getSeasonDefinitionForDate(date);
  const year = getStartYearForSeason(definition, date);
  // The Gregorian calendar repeats every 400 years. Measure the interval in an
  // equivalent year so its end can extend past JavaScript's last valid Date.
  const relativeYear = 2000 + (year % 400);
  const endYear = relativeYear + Number(definition.endMonth < definition.startMonth);
  const start = Date.UTC(relativeYear, definition.startMonth - 1, definition.startDay);
  const end = Date.UTC(endYear, definition.endMonth - 1, definition.endDay + 1);
  const relativeDate = new Date(date.getTime());
  relativeDate.setUTCFullYear(relativeYear + (date.getUTCFullYear() - year));
  return {
    ...buildSeason(definition, year, true),
    progress: roundPercentage(((relativeDate.getTime() - start) / (end - start)) * 100)
  };
}

function getSeasonDefinitionForDate(date: Date): (typeof ZODIAC_SEASONS)[number] {
  // Date.prototype works across realms and rejects non-Date values at the JS boundary.
  let time: number;
  try {
    time = Date.prototype.getTime.call(date);
  } catch {
    throw new Error("Invalid date.");
  }
  if (!Number.isFinite(time)) throw new Error("Invalid date.");
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return ZODIAC_SEASONS.find(
    (season) =>
      (month === season.startMonth && day >= season.startDay) ||
      (month === season.endMonth && day <= season.endDay)
  )!;
}

function getStartYearForSeason(season: ZodiacSeasonDefinition, date: Date): number {
  return date.getUTCFullYear() - Number(date.getUTCMonth() + 1 < season.startMonth);
}

function buildSeason(
  definition: ZodiacSeasonDefinition,
  startYear: number,
  isCurrent: boolean
): ZodiacSeason {
  const endYear = startYear + Number(definition.endMonth < definition.startMonth);
  return {
    sign: definition.sign,
    displayName: getZodiacAsset(definition.sign).displayName,
    startDate: toIsoDate(startYear, definition.startMonth, definition.startDay),
    endDate: toIsoDate(endYear, definition.endMonth, definition.endDay),
    isCurrent
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  const isoYear =
    year >= 0 && year <= 9999
      ? String(year).padStart(4, "0")
      : (year < 0 ? "-" : "+") + String(Math.abs(year)).padStart(6, "0");
  return [isoYear, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}
