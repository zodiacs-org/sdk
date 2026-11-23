import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { snippets } from "./markdown-snippets.mjs";
import { pack, packageRoot, readJson, repoRoot } from "./packed-consumer.mjs";

const shell = snippets().filter((block) => block.language === "sh");
const phase = process.argv[2];
const run = (command, cwd) => {
  console.log(command);
  execFileSync("sh", ["-ec", command], { cwd, stdio: "inherit" });
};

if (phase === "release") {
  const documented = new Set(
    shell
      .filter((block) => block.path.startsWith("docs/"))
      .flatMap((block) => block.code.trim().split("\n"))
  );
  // Keep the CI gates explicit while checking that the runbook actually contains each command.
  for (const check of [
    "install --frozen-lockfile",
    "lint",
    "format:check",
    "typecheck",
    "registry:checksum",
    "neutrality:guard",
    "test",
    "build",
    "exports:smoke",
    "docs:smoke",
    "pack:dry-run",
    "package:contents"
  ]) {
    const command = `corepack pnpm ${check}`;
    assert.ok(documented.delete(command), `Missing documented release check: ${command}`);
    run(command, repoRoot);
  }
  for (const [command, cwd] of [
    ["corepack pnpm install", repoRoot],
    ["npm pack --dry-run --json", packageRoot]
  ]) {
    if (documented.delete(command)) run(command, cwd);
  }
  assert.deepEqual([...documented], [], "Unhandled shell commands in docs");
} else if (phase === "examples") {
  const cwd = mkdtempSync(join(tmpdir(), "zodiacs-sdk-examples-"));
  try {
    // The guides use workspace filters and local env files. Keep both disposable.
    const files = execFileSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "utf8"
    })
      .split("\0")
      .filter(Boolean);
    for (const file of files) {
      mkdirSync(join(cwd, dirname(file)), { recursive: true });
      copyFileSync(join(repoRoot, file), join(cwd, file));
    }
    const manifestPath = join(cwd, "package.json");
    const manifest = readJson(manifestPath);
    manifest.pnpm = {
      ...manifest.pnpm,
      overrides: { ...manifest.pnpm?.overrides, "@zodiacs/sdk": `file:./${basename(pack(cwd))}` }
    };
    writeFileSync(manifestPath, JSON.stringify(manifest));
    run("corepack pnpm install --lockfile-only --no-frozen-lockfile", cwd);
    const completed = new Set();
    for (const { path, code } of shell.filter((b) => /^(examples|apps)\//.test(b.path))) {
      for (const line of code.trim().split("\n")) {
        const command = line.replace(/\s+#.*$/, "").trim();
        if (completed.has(command)) continue;
        if (command.endsWith(" dev")) await checkDevServer(command, cwd);
        else run(command, cwd);
        completed.add(command);
      }
      const installed = realpathSync(join(cwd, dirname(path), "node_modules/@zodiacs/sdk"));
      assert.ok(
        !existsSync(join(installed, "src")) && existsSync(join(installed, "dist/index.js")),
        `${path} must use the tarball`
      );
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
} else throw new Error("Expected release or examples");

// Next reports readiness before compiling the first page. Request it too.
async function checkDevServer(command, cwd) {
  console.log(command);
  const child = spawn("sh", ["-ec", command], {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "0" }
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  try {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && child.exitCode === null) {
      const url = /Local:\s+(http:\/\/localhost:\d+)/.exec(output)?.[1];
      if (url && /Ready in/.test(output)) {
        const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
        assert.equal(response.status, 200, `${command}\n${output}`);
        assert.match(await response.text(), /<html/i);
        return;
      }
      await setTimeout(200);
    }
    throw new Error(`Server did not become ready: ${command}\n${output}`);
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
