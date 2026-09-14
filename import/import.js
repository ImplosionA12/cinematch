// CineMatch – CSV → MongoDB import
// Equivalent to:
//   mongoimport --db cinematch --collection movies  --type csv --headerline --file movies.csv
//   mongoimport --db cinematch --collection ratings --type csv --headerline --file ratings.csv
//   mongoimport --db cinematch --collection tags    --type csv --headerline --file tags.csv
//   mongoimport --db cinematch --collection links   --type csv --headerline --file links.csv
// Numeric columns are stored as numbers (mongoimport does the same with --columnsHaveTypes).
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { MongoClient } = require("mongodb");

const URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DATA = path.join(__dirname, "..", "data", "ml-latest-small");

const FILES = {
  movies:  { file: "movies.csv",  numeric: ["movieId"] },
  ratings: { file: "ratings.csv", numeric: ["userId", "movieId", "rating", "timestamp"] },
  tags:    { file: "tags.csv",    numeric: ["userId", "movieId", "timestamp"] },
  links:   { file: "links.csv",   numeric: ["movieId", "tmdbId"] }, // imdbId kept as string (leading zeros)
};

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db("cinematch");

  for (const [coll, { file, numeric }] of Object.entries(FILES)) {
    const raw = fs.readFileSync(path.join(DATA, file), "utf8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of rows) {
      for (const k of numeric) {
        if (r[k] === "" || r[k] === undefined) delete r[k];
        else r[k] = Number(r[k]);
      }
    }
    await db.collection(coll).drop().catch(() => {});
    const res = await db.collection(coll).insertMany(rows, { ordered: false });
    console.log(`${coll.padEnd(8)} ← ${file.padEnd(12)} ${res.insertedCount} documents imported`);
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
