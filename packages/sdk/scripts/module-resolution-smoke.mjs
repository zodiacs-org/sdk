import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const repoRoot = resolve(packageRoot, "../..");
const tscBin = join(repoRoot, "node_modules/typescript/bin/tsc");
const distCore = join(packageRoot, "dist/core.js");

if (!existsSync(distCore)) {
  throw new Error("Build @zodiacs/sdk before running module-resolution smoke tests.");
}

const tmp = mkdtempSync(join(tmpdir(), "zodiacs-sdk-resolution-"));
const scopedModules = join(tmp, "node_modules/@zodiacs");
mkdirSync(scopedModules, { recursive: true });
symlinkSync(packageRoot, join(scopedModules, "sdk"), "dir");

writeFileSync(join(tmp, "package.json"), JSON.stringify({ type: "module" }, null, 2));
writeFileSync(
  join(tmp, "index.ts"),
  [
    'import type { ZodiacIdentityContext } from "@zodiacs/sdk/core";',
    'import type { ZodiacsRegistry } from "@zodiacs/sdk/registry";',
    'import type { BaseZodiacsOwnership } from "@zodiacs/sdk/base";',
    'import type { ZodiacsOwnership } from "@zodiacs/sdk/solana";',
    'import type { ConsumerSafeWalletContext } from "@zodiacs/sdk/identity";',
    'import type { ZodiacIconAsset } from "@zodiacs/sdk/assets";',
    'import { ZODIAC_SIGNS, getZodiacIdentityContext } from "@zodiacs/sdk/core";',
    'import { getZodiacsRegistry } from "@zodiacs/sdk/registry";',
    'import { getBaseZodiacRepresentation } from "@zodiacs/sdk/base";',
    'import { getSolanaZodiacRepresentation } from "@zodiacs/sdk/solana";',
    'import { getConsumerSafeWalletContext } from "@zodiacs/sdk/identity";',
    'import { getZodiacIconAsset } from "@zodiacs/sdk/assets";',
    'import { createPlaceholderMarketAdapter } from "@zodiacs/sdk/market";',
    'import { createMockOwnership } from "@zodiacs/sdk/testing";',
    "",
    "const ownership = createMockOwnership({ heldSigns: ['aries'] });",
    "const context = getZodiacIdentityContext(ownership);",
    "const consumerSafe = getConsumerSafeWalletContext(ownership);",
    "const registry = getZodiacsRegistry();",
    "const base = getBaseZodiacRepresentation('aries');",
    "const solana = getSolanaZodiacRepresentation('aries');",
    "const icon = getZodiacIconAsset('aries');",
    "const market = createPlaceholderMarketAdapter();",
    "const typedContext: ZodiacIdentityContext = context;",
    "const typedRegistry: ZodiacsRegistry = registry;",
    "const typedBaseOwnership: BaseZodiacsOwnership | null = null;",
    "const typedSolanaOwnership: ZodiacsOwnership = ownership;",
    "const typedConsumerSafe: ConsumerSafeWalletContext = consumerSafe;",
    "const typedIcon: ZodiacIconAsset = icon;",
    "",
    "void typedContext;",
    "void typedRegistry;",
    "void typedBaseOwnership;",
    "void typedSolanaOwnership;",
    "void typedConsumerSafe;",
    "void typedIcon;",
    "console.log(ZODIAC_SIGNS.length, context.totalUniqueSigns, consumerSafe.readOnly, registry.assets.length, base.chain, solana.chain, icon.packagePath, Boolean(market));"
  ].join("\n")
);

const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const entries = Object.entries(manifest.exports)
  .filter(([, target]) => typeof target === "object" && target.import)
  .map(([subpath]) => manifest.name + subpath.slice(1));

writeFileSync(
  join(tmp, "consumer.cts"),
  entries
    .map(
      (entry, index) =>
        `// @ts-expect-error The SDK exposes this module to import callers only.
import sync${index} = require("${entry}");
void sync${index};
void import("${entry}");`
    )
    .join("\n")
);

const configs = [
  {
    name: "node16",
    compilerOptions: {
      module: "Node16",
      moduleResolution: "Node16"
    }
  },
  {
    name: "nodenext",
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext"
    }
  },
  {
    name: "bundler",
    compilerOptions: {
      module: "ESNext",
      moduleResolution: "Bundler"
    }
  }
];

for (const config of configs) {
  const tsconfigPath = join(tmp, `tsconfig.${config.name}.json`);
  writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          ...config.compilerOptions
        },
        include: config.name === "bundler" ? ["index.ts"] : ["index.ts", "consumer.cts"]
      },
      null,
      2
    )
  );

  execFileSync(process.execPath, [tscBin, "--project", tsconfigPath], {
    cwd: tmp,
    stdio: "inherit"
  });
}

writeFileSync(
  join(tmp, "runtime.cjs"),
  `
const assert = require("node:assert/strict");
(async () => {
  for (const entry of ${JSON.stringify(entries)}) {
    assert.throws(() => require(entry), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    assert.ok(Object.keys(await import(entry)).length > 0, entry);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`
);
execFileSync(process.execPath, [join(tmp, "runtime.cjs")], { cwd: tmp, stdio: "inherit" });

console.log("Module resolution smoke tests passed for Node16, NodeNext, and Bundler.");
