// Compare diagnostics against the approved baseline without changing baseline files.
import { ESLint } from "eslint";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const baseline = "ba7a0f12db3f8b50201e693090c01291786cba36";
execFileSync("git", ["rev-parse", "--verify", baseline], { stdio: "ignore" });
const lint = new ESLint();
const paths = [...execFileSync("git", ["diff", "--name-only", baseline], { encoding: "utf8" }).trim().split("\n"), ...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split("\n")];
const changed = [...new Set(paths.filter(p => /\.(ts|tsx|mts|mjs)$/.test(p)))];
const included = [];
for (const file of changed) if (!await lint.isPathIgnored(file)) included.push(file);
const current = await lint.lintFiles(included);
const totals = { newErrors: 0, newWarnings: 0, preExistingErrors: 0, preExistingWarnings: 0 };
const findings = [];
for (const result of current) {
  const relative = path.relative(process.cwd(), result.filePath);
  let source = "";
  try { source = execFileSync("git", ["show", `${baseline}:${relative}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* Newly introduced file. */ }
  const previous = source ? (await lint.lintText(source, { filePath: result.filePath }))[0]?.messages || [] : [];
  // React diagnostics include source excerpts/line numbers; compare their unchanged substantive explanation.
  const signature = message => JSON.stringify([message.ruleId, message.severity, message.message.split(result.filePath)[0]]);
  const remaining = previous.map(signature);
  for (const message of result.messages) {
    const index = remaining.indexOf(signature(message));
    const preExisting = index >= 0;
    if (preExisting) remaining.splice(index, 1);
    totals[`${preExisting ? "preExisting" : "new"}${message.severity === 2 ? "Errors" : "Warnings"}`]++;
    findings.push({ file: relative, line: message.line, rule: message.ruleId, severity: message.severity, preExisting });
  }
}
const all = await lint.lintFiles(["."]);
const report = { baseline, changed: totals, findings, fullRepository: { errors: all.reduce((sum, result) => sum + result.errorCount, 0), warnings: all.reduce((sum, result) => sum + result.warningCount, 0) } };
fs.mkdirSync("docs/phase1c", { recursive: true });
fs.writeFileSync("docs/phase1c/lint-results.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ changed: totals, fullRepository: report.fullRepository }));
if (totals.newErrors || totals.newWarnings) process.exitCode = 1;
