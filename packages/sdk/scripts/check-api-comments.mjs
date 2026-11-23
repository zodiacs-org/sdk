import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Follow re-exports in the installed declarations, including renamed and type-only exports.
export function checkApiComments(packageRoot) {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const entries = Object.entries(manifest.exports).filter(([, target]) => target.import?.types);
  const files = entries.map(([, target]) => join(packageRoot, target.import.types));
  const program = ts.createProgram(files, { module: ts.ModuleKind.NodeNext, skipLibCheck: true });
  const checker = program.getTypeChecker();
  const missing = [];
  const symbols = new Set();
  for (const [index, [subpath]] of entries.entries()) {
    const source = program.getSourceFile(files[index]);
    const module = checker.getSymbolAtLocation(source);
    for (const exported of checker.getExportsOfModule(module)) {
      const symbol =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      symbols.add(symbol);
      if (!ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()) {
        missing.push(subpath + " " + exported.name);
      }
    }
  }
  assert.deepEqual(missing, [], "Missing API documentation in the packed declarations");
  console.log(
    `Checked API comments for ${symbols.size} distinct declarations across ${entries.length} entry points.`
  );
}
