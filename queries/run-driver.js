// Runs every query with the Node driver (used to prepare a remote/Atlas database:
// enrichment updates, indexes and the movie_stats $merge). Usage: MONGO_URI=... node queries/run-driver.js
const { MongoClient } = require("mongodb");
const Q = require("./queries");

async function runQuery(db, q) {
  const c = q.collection && db.collection(q.collection);
  switch (q.kind) {
    case "raw": return q.run(db);
    case "find": { let cur = c.find(q.filter || {}, { projection: q.projection }); if (q.sort) cur = cur.sort(q.sort); if (q.limit) cur = cur.limit(q.limit); return cur.toArray(); }
    case "findOne": return c.findOne(q.filter || {}, { projection: q.projection });
    case "count": return c.countDocuments(q.filter || {});
    case "distinct": return c.distinct(q.field, q.filter || {});
    case "aggregate": return c.aggregate(q.pipeline, { allowDiskUse: true }).toArray();
  }
}

(async () => {
  const client = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db("cinematch");
  for (const q of Q) {
    const t0 = Date.now();
    try {
      const r = await runQuery(db, q);
      const n = Array.isArray(r) ? r.length : r && typeof r === "object" ? 1 : r;
      console.log(`✓ ${String(q.id).padStart(2)}  ${q.title}  (${Date.now() - t0} ms, ${n})`);
    } catch (e) {
      console.log(`✗ ${String(q.id).padStart(2)}  ${q.title}  ${e.message}`);
    }
  }
  await client.close();
})();
