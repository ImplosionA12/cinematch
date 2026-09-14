// Pretty-prints JS objects the way they are typed in mongosh
// (unquoted keys, single-line short objects, 2-space indent).
function needsQuotes(k) {
  return !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k);
}

function ser(v, indent = 0) {
  const pad = " ".repeat(indent);
  const pad2 = " ".repeat(indent + 2);
  if (v === null) return "null";
  if (v instanceof Date) return `ISODate("${v.toISOString()}")`;
  if (v instanceof RegExp) return v.toString();
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const inner = v.map((x) => ser(x, indent + 2));
    const oneLine = `[${inner.join(", ")}]`;
    if (oneLine.length + indent < 70 && !oneLine.includes("\n")) return oneLine;
    return `[\n${inner.map((s) => pad2 + s).join(",\n")}\n${pad}]`;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    const inner = keys.map((k) => `${needsQuotes(k) ? JSON.stringify(k) : k}: ${ser(v[k], indent + 2)}`);
    const oneLine = `{ ${inner.join(", ")} }`;
    if (oneLine.length + indent < 70 && !oneLine.includes("\n")) return oneLine;
    return `{\n${inner.map((s) => pad2 + s).join(",\n")}\n${pad}}`;
  }
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

// Build the mongosh command text for a query definition
function toShell(q) {
  if (q.shell) return q.shell;
  const c = `db.${q.collection}`;
  switch (q.kind) {
    case "find": {
      let s = `${c}.find(${ser(q.filter || {})}${q.projection ? ", " + ser(q.projection) : ""})`;
      if (q.sort) s += `.sort(${ser(q.sort)})`;
      if (q.skip) s += `.skip(${q.skip})`;
      if (q.limit) s += `.limit(${q.limit})`;
      return s;
    }
    case "findOne":
      return `${c}.findOne(${ser(q.filter || {})}${q.projection ? ", " + ser(q.projection) : ""})`;
    case "count":
      return `${c}.countDocuments(${ser(q.filter || {})})`;
    case "distinct":
      return `${c}.distinct(${JSON.stringify(q.field)}${q.filter ? ", " + ser(q.filter) : ""})`;
    case "aggregate":
      return `${c}.aggregate(${ser(q.pipeline)})${q.all ? ".toArray()" : ""}`;
    default:
      throw new Error("unknown kind " + q.kind);
  }
}

module.exports = { ser, toShell };
