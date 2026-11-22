import { createRequire } from "node:module";
import { assert, describe, expect, expectTypeOf, it } from "vitest";
import * as engine from "@zodiacs/engine";
import * as core from "@zodiacs/engine/core";
import { chart, houses } from "@zodiacs/engine/calc";
import {
  dateOfJulianDayNumber,
  julianDayNumber,
  localMeanTimeOffset,
  prepareLocalTime,
  resolveLocalBirth
} from "@zodiacs/engine/geo";
import {
  createNatalEnvelope,
  natalReplayInput,
  parseNatalEnvelope,
  serializeNatalEnvelope
} from "@zodiacs/engine/receipt";
import { solarArc } from "@zodiacs/engine/timing";
import { getZodiacIdentityContext, type ZodiacSign } from "../identity.js";
import { ZODIAC_SIGNS } from "./types.js";

const date = "1990-05-03";
const utc = "1990-05-03T12:00:00Z";
const future = "2030-01-01T00:00:00Z";
const place = { latitude: 40, longitude: -74 };
const tableEnd = Date.parse("2027-10-02T00:00:00Z");

describe("engine 2.0.0 consumer contracts", () => {
  it("accepts chart placements in SDK identity context from either ESM entry", () => {
    expect(engine.defaultEphemeris().name).toBe("de440");
    expect(core.defaultEphemeris().name).toBe("astronomy-engine");
    expectTypeOf<engine.BodyPosition["sign"]>().toEqualTypeOf<ZodiacSign>();
    expect(engine.SIGN_SLUGS).toEqual(ZODIAC_SIGNS);

    for (const entry of [engine, core]) {
      const natal = entry.natalChart({ utc, ...place });
      const sun = natal.bodies.find((row) => row.body === "Sun");
      const moon = natal.bodies.find((row) => row.body === "Moon");
      assert(sun && moon && natal.angles);
      const ownership = { holdings: [{ sign: "taurus", held: true }] } as const;
      const context = getZodiacIdentityContext(ownership, {
        date: natal.input.utc,
        sunSign: sun.sign,
        moonSign: moon.sign,
        risingSign: entry.signForLongitude(natal.angles.asc).slug
      });
      expect(context.alignments).toEqual([
        { placement: "sun", sign: "taurus", held: true },
        { placement: "moon", sign: "virgo", held: false },
        { placement: "rising", sign: "gemini", held: false }
      ]);
    }
  });

  it("requires an explicit unknown-time choice for a bare birth date", () => {
    for (const run of [
      () => engine.natalChart({ utc: date }),
      () => engine.natalChart({ utc: date, timeKnown: true }),
      () => engine.transits({ utc: date }, utc),
      () => engine.synastry({ utc }, { utc: date }),
      () => engine.chartPoints({ utc: date, ...place }),
      () => engine.chartDeclinations({ utc: date }),
      () => engine.saturnReturn(date),
      () => engine.saturnReturn({ utc: date }),
      () => chart({ time: date }),
      () => chart({ time: { iso: date } })
    ]) {
      expect(run).toThrow(RangeError);
    }

    const untimed = engine.natalChart({ utc: date, timeKnown: false, ...place });
    expect(untimed.flags).toContain("no-time");
    expect(untimed.angles).toBeNull();
    expect(untimed.houses).toBeNull();
    expect(chart({ time: { iso: date }, timeKnown: false })).toMatchObject({
      status: "ok",
      chart: { angles: null, houses: null, flags: ["no-time"] }
    });

    expect(engine.natalChart({ utc: date + "T00:00:00Z", ...place }).input.timeKnown).toBe(true);
    const timed = engine.natalChart({ utc, ...place });
    expect(timed.angles).not.toBeNull();
    for (const instant of [new Date(utc), Date.parse(utc), "1990-05-03T14:00:00+02:00"]) {
      expect(engine.natalChart({ utc: instant, ...place })).toEqual(timed);
    }
  });

  it.each([
    ["latitude", ["lat"]],
    ["longitude", ["lng", "lon", "long"]],
    ["houseSystem", ["house", "houses", "hsys", "housesystem"]],
    ["timeScale", ["scale", "time_scale"]],
    ["deltaT", ["delta_t"]],
    ["timeKnown", ["time_known", "unknownTime"]]
  ] as const)("names %s when a birth key is misspelled", (field, aliases) => {
    for (const alias of aliases) {
      for (const key of [alias, alias.toUpperCase()]) {
        const calculate = () => engine.natalChart({ utc, [key]: 1 });
        expect(calculate).toThrow(RangeError);
        expect(calculate).toThrow(field);
      }
    }
  });

  it("ignores unrelated metadata on an otherwise canonical birth", () => {
    const birth = { utc, ...place, profileId: "synthetic" };
    expect(engine.natalChart(birth)).toEqual(engine.natalChart({ utc, ...place }));
  });

  it("keeps non-birth date arguments and local unknown-time births usable", () => {
    const midnight = date + "T00:00:00Z";
    expect(engine.progressedInstant(date, future)).toEqual(
      engine.progressedInstant(midnight, future)
    );
    expect(engine.progressedBodies(date, future)).toEqual(
      engine.progressedBodies(midnight, future)
    );
    expect(solarArc(date, future)).toEqual(solarArc(midnight, future));
    const bare = houses({ time: date, place });
    const timed = houses({ time: midnight, place });
    assert(bare.status === "ok" && timed.status === "ok");
    expect(bare.cusps).toEqual(timed.cusps);
    expect(bare.angles).toEqual(timed.angles);
    const local = resolveLocalBirth({ date, timeZone: "Etc/UTC" });
    expect(local.reference).toBe("local-noon");
    expect(local.birth.timeKnown).toBe(false);
    expect(local.resolution.utc.toISOString()).toBe("1990-05-03T12:00:00.000Z");
  });

  it("switches UTC basis after the table and flags extrapolation on the correct millisecond", () => {
    expect(engine.natalChart({ utc: tableEnd }).timeScale.basis).toBe("iers");
    for (const offset of [1, 146, 147]) {
      const natal = engine.natalChart({ utc: tableEnd + offset });
      expect(natal.timeScale.basis).toBe("continuous-utc" satisfies engine.TimeScale["basis"]);
      const ut1 = natal.timeScale.ut1MinusUtc;
      assert(ut1);
      expect(ut1.source).toBe("model" satisfies typeof ut1.source);
      // TT - UTC = (TT - UT1) + (UT1 - UTC), all in seconds.
      expect(natal.deltaT.seconds + ut1.seconds).toBeCloseTo(69.184, 9);
      expect(natal.flags.includes("delta-t-extrapolated")).toBe(offset >= 147);
    }
  });

  it("honors an explicit deltaT pin after the IERS table", () => {
    const natal = engine.natalChart({ utc: future, deltaT: 72 });
    expect(natal.deltaT).toMatchObject({ seconds: 72, segment: "pinned" });
    expect(natal.timeScale.basis).toBe("pinned");
  });

  it.each(["utc", "ut1", "tt"] as const)("replays the recorded %s input scale", (timeScale) => {
    const natal = engine.natalChart({ utc: future, timeScale, ...place });
    expect(natal.timeScale.input).toBe(timeScale);
    const envelope = createNatalEnvelope(natal);
    expect(envelope.requiredFeatures).toContain("time-basis-continuous-utc");
    const parsed = parseNatalEnvelope(serializeNatalEnvelope(envelope));
    assert(parsed.ok);
    expect(engine.natalChart(natalReplayInput(parsed.envelope))).toMatchObject(natal);
  });

  it.each([
    [utc, []],
    [future, ["delta-t-extrapolated"]],
    [
      "2300-01-01T00:00:00Z",
      ["outside-reference-span", "delta-t-extrapolated", "outside-de440-span"]
    ]
  ] satisfies [string, engine.InstantFlag[]][])(
    "keeps optional row flags in parity at %s",
    (at, flags) => {
      const natal = engine.natalChart({ utc: at });
      expect([...natal.flags].sort()).toEqual([...flags].sort());
      for (const rows of [
        engine.positions(at),
        engine.transits(natal, at).positions,
        engine.progressedBodies(at, at)
      ]) {
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expectTypeOf(row.flags).toEqualTypeOf<engine.InstantFlag[] | undefined>();
          if (flags.length === 0) {
            expect(row).not.toHaveProperty("flags");
          } else {
            expect(row.flags?.slice().sort()).toEqual([...flags].sort());
          }
        }
      }
    }
  );

  it("flags an unavailable pack on core rows and keeps root positions independent", () => {
    const original = core.defaultEphemeris().name;
    try {
      core.setDefaultEphemeris("de440");
      const natal = core.natalChart({ utc });
      expect(natal.flags).toEqual(["de440-unavailable"]);
      for (const rows of [
        core.positions(utc),
        core.transits(natal, utc).positions,
        core.progressedBodies(utc, utc)
      ]) {
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.flags).toEqual(natal.flags);
        }
      }
      expect(engine.natalChart({ utc }).flags).toEqual([]);
    } finally {
      core.setDefaultEphemeris(original);
    }
  });

  it("preserves polar and uncertain-calendar flags on calculated charts", async () => {
    const polar = engine.natalChart({ utc, latitude: 70, longitude: 0, houseSystem: "whole" });
    expect(polar.houses?.system).toBe("whole");
    expect(polar.flags).toContain("polar-angles" satisfies engine.ChartFlag);
    expect(engine.transits(polar, utc).natal.flags).toContain("polar-angles");

    const skipped = { date: "1582-10-10", time: "12:00", timeZone: "Europe/Rome" };
    await prepareLocalTime(skipped.date, skipped.timeZone);
    const local = resolveLocalBirth(skipped);
    expect(local.resolution.flags).toContain(
      "calendar-unknown" satisfies (typeof local.resolution.flags)[number]
    );
    expect(engine.natalChart(local.birth).flags).toContain(
      "calendar-unknown" satisfies engine.ChartFlag
    );
  });

  it("reports a host-zone discrepancy alongside the resolved wall time", () => {
    const { resolution, birth } = resolveLocalBirth({
      date: "2026-12-15",
      time: "12:00",
      timeZone: "America/Havana"
    });
    const check = resolution.zone.hostCheck;
    assert(check && check.status !== "unchecked");
    expect(check.tzdbOffsetMinutes).toBe(-240);
    const differs = check.hostOffsetMinutes !== check.tzdbOffsetMinutes && check.status !== "newer";
    expect(check.status === "differs").toBe(differs);
    expect(resolution.flags.includes("host-zone-data-differs")).toBe(differs);
    expect(engine.natalChart(birth).flags.includes("host-zone-data-differs")).toBe(differs);
    expect(resolution.utc.getTime()).toBe(
      Date.parse("2026-12-15T12:00:00Z") - resolution.offsetMinutes * 60000
    );
  });

  it("uses shipped historical offsets, Julian Day Numbers and signed mean-time seconds", async () => {
    const dublin = { date: "1925-09-21", time: "12:00", timeZone: "Europe/Dublin" };
    await prepareLocalTime(dublin.date, dublin.timeZone);
    expect(resolveLocalBirth(dublin).resolution.utc.toISOString()).toBe("1925-09-21T12:00:00.000Z");
    const day = 2451545;
    for (const [calendar, civil] of [
      ["gregorian", { year: 2000, month: 1, day: 1 }],
      ["julian", { year: 1999, month: 12, day: 19 }]
    ] as const) {
      expect(julianDayNumber(civil, calendar)).toBe(day);
      expect(dateOfJulianDayNumber(day, calendar)).toEqual(civil);
    }
    expect(localMeanTimeOffset(-74)).toBe(-17760);
    expect(localMeanTimeOffset(15)).toBe(3600);
  });

  it("reports distinct errors for CommonJS loading and unknown body names", () => {
    const require = createRequire(import.meta.url);
    for (const entry of ["@zodiacs/engine", "@zodiacs/engine/core", "@zodiacs/engine/geo"]) {
      expect(() => require(entry)).toThrow(
        expect.objectContaining({ code: "ERR_ZODIACS_ESM_ONLY" })
      );
    }
    for (const entry of [engine, core]) {
      // @ts-expect-error Exercise the invalid body supplied by a JavaScript caller.
      expect(() => entry.findLongitudeCrossings("Ceres", 0, utc, future)).toThrow(RangeError);
    }
  });
});
