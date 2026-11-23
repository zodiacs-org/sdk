import { execFileSync } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tsc, withPackedConsumer } from "./packed-consumer.mjs";
import { checkWebRuntimes } from "./web-runtime-smoke.mjs";

await withPackedConsumer(async ({ cwd, entries, addPeers }) => {
  const node = (...args) => execFileSync(process.execPath, args, { cwd, stdio: "inherit" });
  const coreEntries = entries.filter((name) => !["react", "ui"].includes(name.split("/")[2]));
  node(
    "--input-type=module",
    "-e",
    `
    import assert from "node:assert/strict";
    import registry from "@zodiacs/sdk/registry/zodiacs.registry.json" with { type: "json" };
    import { readFileSync } from "node:fs";
    import { getAllZodiacIconAssets } from "@zodiacs/sdk/assets";
    assert.equal(registry.assets.length, 12);
    for (const { packagePath } of getAllZodiacIconAssets()) {
      const bytes = readFileSync(new URL(import.meta.resolve(packagePath)));
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    }
    assert.throws(() => import.meta.resolve("react"), { code: "ERR_MODULE_NOT_FOUND" });
    for (const name of ${JSON.stringify(coreEntries)}) assert.ok(Object.keys(await import(name)).length, name);
  `
  );

  writeFileSync(
    join(cwd, "core-only.mts"),
    coreEntries.map((name) => `export * as ${name.split("/").at(-1)} from "${name}";`).join("\n")
  );
  node(
    tsc,
    "--module",
    "nodenext",
    "--target",
    "es2022",
    "--strict",
    "--exactOptionalPropertyTypes",
    "--noEmit",
    "core-only.mts"
  );

  addPeers("react", "@types/react", "@types/node", "viem");
  const runtime = `
    const assert = require("node:assert/strict");
    (async () => {
      for (const entry of ${JSON.stringify(entries)}) {
        assert.throws(() => require(entry), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
        assert.ok(Object.keys(await import(entry)).length, entry);
      }
      const root = await import("@zodiacs/sdk");
      const core = await import("@zodiacs/sdk/core");
      assert.equal(root.ZodiacsError, core.ZodiacsError);
      assert.equal(root.getZodiacsRegistry(), core.getZodiacsRegistry());
      assert.equal(require("@zodiacs/sdk/registry/zodiacs.registry.json").assets.length, 12);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  writeFileSync(join(cwd, "runtime.cjs"), runtime);
  node("runtime.cjs");
  copyFileSync(new URL("./fixtures/consumer.mts", import.meta.url), join(cwd, "consumer.mts"));
  writeFileSync(
    join(cwd, "consumer.cts"),
    entries
      .map(
        (entry, i) => `
    // @ts-expect-error The SDK exposes this module to import callers only.
    import sync${i} = require("${entry}");
    void sync${i};
    void import("${entry}");
  `
      )
      .join("\n")
  );
  for (const resolution of ["nodenext", "bundler", "node16"]) {
    const bundler = resolution === "bundler";
    node(
      tsc,
      "--moduleResolution",
      resolution,
      "--module",
      bundler ? "esnext" : resolution,
      "--target",
      "es2022",
      "--strict",
      "--exactOptionalPropertyTypes",
      "--noUncheckedIndexedAccess",
      // viem and ox ship mixed-mode declarations that TS Node16 cannot fully check.
      ...(resolution === "node16" ? ["--skipLibCheck"] : []),
      "--noEmit",
      "consumer.mts",
      ...(bundler ? [] : ["consumer.cts"])
    );
  }
  await checkWebRuntimes(cwd, entries);
});
