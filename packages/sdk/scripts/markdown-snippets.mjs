import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./packed-consumer.mjs";

// Use tracked paths plus new documentation in the working tree. Build output and
// dependency READMEs must never become examples.
export function snippets() {
  const paths = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).split("\0");
  return paths
    .filter((path) => /(?:^|\/)README\.md$/i.test(path) || /^docs\/.*\.md$/i.test(path))
    .flatMap((path) => {
      const lines = readFileSync(join(repoRoot, path), "utf8").split(/\r?\n/);
      const blocks = [];
      for (let i = 0; i < lines.length; i++) {
        const open = /^ {0,3}(`{3,}|~{3,})(\S*)\s*$/.exec(lines[i]);
        if (!open) continue;
        const start = ++i;
        const close = new RegExp(`^ {0,3}${open[1][0]}{${open[1].length},}\\s*$`);
        while (i < lines.length && !close.test(lines[i])) i++;
        if (i === lines.length) throw new Error(`Unclosed fence at ${path}:${start}`);
        blocks.push({
          path,
          line: start + 1,
          language: open[2],
          code: lines.slice(start, i).join("\n") + "\n"
        });
      }
      return blocks;
    });
}
