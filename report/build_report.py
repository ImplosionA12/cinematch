"""Build the CineMatch case-study report (.docx) from results.json + rendered screenshots."""
import json, os
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
A = lambda *p: os.path.join(HERE, *p)

TEAM = [
    ("24MIC7198", "V. RUTHVIK"),
    ("24MIC7181", "K. TEJASH NARAYANA"),
    ("24MIC7203", "B. HARSHITH"),
]
GUIDE = "Dr. VASAVI SANIKOMMU"

results = {r["id"]: r for r in json.load(open(A("results.json"), encoding="utf8"))}

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(2.54)
sec.top_margin = sec.bottom_margin = Cm(2.54)

FONT = "Arial"
st = doc.styles["Normal"]
st.font.name = FONT
st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
st.paragraph_format.space_after = Pt(6)
for lvl, size in [(1, 16), (2, 13), (3, 11.5)]:
    h = doc.styles[f"Heading {lvl}"]
    h.font.name = FONT; h.font.size = Pt(size); h.font.bold = True
    h.font.color.rgb = None
    h.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True


def para(text="", bold=False, italic=False, size=None, align=None, after=None, style=None):
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    if text:
        r = p.add_run(text); r.bold = bold; r.italic = italic
        if size: r.font.size = Pt(size)
    if align == "center": p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if align == "justify": p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if after is not None: p.paragraph_format.space_after = Pt(after)
    return p


def numbered(items):
    for it in items:
        p = doc.add_paragraph(style="List Number"); p.add_run(it)
        p.paragraph_format.space_after = Pt(3)


def bullets(items):
    for it in items:
        p = doc.add_paragraph(style="List Bullet"); p.add_run(it)
        p.paragraph_format.space_after = Pt(3)


def code(text, size=9.5):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.left_indent = Cm(0.5)
    lines = text.split("\n")
    for i, l in enumerate(lines):
        r = p.add_run(l)
        r.font.name = "Courier New"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Courier New"); r.font.size = Pt(size)
        if i < len(lines) - 1: r.add_break()
    return p


def table(headers, rows, widths=None, font=10):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = ""
        r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(font)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            r = cells[i].paragraphs[0].add_run(str(v)); r.font.size = Pt(font)
            cells[i].paragraphs[0].paragraph_format.space_after = Pt(0)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def image(path, width_cm=15.9, caption=None):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path, width=Cm(width_cm))
    p.paragraph_format.space_after = Pt(4)
    if caption:
        para(caption, italic=True, size=10, align="center", after=10)


def page_break():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def H(text, lvl=1):
    return doc.add_heading(text, level=lvl)


# ───────────────────────── title page ─────────────────────────
para(after=30)
image(A("assets", "logo.png"), width_cm=13)
para(after=50)
para("CINEMATCH - MOVIE RECOMMENDATION AND", bold=True, size=18, align="center", after=4)
para("ANALYTICS SYSTEM", bold=True, size=18, align="center", after=24)
para("A NoSQL Database Case Study Using MongoDB", bold=True, size=14, align="center", after=80)

t = doc.add_table(rows=1, cols=2); t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, h in enumerate(["Registration Number", "Name"]):
    c = t.rows[0].cells[i]; c.text = ""; r = c.paragraphs[0].add_run(h); r.bold = True; c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for reg, name in TEAM:
    cells = t.add_row().cells
    for i, v in enumerate([reg, name]):
        cells[i].text = ""; r = cells[i].paragraphs[0].add_run(v); r.bold = True; cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for row in t.rows:
    row.cells[0].width = Cm(6); row.cells[1].width = Cm(8)
para(after=24)
para(f"Under The Guidance Of : {GUIDE}", bold=True, size=12, align="center", after=4)
para("School of Computer Science and Engineering (SCOPE)", size=11, align="center", after=2)
para("VIT-AP University, Amaravati", size=11, align="center")
page_break()

# ───────────────────────── problem statement ─────────────────────────
H("Problem Statement")
para("Movie streaming platforms collect a large number of ratings from their users. This rating data is useful to find out which movies are popular, which genres are liked by the users, how active the users are and what movies a user may like to watch next. The MovieLens dataset contains this kind of data in four separate CSV files (movies, ratings, tags and links). The genre information of a movie is stored as a single string separated by the pipe symbol, and the ratings of a movie are stored in a different file, so answering simple questions like \"what is the average rating of each genre\" needs the files to be combined and processed.", align="justify")
para("In this project we use MongoDB, a document based NoSQL database, to store the MovieLens data and analyse it. The data is imported as collections, cleaned inside MongoDB, and then analysed using find queries and aggregation pipelines. The project also builds a simple recommendation feature using the same queries and shows the results in a web application.", align="justify")

H("Aim")
para("The aim of this project is to store the MovieLens movie rating dataset in MongoDB and to analyse it using MongoDB queries and aggregation pipelines. The project focuses on finding information about movies, genres, ratings, users and tags, and on recommending movies to users using the rating data.", align="justify")

H("Objectives")
numbered([
    "To import the MovieLens CSV files into MongoDB as separate collections.",
    "To clean the imported data inside MongoDB (extract the release year, split the genres string into an array and convert timestamps to dates).",
    "To perform basic CRUD operations and queries using filters, projection, sorting, regular expressions and text search.",
    "To analyse the ratings: rating distribution, most rated movies, highest and lowest rated movies and most controversial movies.",
    "To analyse genres by joining the ratings and movies collections using $lookup and $unwind.",
    "To analyse users: most active users, harsh and generous users, and rating activity over the years.",
    "To analyse the tags given by users.",
    "To recommend movies using genre similarity, \"users who liked this also liked\" and weighted rating.",
    "To create indexes and check their effect using explain().",
    "To display the results in a web application connected to MongoDB.",
])

# ───────────────────────── dataset ─────────────────────────
H("Dataset Description")
para("The project uses the MovieLens \"ml-latest-small\" dataset published by GroupLens Research, University of Minnesota. The same dataset is available on Kaggle as \"Popular Movies Datasets - 9742 Movies\". It contains 100,836 ratings and 3,683 tags given by 610 users to 9,742 movies between 1996 and 2018. Every user has rated at least 20 movies. The dataset has four CSV files:", align="justify")
table(["File", "Rows", "Columns", "Description"], [
    ["movies.csv", "9,742", "movieId, title, genres", "Movie title with the release year in brackets and genres separated by |"],
    ["ratings.csv", "100,836", "userId, movieId, rating, timestamp", "Rating given by a user to a movie (0.5 to 5.0 stars) with Unix timestamp"],
    ["tags.csv", "3,683", "userId, movieId, tag, timestamp", "Free text tag given by a user to a movie"],
    ["links.csv", "9,742", "movieId, imdbId, tmdbId", "IMDb and TMDb ids of each movie"],
], widths=[2.6, 1.8, 4.6, 6.9])
para("Sample rows from the files:", bold=True)
code("""movies.csv
movieId,title,genres
1,Toy Story (1995),Adventure|Animation|Children|Comedy|Fantasy
2,Jumanji (1995),Adventure|Children|Fantasy

ratings.csv
userId,movieId,rating,timestamp
1,1,4.0,964982703
1,3,4.0,964981247

tags.csv
userId,movieId,tag,timestamp
2,60756,funny,1445714994

links.csv
movieId,imdbId,tmdbId
1,0114709,862""")

# ───────────────────────── why mongodb ─────────────────────────
H("Why MongoDB")
bullets([
    "A movie has many genres. In MongoDB this is stored as an array inside the movie document, so there is no need for a separate genre table and join.",
    "The data could be cleaned inside the database itself using updateMany with pipeline stages, without writing a separate program.",
    "The aggregation pipeline ($match, $group, $sort, $lookup, $unwind, $facet etc.) can answer complex questions in a single query.",
    "Ratings refer to movies through movieId (references), while genres are embedded in the movie document. Both NoSQL data modelling styles are used.",
    "Indexes on movieId, userId, the genre array and the title keep the queries fast, which was checked with explain().",
])

H("Technology Stack")
table(["Part", "Technology"], [
    ["Database", "MongoDB Community Server 8.3"],
    ["Database Shell", "mongosh"],
    ["Data Import", "Node.js script using csv-parse and the MongoDB Node.js driver"],
    ["Backend", "Node.js, Express"],
    ["Frontend", "React (Vite), Recharts"],
    ["Code Editor", "Visual Studio Code"],
], widths=[4.5, 11.4])

H("System Architecture")
code("""MovieLens CSV files (movies, ratings, tags, links)
        |
        v
Import script (Node.js)
        |
        v
MongoDB (cinematch database)
   movies, ratings, tags, links, movie_stats
        |
        +------------------------+
        |                        |
        v                        v
mongosh queries            Express backend (REST API)
(Queries and Results)            |
                                 v
                           React frontend (CineMatch web app)""", size=9.5)
para("The CSV files are imported into four collections. Cleaning queries add the year, genre array and date fields. The same queries are run in mongosh for this report and are also used by the Express backend, which sends the results to the React frontend.", align="justify")

# ───────────────────────── db design ─────────────────────────
H("MongoDB Database Design")
para("Database name: cinematch", bold=True)
table(["Collection", "Documents", "Description"], [
    ["movies", "9,742", "Movie details. Fields: movieId, title, genres, year, genreList"],
    ["ratings", "100,836", "Ratings given by users. Fields: userId, movieId, rating, timestamp, ratedAt"],
    ["tags", "3,683", "Tags given by users. Fields: userId, movieId, tag, timestamp, taggedAt"],
    ["links", "9,742", "IMDb and TMDb ids. Fields: movieId, imdbId, tmdbId"],
    ["movie_stats", "9,724", "Rating count, average and standard deviation of every movie (created with $merge)"],
], widths=[3, 2.2, 10.7])
para("year, genreList, ratedAt and taggedAt are new fields added by the cleaning queries.", italic=True, size=10)

para("Relationships", bold=True)
bullets([
    "ratings.movieId, tags.movieId and links.movieId refer to movies.movieId. They are joined using $lookup.",
    "movie_stats._id is the movieId of the movie.",
    "There is no users collection because the dataset does not have user details. User information is calculated from the ratings collection.",
])
para("Ratings are kept in a separate collection because a popular movie has hundreds of ratings and ratings are also queried by user and by date. Genres are embedded in the movie document as an array because they are small and always needed along with the movie.", align="justify")

para("Sample documents after cleaning", bold=True)
code("""movies
{
  _id: ObjectId('...'),
  movieId: 1,
  title: 'Toy Story (1995)',
  genres: 'Adventure|Animation|Children|Comedy|Fantasy',
  year: 1995,
  genreList: [ 'Adventure', 'Animation', 'Children', 'Comedy', 'Fantasy' ]
}

ratings
{ userId: 1, movieId: 1, rating: 4, timestamp: 964982703,
  ratedAt: ISODate('2000-07-30T18:45:03.000Z') }

tags
{ userId: 2, movieId: 60756, tag: 'funny', timestamp: 1445714994,
  taggedAt: ISODate('2015-10-24T19:29:54.000Z') }

movie_stats
{ _id: 356, ratingCount: 329, avgRating: 4.164, stdDev: 0.829 }""")

para("Indexes", bold=True)
table(["Collection", "Index", "Purpose"], [
    ["ratings", "{ movieId: 1 }", "Joining ratings with movies"],
    ["ratings", "{ userId: 1 }", "Queries by user"],
    ["tags", "{ movieId: 1 }", "Tags of a movie"],
    ["movies", "{ movieId: 1 } (unique)", "Primary lookup key"],
    ["movies", "{ genreList: 1 } (multikey)", "Filtering by genre"],
    ["movies", "{ year: 1 }", "Filtering by year"],
    ["movies", "{ title: 'text' }", "Text search on titles"],
], widths=[3, 5.5, 7.4])

# ───────────────────────── implementation ─────────────────────────
H("Implementation")
para("In this project we used MongoDB as the NoSQL database to store and analyse the MovieLens data. The four CSV files were imported into the cinematch database as separate collections using a Node.js import script, which works the same way as mongoimport with the --headerline option. After importing, the collections and sample documents were checked in mongosh.", align="justify")
para("The imported data was then cleaned inside MongoDB. The release year was taken out of the title using $regexFind, the genres string was split into an array using $split, titles ending with \", The\" were rewritten in the normal order, and the Unix timestamps were converted to dates using $toDate. Indexes were created on the fields used for joining and filtering.", align="justify")
para("After this, different MongoDB operations were used to analyse the data. Basic find queries with filters, projection, sorting, regular expressions and text search were used to look up movies. Aggregation pipelines with $group, $lookup, $unwind, $sort, $facet, $bucket and date operators were used to analyse ratings, genres, users and tags. Recommendation queries were written using $setIntersection (genre similarity), a $lookup on the fans of a movie (users who liked this also liked) and a weighted rating formula. $merge was used to store the per-movie statistics in a separate collection. Finally, CRUD operations and explain() were used to show insert, update, delete and the use of indexes.", align="justify")
para("All the queries were executed in mongosh and the output of each query is shown as a screenshot in the next section. The same queries are used by the backend of the CineMatch web application, which is shown at the end.", align="justify")

# ───────────────────────── queries ─────────────────────────
RESULT = {
    1: "The four collections created from the CSV files are listed (movie_stats is added later by Query 53).",
    2: "The document counts match the dataset: 9,742 movies, 100,836 ratings, 3,683 tags and 9,742 links.",
    3: "The genres of the movie are stored as a single string separated by the pipe symbol.",
    4: "rating and timestamp are stored as numbers. The timestamp is in Unix seconds.",
    5: "Tags are free text. imdbId is stored as a string so that the leading zero is kept.",
    6: "There are 610 users in the dataset.",
    7: "All 9,742 movie documents were updated with a numeric year field.",
    8: "genreList is now an array, so the genres can be filtered and unwound individually.",
    9: "All ratings and tags now have an ISODate field which can be used with $year and $dayOfWeek.",
    10: "1,822 titles were rewritten, for example 'Shawshank Redemption, The (1994)' became 'The Shawshank Redemption (1994)'.",
    11: "The Toy Story document now has year and genreList, and the title of movie 318 is in the normal order.",
    12: "The indexes on the movies collection are listed, including the multikey index on genreList and the text index on title.",
    13: "There are 259 movies released in 1995. Only the first 10 are shown.",
    14: "13 movies contain 'star wars' in the title. They are shown in order of year.",
    15: "Only movies having both Comedy and Romance in the genre array and released in 2015 or later are returned.",
    16: "34 movies have no genres listed.",
    17: "Drama (4,361) and Comedy (3,756) have the most movies. Film-Noir (87) has the least.",
    18: "The 1990s and 2000s have more than 2,000 movies each. Very few movies are before 1950.",
    19: "2002 has the most movies (311), followed by 2006 (295) and 2001 (294).",
    20: "Comedy|Drama (435), Comedy|Romance (363) and Drama|Romance (349) are the most common genre combinations.",
    21: "The text search returns the Lord of the Rings movies first, with their text score.",
    22: "4.0 is the most common rating (26,818 times), followed by 3.0 and 5.0. Whole star ratings are used more than half star ratings.",
    23: "The overall average rating is 3.50 with a standard deviation of 1.04.",
    24: "Toy Story has 215 ratings with an average of 3.92.",
    25: "Forrest Gump (329 ratings), The Shawshank Redemption (317) and Pulp Fiction (307) are the most rated movies.",
    26: "Among movies with at least 100 ratings, The Shawshank Redemption (4.43) has the highest average, followed by The Godfather (4.29) and Fight Club (4.27).",
    27: "Godzilla (1998) has the lowest average (1.95), followed by I Know What You Did Last Summer, Wild Wild West and Batman & Robin.",
    28: "The Blair Witch Project has the highest standard deviation (1.36), which means users strongly disagree about it.",
    29: "The Shawshank Redemption (153), Pulp Fiction (123) and Forrest Gump (116) have the most 5 star ratings.",
    30: "18 movies in the movies collection have no ratings at all.",
    31: "The weighted rating gives a balanced top 10 in which movies with very few ratings do not appear.",
    32: "Film-Noir (3.92), War (3.81) and Documentary (3.80) have the highest average rating. Horror (3.26) has the lowest.",
    33: "Drama (41,928 ratings) and Comedy (39,053) are the most watched genres.",
    34: "The best rated movie of each genre is shown, for example The Shawshank Redemption for Crime and Drama and Spirited Away for Animation.",
    35: "Drama has more movies than Comedy and Action in every decade. All three genres have the most movies in the 2000s.",
    36: "A movie has 2.27 genres on average and the maximum is 10.",
    37: "User 414 has given the most ratings (2,698), followed by user 599 (2,478) and user 474 (2,108).",
    38: "User 139 gives the lowest average rating (2.14) and user 452 gives the highest (4.56). Both lists are returned by one $facet query.",
    39: "Most users have between 20 and 99 ratings. Only 12 users have more than 1,000 ratings.",
    40: "User 1 has rated Action, Adventure and Comedy movies the most, and gives the highest average to Drama (4.53).",
    41: "The most ratings were given in the year 2000 (10,061), followed by 2007 and 2015.",
    42: "Monday has the most ratings (17,583) and Thursday has the least (10,706).",
    43: "User 414 gave ratings from June 2000 to June 2018.",
    44: "'in netflix queue' is the most used tag (131 times), followed by 'atmospheric'.",
    45: "Pulp Fiction has 173 different tags given by 4 users.",
    46: "Pulp Fiction (181) and Fight Club (54) are the most tagged movies.",
    47: "The movies tagged as funny are listed with their number of ratings and average rating. Pulp Fiction has the highest average (4.20).",
    48: "User 474 has given 1,507 tags, which is 41% of all the tags.",
    49: "Toy Story 3, Monsters Inc., The Lego Movie, Shrek and Toy Story 2 share all five genres with Toy Story and are recommended.",
    50: "Out of 150 users who gave The Matrix 4.5 or 5 stars, 75 also gave high ratings to The Shawshank Redemption and Fight Club.",
    51: "Action and Adventure movies that user 1 has not rated are recommended, such as North by Northwest and City of God.",
    52: "Movies with a high average but only 10 to 30 ratings are listed, such as Secrets & Lies (4.59) and Paths of Glory (4.54).",
    53: "Statistics of 9,724 movies were written to the movie_stats collection. The 5 most rated movies are shown.",
    54: "One $facet query returns the overall statistics, top movies, top users and rating distribution together.",
    55: "The new document was inserted even though it has an extra field (source) which other movies do not have.",
    56: "'Drama' was added to the genre array and the verified field was added using one updateOne.",
    57: "After deleting the demo document the movies collection has 9,742 documents again.",
    58: "The query uses the movieId index (IXSCAN). Only 307 documents were examined instead of all 100,836.",
}

groups = []
for r in results.values():
    if not groups or groups[-1][0] != r["group"]:
        groups.append((r["group"], []))
    groups[-1][1].append(r)

H("Queries and Results")
for gname, qs in groups:
    H(gname, 2)
    for r in qs:
        H(f"{r['id']}. {r['title']}", 3)
        para("Query:", bold=True, after=2).paragraph_format.keep_with_next = True
        code(r["shell"])
        para("Output:", bold=True, after=2).paragraph_format.keep_with_next = True
        import glob
        pages = sorted(glob.glob(A("shots", f"q{r['id']:02d}_*.png")), key=lambda f: int(f.rsplit("_", 1)[1].split(".")[0]))
        for shot in pages:
            w, h = Image.open(shot).size
            width_cm = 15.9
            if h / w * width_cm > 22.5:
                width_cm = 22.5 * w / h
            image(shot, width_cm=width_cm)
        p = para("", after=10)
        p.add_run("Result: ").bold = True
        p.add_run(RESULT.get(r["id"], ""))

# ───────────────────────── operators ─────────────────────────
H("MongoDB Operators Used")
table(["Operator", "Use in this project"], [
    ["find, findOne, countDocuments, distinct", "Reading documents, counting and unique values"],
    ["$regex, $text", "Pattern matching and text search on titles"],
    ["$all, $in, $ne, $gte, $lte, $size, $expr", "Filtering conditions on fields and arrays"],
    ["insertOne, updateOne, updateMany, deleteOne", "CRUD operations"],
    ["$set, $push", "Adding fields and array elements in updates"],
    ["$match", "Filters documents in the pipeline"],
    ["$group with $sum, $avg, $min, $max, $first, $addToSet, $stdDevPop", "Grouping and calculating values"],
    ["$sort, $limit, $count, $project, $addFields", "Sorting, limiting and shaping the output"],
    ["$lookup", "Joining information from another collection"],
    ["$unwind", "Expanding an array into separate documents"],
    ["$facet, $bucket", "Multiple results in one query, grouping into ranges"],
    ["$split, $regexFind, $concat, $toLower, $toInt, $toDate", "String and type conversion"],
    ["$year, $dayOfWeek", "Date parts"],
    ["$setIntersection, $arrayElemAt, $slice", "Array operations"],
    ["$merge", "Writing pipeline results into a collection"],
    ["createIndex, getIndexes, explain", "Indexing"],
], widths=[7.5, 8.4])

# ───────────────────────── web app ─────────────────────────
H("CineMatch Web Application")
para("A web application was developed so that the analysis can be viewed without opening mongosh. The backend is written in Node.js with Express and connects to MongoDB using the official driver. It has API endpoints for the overview statistics, movie search, movie details with recommendations, genre analysis, user profiles and for running any of the queries above. The frontend is written in React and shows the results as tables and charts.", align="justify")
table(["Endpoint", "Description"], [
    ["GET /api/overview", "Counts, rating distribution, ratings per year, genre statistics, top movies"],
    ["GET /api/movies", "Search movies by title, genre and sort order"],
    ["GET /api/movies/:id", "Movie details, rating breakdown, tags and recommendations"],
    ["GET /api/genres/:genre", "Movies per decade and top movies of a genre"],
    ["GET /api/users/:id", "User profile, favourite genres and recommended movies"],
    ["GET /api/queries/:id/run", "Runs one of the queries of this report"],
], widths=[5.5, 10.4])
for name, cap in [
    ("ui_overview", "Overview page"),
    ("ui_explore", "Explore page - highest rated movies with at least 100 ratings"),
    ("ui_movie", "Movie page of The Matrix with recommendations"),
    ("ui_genres", "Genre analysis page"),
    ("ui_user", "User profile page of user 414 with recommendations"),
    ("ui_lab", "Query page running Query 50"),
]:
    w, h = Image.open(A("assets", f"{name}.png")).size
    image(A("assets", f"{name}.png"), width_cm=min(15.9, 21 * w / h), caption=cap)

# ───────────────────────── conclusion ─────────────────────────
H("Conclusion")
para("This project helped us understand how MongoDB can be used to store and analyse movie rating data. The MovieLens data was imported into collections, cleaned inside the database and analysed using find queries and aggregation pipelines. We were able to find the most popular and highest rated movies, the average rating of each genre, the most active users, the most used tags and the rating activity over the years. Using $lookup, $unwind, $facet, $bucket and $merge we could answer questions that need data from more than one collection.", align="justify")
para("We also learnt how recommendations can be made using only database queries, by comparing genres, by finding the other movies liked by the fans of a movie and by using a weighted rating. Creating indexes and checking the query plan with explain() showed how indexes make the queries faster. Finally, connecting MongoDB to a web application showed how the same queries can be used in a real application.", align="justify")

H("References")
numbered([
    "MongoDB Documentation - MongoDB Manual. https://www.mongodb.com/docs/manual/",
    "MongoDB Aggregation - MongoDB Documentation. https://www.mongodb.com/docs/manual/aggregation/",
    "MongoDB Query and Aggregation Operators. https://www.mongodb.com/docs/manual/reference/operator/",
    "MongoDB Indexes. https://www.mongodb.com/docs/manual/indexes/",
    "MongoDB Shell (mongosh) Documentation. https://www.mongodb.com/docs/mongodb-shell/",
    "MongoDB Node.js Driver. https://www.mongodb.com/docs/drivers/node/current/",
    "GroupLens Research - MovieLens Latest Datasets. https://grouplens.org/datasets/movielens/latest/",
    "Kaggle - Popular Movies Datasets (9742 Movies). https://www.kaggle.com/datasets/whenamancodes/popular-movies-datasets-9000-movies",
    "F. Maxwell Harper and Joseph A. Konstan. The MovieLens Datasets: History and Context. ACM Transactions on Interactive Intelligent Systems, 2015.",
    "Express.js Documentation. https://expressjs.com/",
    "React Documentation. https://react.dev/",
])

out = A("CineMatch_NoSQL_Case_Study_Report.docx")
doc.save(out)
print("saved", out)
