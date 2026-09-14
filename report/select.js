// Writes report/shell_cmds.json: the report's query subset (queries/report-set.js), renumbered 1..N.
const fs = require("fs");
const path = require("path");
const Q = require("../queries/queries");
const SET = require("../queries/report-set");
const { toShell } = require("../queries/serialize");
const out = SET.map((id, i) => {
  const q = Q.find((x) => x.id === id);
  return { id: i + 1, origId: id, group: q.group, title: q.title, shell: toShell(q) };
});
fs.writeFileSync(path.join(__dirname, "shell_cmds.json"), JSON.stringify(out, null, 2));
console.log(out.length, "queries selected");
