// CineMatch API – Express + MongoDB Node driver
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient } = require("mongodb");
const Q = require("../queries/queries");
const { toShell } = require("../queries/serialize");

const PORT = process.env.PORT || 4000;
const URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

const app = express();
app.use(cors());
app.use(express.json());

let db;
const cache = new Map();
const cached = async (key, fn, ttl = 5 * 60 * 1000) => {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const val = await fn();
  cache.set(key, { val, exp: Date.now() + ttl });
  return val;
};

async function runQuery(q) {
  const c = q.collection && db.collection(q.collection);
  switch (q.kind) {
    case "raw": return q.run(db);
    case "find": {
      let cur = c.find(q.filter || {}, { projection: q.projection });
      if (q.sort) cur = cur.sort(q.sort);
      if (q.skip) cur = cur.skip(q.skip);
      if (q.limit) cur = cur.limit(q.limit);
      return cur.toArray();
    }
    case "findOne": return c.findOne(q.filter || {}, { projection: q.projection });
    case "count": return c.countDocuments(q.filter || {});
    case "distinct": return c.distinct(q.field, q.filter || {});
    case "aggregate": return c.aggregate(q.pipeline, { allowDiskUse: true }).toArray();
  }
}

/* ── Query catalogue ─────────────────────────────────────────────── */
app.get("/api/queries", (req, res) => {
  res.json(Q.map((q) => ({ id: q.id, group: q.group, title: q.title, purpose: q.purpose, kind: q.kind, collection: q.collection, shell: toShell(q), chart: q.chart || null })));
});

app.get("/api/queries/:id/run", async (req, res) => {
  const q = Q.find((x) => x.id === Number(req.params.id));
  if (!q) return res.status(404).json({ error: "not found" });
  const t0 = Date.now();
  try {
    const result = await runQuery(q);
    res.json({ id: q.id, ms: Date.now() - t0, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Runs the catalogue's mongosh text in a real mongosh process (fixed scripts only, never client input).
const { execFile } = require("child_process");
const fs = require("fs");
const localMongosh = path.join(__dirname, "..", "node_modules", ".bin", "mongosh");
const MONGOSH = process.env.MONGOSH_BIN || (process.platform !== "win32" && fs.existsSync(localMongosh) ? localMongosh : "mongosh");

const scrub = (t) => String(t).split(URI).join("<MONGO_URI>").replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, "<MONGO_URI>");

app.get("/api/queries/:id/shell", (req, res) => {
  const q = Q.find((x) => x.id === Number(req.params.id));
  if (!q) return res.status(404).json({ error: "not found" });
  const t0 = Date.now();
  const script = `db = db.getSiblingDB("cinematch");\n${toShell(q)}`;
  execFile(MONGOSH, [URI, "--quiet", "--norc", "--eval", script],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 60000, env: { ...process.env, NO_COLOR: "1" } },
    (err, stdout, stderr) => {
      const ms = Date.now() - t0;
      if (err && !stdout) return res.status(500).json({ error: "mongosh unavailable or failed: " + scrub((stderr || err.message).split("\n")[0]), ms });
      res.json({ id: q.id, ms, output: scrub(stdout + (err ? "\n" + stderr : "")).replace(/\r\n/g, "\n").trimEnd() });
    });
});

/* ── Overview ────────────────────────────────────────────────────── */
app.get("/api/overview", async (req, res) => {
  const data = await cached("overview", async () => {
    const [counts, ratingStats, byStar, byYear, byGenre, topRated, mostRated, decades] = await Promise.all([
      (async () => ({
        movies: await db.collection("movies").countDocuments(),
        ratings: await db.collection("ratings").countDocuments(),
        tags: await db.collection("tags").countDocuments(),
        users: (await db.collection("ratings").distinct("userId")).length,
      }))(),
      db.collection("ratings").aggregate([{ $group: { _id: null, avg: { $avg: "$rating" }, sd: { $stdDevPop: "$rating" } } }]).next(),
      db.collection("ratings").aggregate([{ $group: { _id: "$rating", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
      db.collection("ratings").aggregate([{ $group: { _id: { $year: "$ratedAt" }, n: { $sum: 1 }, avg: { $avg: "$rating" } } }, { $sort: { _id: 1 } }]).toArray(),
      db.collection("movies").aggregate([
        { $lookup: { from: "movie_stats", localField: "movieId", foreignField: "_id", as: "s" } },
        { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
        { $unwind: "$genreList" },
        { $group: { _id: "$genreList", movies: { $sum: 1 }, ratings: { $sum: { $ifNull: ["$s.ratingCount", 0] } }, avg: { $avg: "$s.avgRating" } } },
        { $sort: { movies: -1 } },
      ]).toArray(),
      db.collection("movie_stats").aggregate([
        { $match: { ratingCount: { $gte: 100 } } }, { $sort: { avgRating: -1 } }, { $limit: 10 },
        { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "m" } }, { $unwind: "$m" },
        { $project: { _id: 0, movieId: "$_id", title: "$m.title", year: "$m.year", genres: "$m.genreList", ratingCount: 1, avgRating: 1 } },
      ]).toArray(),
      db.collection("movie_stats").aggregate([
        { $sort: { ratingCount: -1 } }, { $limit: 10 },
        { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "m" } }, { $unwind: "$m" },
        { $project: { _id: 0, movieId: "$_id", title: "$m.title", year: "$m.year", genres: "$m.genreList", ratingCount: 1, avgRating: 1 } },
      ]).toArray(),
      db.collection("movies").aggregate([
        { $match: { year: { $ne: null } } },
        { $group: { _id: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, n: { $sum: 1 } } }, { $sort: { _id: 1 } },
      ]).toArray(),
    ]);
    return { counts, avgRating: ratingStats.avg, stdDev: ratingStats.sd, byStar, byYear, byGenre, topRated, mostRated, decades };
  });
  res.json(data);
});

/* ── Movies ──────────────────────────────────────────────────────── */
app.get("/api/movies", async (req, res) => {
  const { q = "", genre, sort = "popular", page = 1, limit = 24, minRatings = 0 } = req.query;
  const match = {};
  if (q) match.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (genre) match.genreList = genre;
  const sortMap = { popular: { "s.ratingCount": -1 }, rating: { "s.avgRating": -1 }, newest: { year: -1 }, oldest: { year: 1 }, controversial: { "s.stdDev": -1 } };
  const pipeline = [
    { $match: match },
    { $lookup: { from: "movie_stats", localField: "movieId", foreignField: "_id", as: "s" } },
    { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
    { $addFields: { "s.ratingCount": { $ifNull: ["$s.ratingCount", 0] } } },
    { $match: { "s.ratingCount": { $gte: Number(minRatings) } } },
    { $sort: { ...sortMap[sort], movieId: 1 } },
    { $facet: {
        total: [{ $count: "n" }],
        items: [
          { $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) },
          { $project: { _id: 0, movieId: 1, title: 1, year: 1, genres: "$genreList", ratingCount: "$s.ratingCount", avgRating: { $round: [{ $ifNull: ["$s.avgRating", 0] }, 2] }, stdDev: { $round: [{ $ifNull: ["$s.stdDev", 0] }, 2] } } },
        ],
    } },
  ];
  const [r] = await db.collection("movies").aggregate(pipeline).toArray();
  res.json({ total: r.total[0]?.n || 0, items: r.items });
});

app.get("/api/movies/:id", async (req, res) => {
  const movieId = Number(req.params.id);
  const movie = await db.collection("movies").findOne({ movieId }, { projection: { _id: 0 } });
  if (!movie) return res.status(404).json({ error: "not found" });
  const [stats, dist, tags, link, similar, alsoLiked] = await Promise.all([
    db.collection("movie_stats").findOne({ _id: movieId }),
    db.collection("ratings").aggregate([{ $match: { movieId } }, { $group: { _id: "$rating", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
    db.collection("tags").aggregate([{ $match: { movieId } }, { $group: { _id: { $toLower: "$tag" }, n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 20 }]).toArray(),
    db.collection("links").findOne({ movieId }, { projection: { _id: 0 } }),
    db.collection("movies").aggregate([
      { $match: { movieId: { $ne: movieId } } },
      { $addFields: { shared: { $size: { $setIntersection: ["$genreList", movie.genreList] } } } },
      { $match: { shared: { $gte: Math.max(1, movie.genreList.length - 1) } } },
      { $lookup: { from: "movie_stats", localField: "movieId", foreignField: "_id", as: "s" } }, { $unwind: "$s" },
      { $match: { "s.ratingCount": { $gte: 20 } } },
      { $sort: { shared: -1, "s.avgRating": -1 } }, { $limit: 8 },
      { $project: { _id: 0, movieId: 1, title: 1, year: 1, genres: "$genreList", shared: 1, ratingCount: "$s.ratingCount", avgRating: { $round: ["$s.avgRating", 2] } } },
    ]).toArray(),
    db.collection("ratings").aggregate([
      { $match: { movieId, rating: { $gte: 4 } } },
      { $group: { _id: null, fans: { $addToSet: "$userId" } } },
      { $lookup: { from: "ratings", let: { fans: "$fans" }, pipeline: [
          { $match: { $expr: { $and: [{ $in: ["$userId", "$$fans"] }, { $gte: ["$rating", 4] }, { $ne: ["$movieId", movieId] }] } } },
          { $group: { _id: "$movieId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 },
          { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "m" } }, { $unwind: "$m" },
          { $project: { _id: 0, movieId: "$_id", title: "$m.title", year: "$m.year", genres: "$m.genreList", fans: "$n" } },
        ], as: "also" } },
      { $project: { _id: 0, fanCount: { $size: "$fans" }, also: 1 } },
    ]).next(),
  ]);
  res.json({ ...movie, stats: stats && { ratingCount: stats.ratingCount, avgRating: stats.avgRating, stdDev: stats.stdDev }, distribution: dist, tags, link, similar, alsoLiked: alsoLiked || { fanCount: 0, also: [] } });
});

/* ── Genres ──────────────────────────────────────────────────────── */
app.get("/api/genres/:genre", async (req, res) => {
  const genre = req.params.genre;
  const [byDecade, top] = await Promise.all([
    db.collection("movies").aggregate([
      { $match: { genreList: genre, year: { $ne: null } } },
      { $lookup: { from: "movie_stats", localField: "movieId", foreignField: "_id", as: "s" } },
      { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, movies: { $sum: 1 }, avg: { $avg: "$s.avgRating" } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection("movies").aggregate([
      { $match: { genreList: genre } },
      { $lookup: { from: "movie_stats", localField: "movieId", foreignField: "_id", as: "s" } }, { $unwind: "$s" },
      { $match: { "s.ratingCount": { $gte: 30 } } },
      { $sort: { "s.avgRating": -1 } }, { $limit: 10 },
      { $project: { _id: 0, movieId: 1, title: 1, year: 1, genres: "$genreList", ratingCount: "$s.ratingCount", avgRating: { $round: ["$s.avgRating", 2] } } },
    ]).toArray(),
  ]);
  res.json({ genre, byDecade, top });
});

/* ── Users ───────────────────────────────────────────────────────── */
app.get("/api/users/top", async (req, res) => {
  const data = await cached("users-top", () => db.collection("ratings").aggregate([
    { $group: { _id: "$userId", ratings: { $sum: 1 }, avg: { $avg: "$rating" }, first: { $min: "$ratedAt" }, last: { $max: "$ratedAt" } } },
    { $sort: { ratings: -1 } }, { $limit: 50 },
    { $project: { _id: 0, userId: "$_id", ratings: 1, avg: { $round: ["$avg", 2] }, first: 1, last: 1 } },
  ]).toArray());
  res.json(data);
});

app.get("/api/users/:id", async (req, res) => {
  const userId = Number(req.params.id);
  const [profile, genres, recent, recs] = await Promise.all([
    db.collection("ratings").aggregate([
      { $match: { userId } },
      { $group: { _id: "$userId", ratings: { $sum: 1 }, avg: { $avg: "$rating" }, first: { $min: "$ratedAt" }, last: { $max: "$ratedAt" }, dist: { $push: "$rating" } } },
    ]).next(),
    db.collection("ratings").aggregate([
      { $match: { userId } },
      { $lookup: { from: "movies", localField: "movieId", foreignField: "movieId", as: "m" } }, { $unwind: "$m" }, { $unwind: "$m.genreList" },
      { $group: { _id: "$m.genreList", n: { $sum: 1 }, avg: { $avg: "$rating" } } },
      { $project: { genre: "$_id", _id: 0, n: 1, avg: { $round: ["$avg", 2] } } },
      { $sort: { n: -1 } },
    ]).toArray(),
    db.collection("ratings").aggregate([
      { $match: { userId } }, { $sort: { ratedAt: -1 } }, { $limit: 12 },
      { $lookup: { from: "movies", localField: "movieId", foreignField: "movieId", as: "m" } }, { $unwind: "$m" },
      { $project: { _id: 0, movieId: 1, rating: 1, ratedAt: 1, title: "$m.title", year: "$m.year", genres: "$m.genreList" } },
    ]).toArray(),
    (async () => {
      const fav = await db.collection("ratings").aggregate([
        { $match: { userId, rating: { $gte: 4 } } },
        { $lookup: { from: "movies", localField: "movieId", foreignField: "movieId", as: "m" } }, { $unwind: "$m" }, { $unwind: "$m.genreList" },
        { $group: { _id: "$m.genreList", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 2 },
      ]).toArray();
      const favGenres = fav.map((f) => f._id);
      if (!favGenres.length) return { favGenres, items: [] };
      const items = await db.collection("movies").aggregate([
        { $match: { genreList: { $all: favGenres } } },
        { $lookup: { from: "ratings", let: { mid: "$movieId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$movieId", "$$mid"] }, { $eq: ["$userId", userId] }] } } }, { $limit: 1 }], as: "seen" } },
        { $match: { seen: { $size: 0 } } },
        { $lookup: { from: "movie_stats", localField: "movieId", foreignField: "_id", as: "s" } }, { $unwind: "$s" },
        { $match: { "s.ratingCount": { $gte: 30 } } },
        { $addFields: { weighted: { $add: [{ $multiply: [{ $divide: ["$s.ratingCount", { $add: ["$s.ratingCount", 50] }] }, "$s.avgRating"] }, { $multiply: [{ $divide: [50, { $add: ["$s.ratingCount", 50] }] }, 3.5] }] } } },
        { $sort: { weighted: -1 } }, { $limit: 10 },
        { $project: { _id: 0, movieId: 1, title: 1, year: 1, genres: "$genreList", ratingCount: "$s.ratingCount", avgRating: { $round: ["$s.avgRating", 2] }, weighted: { $round: ["$weighted", 3] } } },
      ]).toArray();
      return { favGenres, items };
    })(),
  ]);
  if (!profile) return res.status(404).json({ error: "not found" });
  const dist = {};
  for (const r of profile.dist) dist[r] = (dist[r] || 0) + 1;
  res.json({ userId, ratings: profile.ratings, avg: profile.avg, first: profile.first, last: profile.last, distribution: Object.entries(dist).map(([k, v]) => ({ _id: Number(k), n: v })).sort((a, b) => a._id - b._id), genres, recent, recommendations: recs });
});

/* ── Static frontend ─────────────────────────────────────────────── */
const dist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));

new MongoClient(URI).connect().then((client) => {
  db = client.db("cinematch");
  app.listen(PORT, () => console.log(`CineMatch API → http://localhost:${PORT}`));
});
