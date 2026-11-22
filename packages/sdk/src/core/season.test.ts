import { describe, expect, it } from "vitest";
import {
  getCurrentZodiacSeason,
  getNextZodiacSeason,
  getZodiacSeasonForDate,
  getZodiacSeasonProgress
} from "./index.js";

describe("zodiac season helpers", () => {
  it("returns Aries at the March boundary", () => {
    expect(getZodiacSeasonForDate(new Date("2026-03-21T00:00:00.000Z"))).toMatchObject({
      sign: "aries",
      displayName: "Aries",
      startDate: "2026-03-21",
      endDate: "2026-04-19",
      isCurrent: true
    });
  });

  it("keeps the final season day inclusive and advances on the next day", () => {
    expect(getZodiacSeasonForDate(new Date("2026-04-19T23:59:59.000Z")).sign).toBe("aries");
    expect(getZodiacSeasonForDate(new Date("2026-04-20T00:00:00.000Z")).sign).toBe("taurus");
  });

  it("handles Capricorn across calendar years", () => {
    expect(getCurrentZodiacSeason(new Date("2026-01-01T00:00:00.000Z"))).toMatchObject({
      sign: "capricorn",
      startDate: "2025-12-22",
      endDate: "2026-01-19"
    });
    expect(getNextZodiacSeason(new Date("2026-12-25T00:00:00.000Z"))).toMatchObject({
      sign: "aquarius",
      startDate: "2027-01-20",
      endDate: "2027-02-18",
      isCurrent: false
    });
  });

  it("preserves early UTC years when looking up season bounds", () => {
    const date = new Date("0042-07-25T12:00:00Z");
    expect(getZodiacSeasonForDate(date)).toMatchObject({
      sign: "leo",
      startDate: "0042-07-23",
      endDate: "0042-08-22"
    });
    const january = new Date("0000-01-01T00:00:00Z");
    expect(getZodiacSeasonProgress(january)).toMatchObject({
      sign: "capricorn",
      startDate: "-000001-12-22",
      endDate: "0000-01-19",
      progress: 34.48
    });
    expect(getNextZodiacSeason(january).startDate).toBe("0000-01-20");
  });

  it("returns display-safe season progress as a percentage", () => {
    expect(getZodiacSeasonProgress(new Date("2026-03-21T00:00:00.000Z"))).toMatchObject({
      sign: "aries",
      progress: 0
    });
    expect(getZodiacSeasonProgress(new Date("2026-04-20T00:00:00.000Z"))).toMatchObject({
      sign: "taurus",
      progress: 0
    });
  });
});
