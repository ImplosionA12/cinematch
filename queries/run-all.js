// Runs every query through real mongosh and saves the shell text + output as JSON
// (consumed by the report generator). Usage: node queries/run-all.js [--only 12,13]
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const Q = require("./queries");
const { toShell } = require("./serialize");

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1].split(",").map(Number)
  : null;

const out = [];
const outFile = path.join(__dirname, "..", "report", "results.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });

for (const q of Q) {
  if (only && !only.includes(q.id)) continue;
  const shell = toShell(q);
  const t0 = Date.now();
  let output;
  try {
    // mongosh prints the value of the last expression; cursors are auto-iterated (first 20 docs)
    output = execFileSync("mongosh", ["--quiet", "--norc", "cinematch", "--eval", shell], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" },
    });
  } catch (e) {
    output = "ERROR\n" + (e.stdout || "") + (e.stderr || "") + e.message;
  }
  const ms = Date.now() - t0;
  output = output.replace(/\r\n/g, "\n").trimEnd();
  const flag = output.startsWith("ERROR") ? "✗" : "✓";
  console.log(`${flag} ${String(q.id).padStart(2)}  ${q.title}  (${ms} ms, ${output.split("\n").length} lines)`);
  if (flag === "✗") console.log(output.slice(0, 600));
  out.push({ id: q.id, group: q.group, title: q.title, purpose: q.purpose, shell, output });
}

if (!only) fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
else {
  // merge into existing
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(outFile, "utf8")); } catch {}
  for (const r of out) { const i = prev.findIndex((p) => p.id === r.id); if (i >= 0) prev[i] = r; else prev.push(r); }
  prev.sort((a, b) => a.id - b.id);
  fs.writeFileSync(outFile, JSON.stringify(prev, null, 2));
}
console.log("saved", outFile);
