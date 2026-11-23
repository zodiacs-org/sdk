import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseEnv } from "node:util";
import { build } from "esbuild";
import { snippets } from "./markdown-snippets.mjs";
import { repoRoot, tsc, withPackedConsumer } from "./packed-consumer.mjs";

const blocks = snippets();
const installCommands = blocks
  .filter((b) => b.language === "sh" && !/^(docs|apps|examples)\//.test(b.path))
  .map((b) => b.code);
await withPackedConsumer(async ({ cwd, addPeers }) => {
  addPeers("viem", "react", "react-dom", "@types/react", "@types/node", "@zodiacs/engine");
  const registry = JSON.parse(
    readFileSync(join(cwd, "node_modules/@zodiacs/sdk/registry/zodiacs.registry.json"))
  );
  assert.deepEqual(
    readFileSync(join(cwd, "node_modules/@zodiacs/sdk/README.md")),
    readFileSync(join(repoRoot, "packages/sdk/README.md"))
  );
  const modules = [];
  const swift = [];
  for (const { path, line, language, code } of blocks) {
    const location = `${path}:${line}`;
    switch (language) {
      case "ts":
      case "tsx": {
        const name =
          /^\/\/ ([\w-]+\.ts)$/m.exec(code)?.[1] ?? `${basename(path, ".md")}-${line}.${language}`;
        const file = join(dirname(path), name);
        mkdirSync(join(cwd, "src", dirname(file)), { recursive: true });
        writeFileSync(join(cwd, "src", file), code);
        modules.push({
          path: file.replace(/\.tsx?$/, ".js"),
          location,
          expectedLogs: code
            .split("\n")
            .filter((line) => line.startsWith("console.log("))
            .map((line) => {
              const example = /;\s*\/\/ (.*)$/.exec(line);
              return example ? [JSON.parse(example[1])] : [];
            }),
          image: /from "[^"]+\.png"/.test(code)
        });
        break;
      }
      case "swift":
        swift.push(code);
        break;
      case "json": {
        const data = JSON.parse(code);
        if (data.registryVersion) {
          assert.equal(data.registryVersion, registry.version, location);
          for (const sign of data.signs) {
            const asset = registry.assets.find((asset) => asset.sign === sign.sign);
            assert.equal(sign.displayName, asset.displayName, location);
            assert.equal(sign.element, asset.metadata.element, location);
            assert.equal(sign.modality, asset.metadata.modality, location);
            for (const item of sign.representations) {
              const canonical = asset.representations.find((rep) => rep.chain === item.chain);
              for (const [key, value] of Object.entries(item))
                assert.equal(value, canonical[key], location);
            }
          }
        }
        break;
      }
      case "dotenv":
        assert.deepEqual(
          parseEnv(code),
          parseEnv(readFileSync(join(repoRoot, dirname(path), ".env.example"), "utf8")),
          location
        );
        break;
      case "txt":
      case "text":
        for (const item of code
          .trim()
          .split("\n")
          .filter((line) => line.startsWith("packages/sdk/"))) {
          assert.deepEqual(
            readFileSync(
              join(cwd, "node_modules/@zodiacs/sdk", item.slice("packages/sdk/".length))
            ),
            readFileSync(join(repoRoot, item)),
            location
          );
        }
        break;
      case "sh":
        // Installation uses the tarball override. Workspace commands run in docs-commands.mjs.
        break;
      default:
        throw new Error(`Unhandled ${language} fence at ${location}`);
    }
  }
  writeFileSync(
    join(cwd, "src", "images.d.ts"),
    'declare module "*.png" { const url: string; export default url; }'
  );
  writeFileSync(
    join(cwd, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        jsx: "react-jsx",
        strict: true,
        exactOptionalPropertyTypes: true,
        verbatimModuleSyntax: true,
        rootDir: "src",
        outDir: "js"
      },
      include: ["src"]
    })
  );
  execFileSync(process.execPath, [tsc, "-p", "."], { cwd, stdio: "inherit" });
  for (const module of modules.filter((item) => item.image)) {
    const result = await build({
      absWorkingDir: cwd,
      entryPoints: [join("js", module.path)],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      loader: { ".png": "file" },
      outdir: "images"
    });
    assert.ok(
      result.outputFiles.some((file) => file.path.endsWith(".png") && file.contents[0] === 0x89),
      module.location
    );
    writeFileSync(
      join(cwd, "js", module.path),
      result.outputFiles.find((file) => file.path.endsWith(".js")).contents
    );
  }
  writeFileSync(join(cwd, "modules.json"), JSON.stringify(modules));
  copyFileSync(new URL("./fixtures/run-docs.mjs", import.meta.url), join(cwd, "run-docs.mjs"));
  execFileSync(process.execPath, ["run-docs.mjs"], { cwd, stdio: "inherit" });
  writeFileSync(
    join(cwd, "models.swift"),
    [
      "import Foundation",
      ...swift,
      'let data = try Data(contentsOf: URL(fileURLWithPath: "wallet-context.json"))',
      "let context = try JSONDecoder().decode(ZodiacsContextResponse.self, from: data)",
      'precondition(context.readOnly && !context.walletRequired && context.verifiedZodiacHoldings.contains("aries"))'
    ].join("\n")
  );
  execFileSync("swift", ["models.swift"], { cwd, stdio: "inherit" });
  console.log(
    `Checked ${modules.length} TypeScript/TSX snippets, ${swift.length} Swift snippets and the documented data examples.`
  );
}, installCommands);
