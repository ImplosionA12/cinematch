// CineMatch – the complete query catalogue.
// Every entry is used three ways:
//   * the report generator turns it into mongosh text (serialize.toShell) and runs it in mongosh
//   * the Express API executes it with the Node driver
//   * the React dashboard renders the result (chart hints below)
//
// kind: find | findOne | count | distinct | aggregate | raw (shell + run)

const Q = [];
let n = 0;
const add = (group, def) => Q.push({ id: ++n, group, ...def });

/* ───────────────────────── 1. Database Overview ───────────────────────── */

add("Database Overview", {
  title: "List all collections in the cinematch database",
  purpose: "Verify that the four CSV files were imported as separate collections.",
  kind: "raw",
  shell: "db.getCollectionNames()",
  run: async (db) => (await db.listCollections().toArray()).map((c) => c.name).sort(),
});

add("Database Overview", {
  title: "Count documents in every collection",
  purpose: "Confirm the row counts match the dataset description (9,742 movies, 100,836 ratings, 3,683 tags, 9,742 links).",
  kind: "raw",
  shell: `({
  movies:  db.movies.countDocuments(),
  ratings: db.ratings.countDocuments(),
  tags:    db.tags.countDocuments(),
  links:   db.links.countDocuments()
})`,
  run: async (db) => ({
    movies: await db.collection("movies").countDocuments(),
    ratings: await db.collection("ratings").countDocuments(),
    tags: await db.collection("tags").countDocuments(),
    links: await db.collection("links").countDocuments(),
  }),
  chart: { type: "kpi" },
});

add("Database Overview", {
  title: "Display a sample movie document",
  purpose: "Examine the raw document structure produced by the CSV import (genres is a pipe-delimited string).",
  kind: "findOne", collection: "movies", filter: { movieId: 1 },
});

add("Database Overview", {
  title: "Display a sample rating document",
  purpose: "Ratings reference movies through movieId; timestamp is Unix epoch seconds.",
  kind: "findOne", collection: "ratings", filter: { userId: 1, movieId: 1 },
});

add("Database Overview", {
  title: "Display a sample tag and link document",
  purpose: "Tags are free-text labels applied by users; links map movieId to IMDb and TMDb identifiers.",
  kind: "raw",
  shell: `[ db.tags.findOne({ movieId: 60756 }), db.links.findOne({ movieId: 1 }) ]`,
  run: async (db) => [
    await db.collection("tags").findOne({ movieId: 60756 }),
    await db.collection("links").findOne({ movieId: 1 }),
  ],
});

add("Database Overview", {
  title: "Count the number of distinct users who rated movies",
  purpose: "Establish the size of the user base (610 users, each with at least 20 ratings).",
  kind: "aggregate", collection: "ratings",
  pipeline: [{ $group: { _id: "$userId" } }, { $count: "totalUsers" }],
});

/* ─────────────────── 2. Data Cleaning & Schema Enrichment ─────────────────── */

add("Data Cleaning & Schema Enrichment", {
  title: "Extract the release year from the movie title",
  purpose: "Titles end with the year in parentheses, e.g. 'Toy Story (1995)'. A pipeline-style update with $regexFind captures it and $toInt stores it as a numeric year field (null when a title has no year).",
  kind: "raw",
  shell: `db.movies.updateMany({}, [
  {
    $set: {
      year: {
        $let: {
          vars: { m: { $regexFind: { input: "$title", regex: /\\((\\d{4})\\)\\s*$/ } } },
          in: {
            $cond: [
              { $eq: ["$$m", null] },
              null,
              { $toInt: { $arrayElemAt: ["$$m.captures", 0] } }
            ]
          }
        }
      }
    }
  }
])`,
  run: (db) => db.collection("movies").updateMany({}, [
    { $set: { year: { $let: { vars: { m: { $regexFind: { input: "$title", regex: /\((\d{4})\)\s*$/ } } }, in: { $cond: [{ $eq: ["$$m", null] }, null, { $toInt: { $arrayElemAt: ["$$m.captures", 0] } }] } } } } },
  ]),
});

add("Data Cleaning & Schema Enrichment", {
  title: "Split the pipe-delimited genres string into an array",
  purpose: "genres: 'Adventure|Animation|Children' becomes genreList: ['Adventure','Animation','Children'] so genres can be queried and unwound individually.",
  kind: "raw",
  shell: `db.movies.updateMany({}, [
  { $set: { genreList: { $split: ["$genres", "|"] } } }
])`,
  run: (db) => db.collection("movies").updateMany({}, [{ $set: { genreList: { $split: ["$genres", "|"] } } }]),
});

add("Data Cleaning & Schema Enrichment", {
  title: "Convert Unix timestamps into ISODate fields",
  purpose: "Epoch seconds are multiplied by 1000 and converted with $toDate so that $year, $month and $dayOfWeek can be used later.",
  kind: "raw",
  shell: `db.ratings.updateMany({}, [
  { $set: { ratedAt: { $toDate: { $multiply: ["$timestamp", 1000] } } } }
]);
db.tags.updateMany({}, [
  { $set: { taggedAt: { $toDate: { $multiply: ["$timestamp", 1000] } } } }
])`,
  run: async (db) => ({
    ratings: await db.collection("ratings").updateMany({}, [{ $set: { ratedAt: { $toDate: { $multiply: ["$timestamp", 1000] } } } }]),
    tags: await db.collection("tags").updateMany({}, [{ $set: { taggedAt: { $toDate: { $multiply: ["$timestamp", 1000] } } } }]),
  }),
});

add("Data Cleaning & Schema Enrichment", {
  title: "Normalise titles that end with a trailing article",
  purpose: "MovieLens stores titles as 'Shawshank Redemption, The (1994)'. A $regexFind update moves the trailing article (The/A/An) back to the front so titles read naturally in results.",
  kind: "raw",
  shell: `db.movies.updateMany(
  { title: /, (The|A|An) \\(/ },
  [
    {
      $set: {
        title: {
          $let: {
            vars: { m: { $regexFind: { input: "$title", regex: /^(.+), (The|A|An) (\\(.+)$/ } } },
            in: {
              $concat: [
                { $arrayElemAt: ["$$m.captures", 1] }, " ",
                { $arrayElemAt: ["$$m.captures", 0] }, " ",
                { $arrayElemAt: ["$$m.captures", 2] }
              ]
            }
          }
        }
      }
    }
  ]
)`,
  run: (db) => db.collection("movies").updateMany({ title: /, (The|A|An) \(/ }, [
    { $set: { title: { $let: { vars: { m: { $regexFind: { input: "$title", regex: /^(.+), (The|A|An) (\(.+)$/ } } }, in: { $concat: [{ $arrayElemAt: ["$$m.captures", 1] }, " ", { $arrayElemAt: ["$$m.captures", 0] }, " ", { $arrayElemAt: ["$$m.captures", 2] }] } } } } },
  ]),
});

add("Data Cleaning & Schema Enrichment", {
  title: "Verify the enriched movie documents",
  purpose: "Toy Story now carries year and genreList in addition to the original fields, and movieId 318 reads 'The Shawshank Redemption (1994)' after title normalisation.",
  kind: "raw",
  shell: `[ db.movies.findOne({ movieId: 1 }), db.movies.findOne({ movieId: 318 }, { _id: 0, title: 1, year: 1, genreList: 1 }) ]`,
  run: async (db) => [await db.collection("movies").findOne({ movieId: 1 }), await db.collection("movies").findOne({ movieId: 318 }, { projection: { _id: 0, title: 1, year: 1, genreList: 1 } })],
});

add("Data Cleaning & Schema Enrichment", {
  title: "Create indexes on frequently queried fields",
  purpose: "movieId/userId support $lookup joins, genreList becomes a multikey index, and a text index enables keyword search on titles.",
  kind: "raw",
  shell: `db.ratings.createIndex({ movieId: 1 });
db.ratings.createIndex({ userId: 1 });
db.tags.createIndex({ movieId: 1 });
db.movies.createIndex({ movieId: 1 }, { unique: true });
db.movies.createIndex({ genreList: 1 });
db.movies.createIndex({ year: 1 });
db.movies.createIndex({ title: "text" });
db.movies.getIndexes().map(i => i.name)`,
  run: async (db) => {
    await db.collection("ratings").createIndex({ movieId: 1 });
    await db.collection("ratings").createIndex({ userId: 1 });
    await db.collection("tags").createIndex({ movieId: 1 });
    await db.collection("movies").createIndex({ movieId: 1 }, { unique: true });
    await db.collection("movies").createIndex({ genreList: 1 });
    await db.collection("movies").createIndex({ year: 1 });
    await db.collection("movies").createIndex({ title: "text" });
    return (await db.collection("movies").indexes()).map((i) => i.name);
  },
});

/* ───────────────────────── 3. Movie Exploration ───────────────────────── */

add("Movie Exploration", {
  title: "Find movies released in 1995",
  purpose: "Simple equality filter with projection to hide _id and show only the title and genres.",
  kind: "find", collection: "movies", filter: { year: 1995 },
  projection: { _id: 0, movieId: 1, title: 1, genres: 1 }, limit: 5,
});

add("Movie Exploration", {
  title: "Search movie titles with a regular expression",
  purpose: "Case-insensitive pattern matching to find every Star Wars film in the catalogue.",
  kind: "find", collection: "movies", filter: { title: { $regex: "star wars", $options: "i" } },
  projection: { _id: 0, title: 1, year: 1 }, sort: { year: 1 },
});

add("Movie Exploration", {
  title: "Find movies that are both Comedy and Romance",
  purpose: "$all matches documents whose genreList array contains every listed genre.",
  kind: "find", collection: "movies", filter: { genreList: { $all: ["Comedy", "Romance"] }, year: { $gte: 2015 } },
  projection: { _id: 0, title: 1, genres: 1 }, limit: 5,
});

add("Movie Exploration", {
  title: "Count movies with no genres listed",
  purpose: "Data-quality check: some entries carry the placeholder '(no genres listed)'.",
  kind: "count", collection: "movies", filter: { genres: "(no genres listed)" },
});

add("Movie Exploration", {
  title: "Number of movies per genre",
  purpose: "$unwind turns each genre into a separate document so $group can count them.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $unwind: "$genreList" },
    { $group: { _id: "$genreList", movieCount: { $sum: 1 } } },
    { $sort: { movieCount: -1 } },
  ],
  chart: { type: "bar", x: "_id", y: "movieCount" },
});

add("Movie Exploration", {
  title: "Number of movies released per decade",
  purpose: "Bucket movies by decade using arithmetic on the year field.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $match: { year: { $ne: null } } },
    { $group: { _id: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, movies: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ],
  chart: { type: "bar", x: "_id", y: "movies" },
});

add("Movie Exploration", {
  title: "Top 5 years with the most movie releases",
  kind: "aggregate", collection: "movies",
  purpose: "Group by year, count and rank.",
  pipeline: [
    { $match: { year: { $ne: null } } },
    { $group: { _id: "$year", movies: { $sum: 1 } } },
    { $sort: { movies: -1 } },
    { $limit: 5 },
  ],
  chart: { type: "bar", x: "_id", y: "movies" },
});

add("Movie Exploration", {
  title: "Most common genre combinations",
  purpose: "Grouping on the original genres string reveals which multi-genre combinations occur most often.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $match: { genreList: { $not: { $size: 1 } } } },
    { $group: { _id: "$genres", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ],
  chart: { type: "bar", x: "_id", y: "count" },
});

add("Movie Exploration", {
  title: "Full-text search on movie titles",
  purpose: "Uses the text index created earlier; $meta returns the relevance score.",
  kind: "find", collection: "movies", filter: { $text: { $search: "lord rings" } },
  projection: { _id: 0, title: 1, score: { $meta: "textScore" } },
  sort: { score: { $meta: "textScore" } }, limit: 5,
});

/* ───────────────────────── 4. Rating Analysis ───────────────────────── */

add("Rating Analysis", {
  title: "Rating distribution (how often each star value is used)",
  purpose: "Ratings run from 0.5 to 5.0 in half-star steps; the distribution shows users favour whole stars and 4.0 is the most common value.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ],
  chart: { type: "bar", x: "_id", y: "count" },
});

add("Rating Analysis", {
  title: "Overall rating statistics",
  purpose: "$avg, $min, $max and $stdDevPop over the entire ratings collection.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: null, totalRatings: { $sum: 1 }, avgRating: { $avg: "$rating" }, minRating: { $min: "$rating" }, maxRating: { $max: "$rating" }, stdDev: { $stdDevPop: "$rating" } } },
    { $project: { _id: 0, totalRatings: 1, avgRating: { $round: ["$avgRating", 3] }, minRating: 1, maxRating: 1, stdDev: { $round: ["$stdDev", 3] } } },
  ],
  chart: { type: "kpi" },
});

add("Rating Analysis", {
  title: "Average rating of a specific movie (Toy Story)",
  purpose: "$match narrows to one movieId before grouping.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $match: { movieId: 1 } },
    { $group: { _id: "$movieId", ratings: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
  ],
});

add("Rating Analysis", {
  title: "Top 5 most-rated (most popular) movies",
  purpose: "Count ratings per movie, then $lookup joins the movies collection to attach the title.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $sort: { ratingCount: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", ratingCount: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
  chart: { type: "hbar", x: "title", y: "ratingCount" },
});

add("Rating Analysis", {
  title: "Top 5 highest-rated movies (minimum 100 ratings)",
  purpose: "A minimum rating count avoids movies rated 5.0 by a single user.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $match: { ratingCount: { $gte: 100 } } },
    { $sort: { avgRating: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", year: "$movie.year", ratingCount: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
  chart: { type: "hbar", x: "title", y: "avgRating" },
});

add("Rating Analysis", {
  title: "5 lowest-rated movies (minimum 30 ratings)",
  purpose: "Same pipeline sorted ascending to find widely watched but poorly received films.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $match: { ratingCount: { $gte: 30 } } },
    { $sort: { avgRating: 1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", ratingCount: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
  chart: { type: "hbar", x: "title", y: "avgRating" },
});

add("Rating Analysis", {
  title: "Most controversial movies (highest rating variance)",
  purpose: "$stdDevPop measures disagreement between users; a high value means the audience is split between loving and hating the film.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" }, stdDev: { $stdDevPop: "$rating" } } },
    { $match: { ratingCount: { $gte: 50 } } },
    { $sort: { stdDev: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", ratingCount: 1, avgRating: { $round: ["$avgRating", 2] }, stdDev: { $round: ["$stdDev", 3] } } },
  ],
  chart: { type: "hbar", x: "title", y: "stdDev" },
});

add("Rating Analysis", {
  title: "Movies with the most 5-star ratings",
  purpose: "Filter to perfect scores first, then count per movie.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $match: { rating: 5 } },
    { $group: { _id: "$movieId", fiveStars: { $sum: 1 } } },
    { $sort: { fiveStars: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", fiveStars: 1 } },
  ],
  chart: { type: "hbar", x: "title", y: "fiveStars" },
});

add("Rating Analysis", {
  title: "Movies that have never been rated",
  purpose: "A $lookup from movies to ratings followed by $match on an empty array finds catalogue entries with zero ratings (an anti-join).",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $lookup: { from: "ratings", localField: "movieId", foreignField: "movieId", as: "r" } },
    { $match: { r: { $size: 0 } } },
    { $count: "unratedMovies" },
  ],
});

add("Rating Analysis", {
  title: "Weighted rating (IMDb-style Bayesian formula) – Top 5",
  purpose: "WR = (v/(v+m))·R + (m/(v+m))·C, where v = votes, m = 50 (minimum), R = movie mean, C = global mean 3.5. Balances quality against popularity.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", v: { $sum: 1 }, R: { $avg: "$rating" } } },
    { $match: { v: { $gte: 50 } } },
    { $addFields: { weighted: { $add: [ { $multiply: [{ $divide: ["$v", { $add: ["$v", 50] }] }, "$R"] }, { $multiply: [{ $divide: [50, { $add: ["$v", 50] }] }, 3.5] } ] } } },
    { $sort: { weighted: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", votes: "$v", avgRating: { $round: ["$R", 2] }, weightedRating: { $round: ["$weighted", 3] } } },
  ],
  chart: { type: "hbar", x: "title", y: "weightedRating" },
});

/* ───────────────────────── 5. Genre Analysis ───────────────────────── */

add("Genre Analysis", {
  title: "Average rating per genre",
  purpose: "Join every movie to its ratings, unwind both arrays, and compute the mean rating and rating volume of each genre.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $lookup: { from: "ratings", localField: "movieId", foreignField: "movieId", as: "r" } },
    { $unwind: "$r" },
    { $unwind: "$genreList" },
    { $group: { _id: "$genreList", avgRating: { $avg: "$r.rating" }, ratings: { $sum: 1 } } },
    { $project: { avgRating: { $round: ["$avgRating", 3] }, ratings: 1 } },
    { $sort: { avgRating: -1 } },
  ],
  chart: { type: "bar", x: "_id", y: "avgRating" },
});

add("Genre Analysis", {
  title: "Most popular genres by number of ratings",
  purpose: "$size of the joined ratings array is summed per genre – shows what people actually watch rather than what they rate highly.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $lookup: { from: "ratings", localField: "movieId", foreignField: "movieId", as: "r" } },
    { $project: { genreList: 1, n: { $size: "$r" } } },
    { $unwind: "$genreList" },
    { $group: { _id: "$genreList", ratings: { $sum: "$n" } } },
    { $sort: { ratings: -1 } },
    { $limit: 5 },
  ],
  chart: { type: "pie", x: "_id", y: "ratings" },
});

add("Genre Analysis", {
  title: "Best movie in each genre (minimum 50 ratings, first 5 genres)",
  purpose: "$sort followed by $group with $first picks the top-rated title per genre.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $match: { ratingCount: { $gte: 50 } } },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $unwind: "$movie.genreList" },
    { $sort: { avgRating: -1 } },
    { $group: { _id: "$movie.genreList", bestMovie: { $first: "$movie.title" }, avgRating: { $first: { $round: ["$avgRating", 2] } }, ratingCount: { $first: "$ratingCount" } } },
    { $sort: { _id: 1 } },
    { $limit: 5 },
  ],
});

add("Genre Analysis", {
  title: "Genre popularity by decade (Action vs Drama vs Comedy)",
  purpose: "Two-level grouping (decade + genre) to see how the catalogue mix changed over time.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $match: { year: { $gte: 1970 }, genreList: { $in: ["Action", "Drama", "Comedy"] } } },
    { $unwind: "$genreList" },
    { $match: { genreList: { $in: ["Action", "Drama", "Comedy"] } } },
    { $group: { _id: { decade: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, genre: "$genreList" }, movies: { $sum: 1 } } },
    { $sort: { "_id.decade": 1, "_id.genre": 1 } },
  ],
  chart: { type: "grouped", x: "_id.decade", series: "_id.genre", y: "movies" },
});

add("Genre Analysis", {
  title: "Average number of genres per movie",
  purpose: "$size on the genreList array, averaged across the catalogue.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $project: { genreCount: { $size: "$genreList" } } },
    { $group: { _id: null, avgGenres: { $avg: "$genreCount" }, maxGenres: { $max: "$genreCount" } } },
    { $project: { _id: 0, avgGenres: { $round: ["$avgGenres", 2] }, maxGenres: 1 } },
  ],
});

/* ───────────────────────── 6. User Analysis ───────────────────────── */

add("User Analysis", {
  title: "Top 5 most active users",
  purpose: "Users ranked by number of ratings submitted, with each user's average score.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$userId", ratings: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $sort: { ratings: -1 } },
    { $limit: 5 },
    { $project: { userId: "$_id", _id: 0, ratings: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
  chart: { type: "bar", x: "userId", y: "ratings" },
});

add("User Analysis", {
  title: "Harshest and most generous critics (minimum 100 ratings)",
  purpose: "$facet runs two sub-pipelines in one query: lowest and highest average scorers.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$userId", ratings: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $match: { ratings: { $gte: 100 } } },
    { $project: { userId: "$_id", _id: 0, ratings: 1, avgRating: { $round: ["$avgRating", 2] } } },
    { $facet: {
        harshest: [{ $sort: { avgRating: 1 } }, { $limit: 5 }],
        mostGenerous: [{ $sort: { avgRating: -1 } }, { $limit: 5 }],
    } },
  ],
});

add("User Analysis", {
  title: "Distribution of ratings per user",
  purpose: "$bucket groups users into activity bands (20–49, 50–99, … ratings).",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$userId", ratings: { $sum: 1 } } },
    { $bucket: { groupBy: "$ratings", boundaries: [20, 50, 100, 200, 500, 1000, 3000], default: "3000+", output: { users: { $sum: 1 } } } },
  ],
  chart: { type: "bar", x: "_id", y: "users" },
});

add("User Analysis", {
  title: "Favourite genres of a specific user (userId 1)",
  purpose: "Personal taste profile: which genres does user 1 rate most often and most highly?",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $match: { userId: 1 } },
    { $lookup: { from: "movies", localField: "movieId", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $unwind: "$movie.genreList" },
    { $group: { _id: "$movie.genreList", rated: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $project: { rated: 1, avgRating: { $round: ["$avgRating", 2] } } },
    { $sort: { rated: -1 } },
    { $limit: 5 },
  ],
  chart: { type: "bar", x: "_id", y: "rated" },
});

add("User Analysis", {
  title: "Number of ratings submitted per year",
  purpose: "$year on the ratedAt date field shows activity on the platform from 1996 to 2018 (.toArray() prints all 23 years instead of the first 20 cursor results).",
  kind: "aggregate", collection: "ratings", all: true,
  pipeline: [
    { $group: { _id: { $year: "$ratedAt" }, ratings: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $project: { ratings: 1, avgRating: { $round: ["$avgRating", 2] } } },
    { $sort: { _id: 1 } },
  ],
  chart: { type: "line", x: "_id", y: "ratings" },
});

add("User Analysis", {
  title: "Ratings by day of the week",
  purpose: "$dayOfWeek (1 = Sunday … 7 = Saturday) reveals when users are most active.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: { $dayOfWeek: "$ratedAt" }, ratings: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, day: { $arrayElemAt: [["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "$_id"] }, ratings: 1 } },
  ],
  chart: { type: "bar", x: "day", y: "ratings" },
});

add("User Analysis", {
  title: "First and last rating date of the most active user",
  purpose: "$min/$max on dates give the active lifespan of user 414.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $match: { userId: 414 } },
    { $group: { _id: "$userId", firstRating: { $min: "$ratedAt" }, lastRating: { $max: "$ratedAt" }, total: { $sum: 1 } } },
  ],
});

/* ───────────────────────── 7. Tag Analysis ───────────────────────── */

add("Tag Analysis", {
  title: "Most frequently used tags",
  purpose: "$toLower normalises case before counting so 'Funny' and 'funny' merge.",
  kind: "aggregate", collection: "tags",
  pipeline: [
    { $group: { _id: { $toLower: "$tag" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ],
  chart: { type: "hbar", x: "_id", y: "count" },
});

add("Tag Analysis", {
  title: "All tags applied to Pulp Fiction",
  purpose: "$addToSet collects the unique tags for movieId 296; $slice shows the first 15 of them.",
  kind: "aggregate", collection: "tags",
  pipeline: [
    { $match: { movieId: 296 } },
    { $group: { _id: "$movieId", tags: { $addToSet: "$tag" }, taggers: { $addToSet: "$userId" } } },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $project: { _id: 0, title: { $first: "$movie.title" }, totalTags: { $size: "$tags" }, taggerCount: { $size: "$taggers" }, sampleTags: { $slice: ["$tags", 15] } } },
  ],
});

add("Tag Analysis", {
  title: "Most tagged movies",
  purpose: "Which films attract the most free-text annotation from users?",
  kind: "aggregate", collection: "tags",
  pipeline: [
    { $group: { _id: "$movieId", tagCount: { $sum: 1 } } },
    { $sort: { tagCount: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", tagCount: 1 } },
  ],
  chart: { type: "hbar", x: "title", y: "tagCount" },
});

add("Tag Analysis", {
  title: "Average rating of movies tagged 'funny'",
  purpose: "Combines tags and ratings through two $lookup stages to test whether comedies tagged funny are rated well.",
  kind: "aggregate", collection: "tags",
  pipeline: [
    { $match: { tag: { $regex: "^funny$", $options: "i" } } },
    { $group: { _id: "$movieId" } },
    { $lookup: { from: "ratings", localField: "_id", foreignField: "movieId", as: "r" } },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $project: { _id: 0, title: { $first: "$movie.title" }, ratings: { $size: "$r" }, avgRating: { $round: [{ $avg: "$r.rating" }, 2] } } },
    { $sort: { ratings: -1 } },
    { $limit: 5 },
  ],
});

add("Tag Analysis", {
  title: "Most active taggers",
  purpose: "Users grouped by number of tag applications; a handful of users generate most tags.",
  kind: "aggregate", collection: "tags",
  pipeline: [
    { $group: { _id: "$userId", tags: { $sum: 1 }, movies: { $addToSet: "$movieId" } } },
    { $project: { userId: "$_id", _id: 0, tags: 1, moviesTagged: { $size: "$movies" } } },
    { $sort: { tags: -1 } },
    { $limit: 5 },
  ],
  chart: { type: "bar", x: "userId", y: "tags" },
});

/* ───────────────────────── 8. Recommendation Queries ───────────────────────── */

add("Recommendation Queries", {
  title: "Content-based: movies most similar to Toy Story by genre overlap",
  purpose: "$setIntersection counts shared genres with Toy Story's genreList; ties are broken by average rating (min 20 ratings).",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $match: { movieId: { $ne: 1 } } },
    { $addFields: { sharedGenres: { $size: { $setIntersection: ["$genreList", ["Adventure", "Animation", "Children", "Comedy", "Fantasy"]] } } } },
    { $match: { sharedGenres: { $gte: 4 } } },
    { $lookup: { from: "ratings", localField: "movieId", foreignField: "movieId", as: "r" } },
    { $addFields: { ratingCount: { $size: "$r" }, avgRating: { $avg: "$r.rating" } } },
    { $match: { ratingCount: { $gte: 20 } } },
    { $sort: { sharedGenres: -1, avgRating: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, title: 1, sharedGenres: 1, ratingCount: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
  chart: { type: "hbar", x: "title", y: "avgRating" },
});

add("Recommendation Queries", {
  title: "Collaborative: 'users who liked The Matrix also liked…'",
  purpose: "Find users who gave The Matrix (movieId 2571) ≥ 4.5, then rank the other movies those users also rated ≥ 4.5.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $match: { movieId: 2571, rating: { $gte: 4.5 } } },
    { $group: { _id: null, fans: { $addToSet: "$userId" } } },
    { $lookup: { from: "ratings", let: { fans: "$fans" }, pipeline: [ { $match: { $expr: { $and: [{ $in: ["$userId", "$$fans"] }, { $gte: ["$rating", 4.5] }, { $ne: ["$movieId", 2571] }] } } }, { $group: { _id: "$movieId", fanCount: { $sum: 1 } } }, { $sort: { fanCount: -1 } }, { $limit: 5 } ], as: "alsoLiked" } },
    { $unwind: "$alsoLiked" },
    { $lookup: { from: "movies", localField: "alsoLiked._id", foreignField: "movieId", as: "movie" } },
    { $project: { _id: 0, title: { $first: "$movie.title" }, fansWhoLikedIt: "$alsoLiked.fanCount", totalMatrixFans: { $size: "$fans" } } },
  ],
  chart: { type: "hbar", x: "title", y: "fansWhoLikedIt" },
});

add("Recommendation Queries", {
  title: "Personalised recommendations for user 1",
  purpose: "Top weighted-rated Action/Adventure movies (user 1's favourite genres) that user 1 has NOT rated yet.",
  kind: "aggregate", collection: "movies",
  pipeline: [
    { $match: { genreList: { $all: ["Action", "Adventure"] } } },
    { $lookup: { from: "ratings", localField: "movieId", foreignField: "movieId", as: "r" } },
    { $match: { "r.userId": { $ne: 1 } } },
    { $addFields: { ratingCount: { $size: "$r" }, avgRating: { $avg: "$r.rating" } } },
    { $match: { ratingCount: { $gte: 50 } } },
    { $sort: { avgRating: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, title: 1, year: 1, ratingCount: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
  chart: { type: "hbar", x: "title", y: "avgRating" },
});

add("Recommendation Queries", {
  title: "Hidden gems: highly rated but rarely watched",
  purpose: "Movies averaging ≥ 4.3 with between 10 and 30 ratings – quality titles that never reached a mass audience.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
    { $match: { ratingCount: { $gte: 10, $lte: 30 }, avgRating: { $gte: 4.3 } } },
    { $sort: { avgRating: -1 } },
    { $limit: 5 },
    { $lookup: { from: "movies", localField: "_id", foreignField: "movieId", as: "movie" } },
    { $unwind: "$movie" },
    { $project: { _id: 0, title: "$movie.title", genres: "$movie.genres", ratingCount: 1, avgRating: { $round: ["$avgRating", 2] } } },
  ],
});

add("Recommendation Queries", {
  title: "Materialise per-movie statistics with $merge",
  purpose: "Pre-computes rating count, average and std-dev for every movie into a movie_stats collection so the dashboard can read it without re-aggregating 100k ratings.",
  kind: "raw",
  shell: `db.ratings.aggregate([
  {
    $group: {
      _id: "$movieId",
      ratingCount: { $sum: 1 },
      avgRating: { $avg: "$rating" },
      stdDev: { $stdDevPop: "$rating" }
    }
  },
  { $merge: { into: "movie_stats", whenMatched: "replace" } }
]);
db.movie_stats.find().sort({ ratingCount: -1 }).limit(5)`,
  run: async (db) => {
    await db.collection("ratings").aggregate([
      { $group: { _id: "$movieId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$rating" }, stdDev: { $stdDevPop: "$rating" } } },
      { $merge: { into: "movie_stats", whenMatched: "replace" } },
    ]).toArray();
    return db.collection("movie_stats").find().sort({ ratingCount: -1 }).limit(5).toArray();
  },
});

add("Recommendation Queries", {
  title: "Dashboard summary in a single $facet query",
  purpose: "One round-trip returns several independent aggregations – the pattern used by the CineMatch dashboard's overview page.",
  kind: "aggregate", collection: "ratings",
  pipeline: [
    { $facet: {
        overall: [{ $group: { _id: null, ratings: { $sum: 1 }, avg: { $avg: "$rating" } } }, { $project: { _id: 0, ratings: 1, avg: { $round: ["$avg", 2] } } }],
        topMovies: [{ $group: { _id: "$movieId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 3 }],
        topUsers: [{ $group: { _id: "$userId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 3 }],
        byStar: [{ $group: { _id: "$rating", n: { $sum: 1 } } }, { $sort: { _id: -1 } }],
    } },
  ],
});

/* ───────────────────────── 9. CRUD & Indexing ───────────────────────── */

add("CRUD & Index Performance", {
  title: "Insert a new movie document",
  purpose: "Demonstrates schema flexibility – the new document carries an extra 'source' field none of the imported documents have.",
  kind: "raw",
  shell: `db.movies.insertOne({
  movieId: 999999,
  title: "CineMatch Demo Film (2026)",
  genres: "Documentary|Sci-Fi",
  genreList: ["Documentary", "Sci-Fi"],
  year: 2026,
  source: "manual insert"
})`,
  run: async (db) => {
    await db.collection("movies").deleteOne({ movieId: 999999 });
    return db.collection("movies").insertOne({ movieId: 999999, title: "CineMatch Demo Film (2026)", genres: "Documentary|Sci-Fi", genreList: ["Documentary", "Sci-Fi"], year: 2026, source: "manual insert" });
  },
});

add("CRUD & Index Performance", {
  title: "Update the inserted document ($set and $push)",
  purpose: "Adds a genre to the array and a new field in one atomic update.",
  kind: "raw",
  shell: `db.movies.updateOne(
  { movieId: 999999 },
  { $push: { genreList: "Drama" }, $set: { genres: "Documentary|Sci-Fi|Drama", verified: true } }
);
db.movies.findOne({ movieId: 999999 })`,
  run: async (db) => {
    await db.collection("movies").updateOne({ movieId: 999999 }, { $push: { genreList: "Drama" }, $set: { genres: "Documentary|Sci-Fi|Drama", verified: true } });
    return db.collection("movies").findOne({ movieId: 999999 });
  },
});

add("CRUD & Index Performance", {
  title: "Delete the demo document",
  purpose: "Clean-up so the catalogue returns to its original 9,742 movies.",
  kind: "raw",
  shell: `db.movies.deleteOne({ movieId: 999999 });
db.movies.countDocuments()`,
  run: async (db) => {
    await db.collection("movies").deleteOne({ movieId: 999999 });
    return db.collection("movies").countDocuments();
  },
});

add("CRUD & Index Performance", {
  title: "Explain plan: index scan vs collection scan",
  purpose: "explain() shows the movieId query on ratings uses the IXSCAN created earlier and examines only the matching keys instead of all 100,836 documents.",
  kind: "raw",
  shell: `const plan = db.ratings.find({ movieId: 296 }).explain("executionStats");
({
  stage: plan.queryPlanner.winningPlan.stage,
  inputStage: plan.queryPlanner.winningPlan.inputStage?.stage,
  indexName: plan.queryPlanner.winningPlan.inputStage?.indexName,
  docsReturned: plan.executionStats.nReturned,
  docsExamined: plan.executionStats.totalDocsExamined,
  keysExamined: plan.executionStats.totalKeysExamined,
  executionTimeMs: plan.executionStats.executionTimeMillis
})`,
  run: async (db) => {
    const plan = await db.collection("ratings").find({ movieId: 296 }).explain("executionStats");
    const wp = plan.queryPlanner.winningPlan;
    return {
      stage: wp.stage, inputStage: wp.inputStage?.stage, indexName: wp.inputStage?.indexName,
      docsReturned: plan.executionStats.nReturned, docsExamined: plan.executionStats.totalDocsExamined,
      keysExamined: plan.executionStats.totalKeysExamined, executionTimeMs: plan.executionStats.executionTimeMillis,
    };
  },
});

module.exports = Q;
