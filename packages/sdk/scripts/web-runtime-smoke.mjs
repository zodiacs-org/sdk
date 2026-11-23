import assert from "node:assert/strict";
import { EdgeVM } from "@edge-runtime/vm";
import { build } from "esbuild";
import { chromium } from "playwright-core";

// Bundle the installed package and all dependencies without Node fallbacks.
export async function checkWebRuntimes(cwd, entries) {
  async function bundle(contents, conditions, platform = "browser") {
    const result = await build({
      absWorkingDir: cwd,
      stdin: { contents, resolveDir: cwd },
      bundle: true,
      platform,
      mainFields: ["module", "main"],
      conditions,
      target: "es2022",
      format: "iife",
      define: { "process.env.NODE_ENV": '"production"' },
      metafile: true,
      write: false
    });
    return result;
  }
  const narrow = await bundle(
    'import { formatTokenAmount } from "@zodiacs/sdk"; globalThis.formatted = formatTokenAmount(123n, 2);',
    ["browser"]
  );
  const [{ inputs }] = Object.values(narrow.metafile.outputs);
  for (const [path, { bytesInOutput }] of Object.entries(inputs)) {
    if (bytesInOutput)
      assert.doesNotMatch(
        path,
        /node_modules\/(?:viem|ox|abitype|react|@noble)\/|\/dist\/(?:ui|react|market)\.js/
      );
  }
  assert.doesNotMatch(narrow.outputFiles[0].text, /getTokenAccountsByOwner|balanceOf|3ffB5282/i);

  const probe =
    entries.map((entry, i) => `import * as api${i} from "${entry}";`).join("\n") +
    `
    import { getBaseZodiacRepresentation, getRepresentationByAddress } from "@zodiacs/sdk";
    import { createMockOwnership } from "@zodiacs/sdk/testing";
    import { getZodiacIdentityContext } from "@zodiacs/sdk/identity";
    const apis = [${entries.map((_, i) => `api${i}`).join(",")}];
    globalThis.result = {
      exportsLoaded: apis.every(api => Object.keys(api).length > 0),
      kind: getRepresentationByAddress(getBaseZodiacRepresentation("aries").address).kind,
      held: getZodiacIdentityContext(createMockOwnership({heldSigns:["aries"]})).heldSigns
    };
  `;
  const expected = { exportsLoaded: true, kind: "bridged", held: ["aries"] };
  const edge = await bundle(
    probe +
      '\naddEventListener("fetch", event => event.respondWith(Response.json(globalThis.result)));',
    ["edge-light", "worker"],
    "neutral"
  );
  const runtime = new EdgeVM({ initialCode: edge.outputFiles[0].text });
  const response = await runtime.dispatchFetch("https://example.org/");
  assert.deepEqual(await response.json(), expected);
  const browser = await chromium.launch(
    process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: "chrome" }
  );
  try {
    const page = await browser.newPage();
    const web = await bundle(probe, ["browser"]);
    await page.addScriptTag({ content: web.outputFiles[0].text });
    assert.deepEqual(await page.evaluate(() => globalThis.result), expected);
    await page.addScriptTag({ content: narrow.outputFiles[0].text });
    assert.equal(await page.evaluate(() => globalThis.formatted), "1.23");
    const worker = await bundle(probe + "\npostMessage(globalThis.result);", ["worker", "browser"]);
    const result = await page.evaluate(
      (code) =>
        new Promise((resolve, reject) => {
          const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
          const worker = new Worker(url);
          worker.onmessage = (event) => {
            worker.terminate();
            URL.revokeObjectURL(url);
            resolve(event.data);
          };
          worker.onerror = (event) => reject(new Error(event.message));
        }),
      worker.outputFiles[0].text
    );
    assert.deepEqual(result, expected);
  } finally {
    await browser.close();
  }
  console.log(
    "Packed exports, strict consumer declarations, tree shaking, Edge Runtime, Chromium and Web Worker passed."
  );
}
