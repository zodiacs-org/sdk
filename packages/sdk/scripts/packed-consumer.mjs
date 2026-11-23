import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = fileURLToPath(new URL("../", import.meta.url));
export const repoRoot = resolve(packageRoot, "../..");
export const tsc = join(repoRoot, "node_modules/typescript/bin/tsc");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function pack(directory) {
  const [artifact] = JSON.parse(
    execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", directory], {
      cwd: packageRoot
    })
  );
  const files = new Set(artifact.files.map((file) => file.path));
  for (const target of Object.values(readJson(join(packageRoot, "package.json")).exports)) {
    if (!target.import) continue;
    for (const path of [target.import.types, target.import.default]) {
      if (!files.has(path.slice(2)))
        throw new Error(`Missing ${path} in npm pack. Build the SDK first.`);
    }
  }
  return join(directory, artifact.filename);
}

export async function withPackedConsumer(
  test,
  installCommands = ["corepack pnpm add @zodiacs/sdk"]
) {
  const cwd = mkdtempSync(join(tmpdir(), "zodiacs-sdk-consumer-"));
  try {
    const tarball = pack(cwd);
    const pnpm = (...args) =>
      execFileSync("corepack", ["pnpm", ...args], { cwd, stdio: "inherit" });
    const version = (name) =>
      readJson(join(packageRoot, "node_modules", name, "package.json")).version;
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        packageManager: readJson(join(repoRoot, "package.json")).packageManager,
        pnpm: { overrides: { "@zodiacs/sdk": `file:${tarball}`, viem: version("viem") } }
      })
    );
    writeFileSync(join(cwd, ".npmrc"), "auto-install-peers=false\n");
    execFileSync("corepack", ["enable", "pnpm", "--install-directory", cwd], { cwd });
    const env = { ...process.env, PATH: cwd + delimiter + process.env.PATH };
    for (const command of new Set(installCommands)) {
      execFileSync("sh", ["-ec", command], { cwd, env, stdio: "inherit" });
    }
    const manifest = readJson(join(cwd, "node_modules/@zodiacs/sdk/package.json"));
    const entries = Object.entries(manifest.exports)
      .filter(([, target]) => target.import)
      .map(([key]) => manifest.name + key.slice(1));
    const addPeers = (...names) => pnpm("add", ...names.map((name) => `${name}@${version(name)}`));
    await test({ cwd, entries, addPeers });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
