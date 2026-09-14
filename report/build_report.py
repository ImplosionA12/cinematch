"""Build the CineMatch case-study report (.docx) from results.json + rendered screenshots."""
import json, os, re
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
A = lambda *p: os.path.join(HERE, *p)

TEAM = [
    ("24MIC7198", "V. RUTHVIK"),
    ("24MIC7181", "K. TEJASH NARAYANA"),
    ("24MIC7203", "B. HARSHITH"),
]
GUIDE = "Dr. VASAVI SANIKOMMU"

results = {r["id"]: r for r in json.load(open(A("results.json"), encoding="utf8"))}

# ───────────────────────── helpers ─────────────────────────
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(2.2)
sec.top_margin = sec.bottom_margin = Cm(2.0)

st = doc.styles["Normal"]
st.font.name = "Calibri"
st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.15
for lvl, size in [(1, 18), (2, 14), (3, 12)]:
    h = doc.styles[f"Heading {lvl}"]
    h.font.name = "Calibri"; h.font.size = Pt(size); h.font.bold = True
    h.font.color.rgb = RGBColor(0x1F, 0x1F, 0x1F)
    h.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    h.paragraph_format.space_before = Pt(14 if lvl == 1 else 10)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True


def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def para(text="", bold=False, italic=False, size=None, align=None, after=None, color=None, style=None):
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    if text:
        r = p.add_run(text); r.bold = bold; r.italic = italic
        if size: r.font.size = Pt(size)
        if color: r.font.color.rgb = RGBColor(*color)
    if align == "center": p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if align == "justify": p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if after is not None: p.paragraph_format.space_after = Pt(after)
    return p


def rich(parts, align="justify", style=None):
    """parts: list of str | (str, {'b':1,'i':1,'code':1})"""
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    for part in parts:
        if isinstance(part, str):
            p.add_run(part)
        else:
            t, f = part
            r = p.add_run(t)
            if f.get("b"): r.bold = True
            if f.get("i"): r.italic = True
            if f.get("code"):
                r.font.name = "Consolas"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas"); r.font.size = Pt(10)
    if align == "justify": p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return p


def bullets(items, style="List Bullet"):
    for it in items:
        if isinstance(it, str):
            p = doc.add_paragraph(style=style); p.add_run(it)
        else:
            rich(it, align=None, style=style)
        p = doc.paragraphs[-1]; p.paragraph_format.space_after = Pt(3)


def numbered(items):
    bullets(items, style="List Number")


def code(text, size=9):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.left_indent = Cm(0.3)
    lines = text.split("\n")
    for i, l in enumerate(lines):
        r = p.add_run(l)
        r.font.name = "Consolas"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas"); r.font.size = Pt(size)
        if i < len(lines) - 1: r.add_break()
    return p


def table(headers, rows, widths=None, header_fill=None, font=10, zebra=False):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = ""
        r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(font)

    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            if isinstance(v, tuple):
                r = p.add_run(v[0]); r.font.name = "Consolas"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas"); r.font.size = Pt(font - 0.5)
            else:
                r = p.add_run(str(v)); r.font.size = Pt(font)
            p.paragraph_format.space_after = Pt(0)
            if zebra and ri % 2 == 1: shade(cells[i], "F6F2F2")
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def image(path, width_cm=16.0, caption=None):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path, width=Cm(width_cm))
    p.paragraph_format.space_after = Pt(2)
    if caption:
        para(caption, italic=True, size=10, align="center", after=10)


def page_break():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def H(text, lvl=1):
    return doc.add_heading(text, level=lvl)


# ───────────────────────── title page ─────────────────────────
para(after=20)
image(A("assets", "logo.png"), width_cm=13.5)
para(after=40)
para("CINEMATCH", bold=True, size=26, align="center", after=4)
para("MOVIE RECOMMENDATION AND ANALYTICS SYSTEM", bold=True, size=16, align="center", after=18)
para("A NoSQL Database Case Study Using MongoDB", bold=True, size=14, align="center", after=6)
para("Query, Aggregation and Recommendation Analysis of the MovieLens Dataset", italic=True, size=11, align="center", after=60)

t = doc.add_table(rows=1, cols=2); t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, h in enumerate(["Registration Number", "Name"]):
    c = t.rows[0].cells[i]; c.text = ""; r = c.paragraphs[0].add_run(h); r.bold = True; c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for reg, name in TEAM:
    cells = t.add_row().cells
    for i, v in enumerate([reg, name]):
        cells[i].text = ""; r = cells[i].paragraphs[0].add_run(v); r.bold = True; cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for row in t.rows:
    row.cells[0].width = Cm(6); row.cells[1].width = Cm(8)
para(after=30)
para(f"Under The Guidance Of : {GUIDE}", bold=True, size=12, align="center", after=4)
para("School of Computer Science and Engineering (SCOPE)", size=11, align="center", after=2)
para("VIT-AP University, Amaravati, Andhra Pradesh – 522241", size=11, align="center", after=2)
para("Course: NoSQL Databases", size=11, align="center")
page_break()

# ───────────────────────── abstract ─────────────────────────
H("Abstract")
rich(["This case study presents ", ("CineMatch", {"b": 1}), ", a movie recommendation and analytics system built on MongoDB. The publicly available MovieLens ",
      ("ml-latest-small", {"i": 1}), " dataset – 100,836 ratings and 3,683 tags applied to 9,742 movies by 610 users – was imported into a MongoDB database named ",
      ("cinematch", {"code": 1}), " as four collections (movies, ratings, tags, links). The raw CSV data was then cleaned and enriched inside MongoDB itself using pipeline-style updates: titles with a trailing article were normalised, the release year was extracted from the title with ",
      ("$regexFind", {"code": 1}), ", the pipe-delimited genre string was split into an array with ", ("$split", {"code": 1}), ", and Unix timestamps were converted to ISODate values."])
rich(["A catalogue of 58 queries was executed in mongosh, progressing from basic CRUD, filtering and projection to advanced aggregation pipelines that use ",
      ("$lookup", {"code": 1}), " (joins), ", ("$unwind", {"code": 1}), ", ", ("$group", {"code": 1}), ", ", ("$facet", {"code": 1}), ", ", ("$bucket", {"code": 1}), ", ",
      ("$setIntersection", {"code": 1}), ", ", ("$stdDevPop", {"code": 1}), " and ", ("$merge", {"code": 1}),
      ". The analysis covers movie and genre statistics, rating distributions, user behaviour over time, tag analysis, and three recommendation techniques – content-based (genre overlap), collaborative (\"users who liked X also liked\"), and a Bayesian weighted rating that balances quality with popularity. Indexes (single-field, unique, multikey and text) were created and their effect verified with ",
      ("explain()", {"code": 1}), ". Finally, a web dashboard (Node.js + Express + React) exposes the same pipelines through a REST API so that the results can be explored interactively."])

# ───────────────────────── introduction ─────────────────────────
H("1. Introduction")
para("Online streaming platforms and movie databases generate enormous amounts of user-interaction data: every rating, every tag and every search is an event that can be analysed to understand audience taste and to recommend what a user should watch next. Such data is semi-structured, grows continuously, and is accessed mostly through analytical questions (\"what are the highest-rated crime films of the 1990s?\", \"what do fans of The Matrix also enjoy?\") rather than through rigid transactional updates.", align="justify")
para("Document-oriented NoSQL databases such as MongoDB are well suited to this workload. Documents map naturally to the JSON records produced by applications, related data can be either embedded or referenced, and the aggregation framework allows complex multi-stage analysis to be performed inside the database without exporting the data to another tool. This case study uses MongoDB to store the MovieLens dataset and answers a wide range of analytical and recommendation questions using only queries and aggregation pipelines.", align="justify")

# ───────────────────────── problem statement ─────────────────────────
H("2. Problem Statement")
para("Movie rating data is spread across several related files (movies, ratings, tags, links) that use different structures: a movie has a title and a multi-valued genre field, a rating links a user to a movie with a score and a timestamp, and a tag is free text. Viewers and platform operators want answers to questions that require combining these files – the average rating of each genre, the most controversial movies, the most active users, and, most importantly, which unseen movies a particular user is likely to enjoy.", align="justify")
para("Answering such questions with a relational schema requires many joins and normalisation of the multi-valued genre field. The challenge addressed in this case study is to model the MovieLens data in a NoSQL document database, clean and enrich it in place, and use MongoDB's query and aggregation capabilities to produce descriptive analytics and recommendation results efficiently, verifying performance with indexes and execution plans.", align="justify")

H("3. Aim")
para("The aim of this project is to design a MongoDB database for movie rating data and to demonstrate, through a comprehensive set of queries and aggregation pipelines, how a document-oriented NoSQL database can be used to analyse user ratings, genres, tags and viewing behaviour, and to generate movie recommendations for users – supported by a web dashboard that presents the results interactively.", align="justify")

H("4. Objectives")
numbered([
    "To import the MovieLens CSV dataset into MongoDB as separate collections and verify the import.",
    "To clean and enrich the data inside MongoDB using pipeline-style updateMany operations ($regexFind, $concat, $split, $toDate).",
    "To perform CRUD operations and basic queries using filtering, projection, sorting, regular expressions and text search.",
    "To analyse rating behaviour: distribution of star values, overall statistics, most-rated, highest-rated, lowest-rated and most controversial movies.",
    "To analyse genres by joining ratings with movies ($lookup) and unwinding the genre array ($unwind).",
    "To analyse users: most active users, harsh vs. generous critics ($facet), activity bands ($bucket), and rating activity over time.",
    "To analyse the free-text tags applied by users.",
    "To implement three recommendation approaches in pure MongoDB: content-based genre similarity, collaborative filtering and Bayesian weighted rating.",
    "To create appropriate indexes (single, unique, multikey, text) and verify their effect with explain().",
    "To materialise pre-computed statistics with $merge and expose the analysis through a REST API and an interactive web dashboard.",
])

# ───────────────────────── dataset ─────────────────────────
H("5. Dataset Description")
rich(["The project uses the ", ("MovieLens ml-latest-small", {"b": 1}), " dataset published by GroupLens Research (University of Minnesota) and mirrored on Kaggle as ",
      ("\"Popular Movies Datasets – 9742 Movies\"", {"i": 1}), ". It describes 5-star rating and free-text tagging activity from the MovieLens recommendation service between 29 March 1996 and 24 September 2018. Users were selected at random and every user has rated at least 20 movies; no demographic information is included."])
table(["File", "Rows", "Columns", "Description"], [
    [("movies.csv",), "9,742", ("movieId, title, genres",), "One row per movie. The title ends with the release year in parentheses; genres is a pipe-separated list, e.g. Comedy|Drama|Romance."],
    [("ratings.csv",), "100,836", ("userId, movieId, rating, timestamp",), "One row per rating on a 5-star scale with half-star increments (0.5 – 5.0). timestamp is seconds since the Unix epoch."],
    [("tags.csv",), "3,683", ("userId, movieId, tag, timestamp",), "User-generated free-text labels applied to movies."],
    [("links.csv",), "9,742", ("movieId, imdbId, tmdbId",), "Identifiers that link each movie to IMDb and The Movie Database."],
], widths=[2.6, 1.6, 4.6, 7.8])
table(["Statistic", "Value"], [
    ["Movies", "9,742"], ["Ratings", "100,836"], ["Tag applications", "3,683"], ["Users", "610 (each with ≥ 20 ratings)"],
    ["Distinct genres", "20 (including '(no genres listed)')"], ["Rating scale", "0.5 to 5.0 in steps of 0.5"], ["Time span", "1996 – 2018"],
    ["Release years covered", "1902 – 2018"],
], widths=[6, 10.6])
para("Sample rows from the CSV files:", bold=True)
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
2,60756,Highly quotable,1445714996

links.csv
movieId,imdbId,tmdbId
1,0114709,862""")

# ───────────────────────── why nosql ─────────────────────────
H("6. Why NoSQL / MongoDB for this Problem")
bullets([
    [("Flexible document model: ", {"b": 1}), "a movie's genres are a multi-valued attribute. In a relational design this needs a separate movie_genres table and a join; in MongoDB it is simply an array field (genreList) inside the movie document, and a multikey index makes it queryable."],
    [("In-place enrichment: ", {"b": 1}), "pipeline-style updates allowed the year, genre array and ISODate fields to be derived from the raw CSV columns inside the database, without an external ETL tool."],
    [("Aggregation framework: ", {"b": 1}), "multi-stage pipelines ($match → $group → $sort → $lookup → $project) express complex analytics such as \"best movie per genre\" or \"users who liked X also liked\" in a single query."],
    [("References and embedding: ", {"b": 1}), "ratings reference movies by movieId (a 100k-row fact collection should not be embedded), while derived statistics are materialised into a separate movie_stats collection with $merge – demonstrating both patterns."],
    [("Rich operator set: ", {"b": 1}), "$stdDevPop, $setIntersection, $facet, $bucket, $regexFind and text search cover statistical, set-based, multi-view, histogram, string and search requirements without additional software."],
    [("Scalability: ", {"b": 1}), "the same design would scale horizontally through sharding on movieId/userId when the full 33-million-rating MovieLens dataset is used."],
])

# ───────────────────────── tech stack ─────────────────────────
H("7. Technology Stack")
table(["Component", "Technology"], [
    ["Database", "MongoDB Community Server 8.3"], ["Shell", "mongosh 2.x (all queries in Section 11 were executed here)"],
    ["Data import", "Node.js import script (csv-parse + MongoDB Node driver) – equivalent to mongoimport --type csv --headerline"],
    ["Backend API", "Node.js 24, Express 5, MongoDB Node driver 6"], ["Frontend", "React 19 (Vite), React Router, Recharts"],
    ["Report screenshots", "mongosh output captured from the terminal"], ["Operating system", "Windows 11"],
], widths=[4.5, 12.1])

# ───────────────────────── architecture ─────────────────────────
H("8. System Architecture")
code("""MovieLens CSV files (movies, ratings, tags, links)
        │
        ▼
Import script  (csv-parse → MongoDB Node driver)   ≈ mongoimport
        │
        ▼
MongoDB  database: cinematch
   ├── movies        (9,742)   ← enriched with year, genreList
   ├── ratings     (100,836)   ← enriched with ratedAt
   ├── tags          (3,683)   ← enriched with taggedAt
   ├── links         (9,742)
   └── movie_stats   (9,724)   ← materialised with $merge
        │                                   │
        ▼                                   ▼
mongosh (58 queries, Section 11)     Express REST API (/api/…)
                                            │
                                            ▼
                                  React dashboard (CineMatch)
                       Overview · Explore · Genres · Users · Query Lab""", size=9)
para("The CSV files are imported as-is into four collections. Cleaning queries (Section 11.2) enrich the documents in place. The same aggregation pipelines are then executed in two ways: interactively in mongosh for this report, and through an Express API that powers the React dashboard (Section 14).", align="justify")

# ───────────────────────── db design ─────────────────────────
H("9. MongoDB Database Design")
H("9.1 Collections", 2)
table(["Collection", "Documents", "Purpose", "Key fields"], [
    [("movies",), "9,742", "Movie catalogue", ("movieId, title, genres, year*, genreList*",)],
    [("ratings",), "100,836", "User ratings (fact collection)", ("userId, movieId, rating, timestamp, ratedAt*",)],
    [("tags",), "3,683", "Free-text tags", ("userId, movieId, tag, timestamp, taggedAt*",)],
    [("links",), "9,742", "External identifiers", ("movieId, imdbId, tmdbId",)],
    [("movie_stats",), "9,724", "Materialised per-movie statistics", ("_id (movieId), ratingCount, avgRating, stdDev",)],
], widths=[2.6, 2.0, 5.0, 7.0])
para("* fields added by the enrichment queries in Section 11.2.", italic=True, size=9)

H("9.2 Data Model", 2)
para("movies", bold=True)
table(["Field", "Type", "Description"], [
    [("_id",), "ObjectId", "Generated by MongoDB"], [("movieId",), "Number", "Unique movie identifier (referenced by ratings, tags, links)"],
    [("title",), "String", "Title with release year, e.g. \"Toy Story (1995)\""], [("genres",), "String", "Original pipe-delimited genre string"],
    [("year",), "Number", "Release year extracted from title (null if absent)"], [("genreList",), "Array<String>", "genres split into an array – multikey indexed"],
], widths=[3, 3, 10.6])
para("ratings", bold=True)
table(["Field", "Type", "Description"], [
    [("userId",), "Number", "Anonymous user identifier"], [("movieId",), "Number", "Reference to movies.movieId"],
    [("rating",), "Number", "0.5 – 5.0"], [("timestamp",), "Number", "Unix epoch seconds (original)"], [("ratedAt",), "Date", "ISODate derived from timestamp"],
], widths=[3, 3, 10.6])
para("tags", bold=True)
table(["Field", "Type", "Description"], [
    [("userId",), "Number", "User who applied the tag"], [("movieId",), "Number", "Reference to movies.movieId"],
    [("tag",), "String", "Free text, e.g. \"funny\", \"Tarantino\""], [("timestamp",), "Number", "Unix epoch seconds"], [("taggedAt",), "Date", "ISODate derived from timestamp"],
], widths=[3, 3, 10.6])
para("links", bold=True)
table(["Field", "Type", "Description"], [
    [("movieId",), "Number", "Reference to movies.movieId"], [("imdbId",), "String", "IMDb id (kept as string to preserve leading zeros)"], [("tmdbId",), "Number", "TMDb id (absent for a few movies)"],
], widths=[3, 3, 10.6])

H("9.3 Relationships", 2)
bullets([
    [("ratings.movieId → movies.movieId", {"code": 1}), "  (many-to-one, joined with $lookup)"],
    [("tags.movieId → movies.movieId", {"code": 1}), "  (many-to-one)"],
    [("links.movieId → movies.movieId", {"code": 1}), "  (one-to-one)"],
    [("movie_stats._id → movies.movieId", {"code": 1}), "  (one-to-one, materialised by $merge)"],
    [("ratings.userId / tags.userId", {"code": 1}), "  identify users; there is no separate users collection because the dataset contains no user attributes – user profiles are derived by aggregation."],
])
para("References were preferred over embedding for ratings because a popular movie has hundreds of ratings and the ratings collection is queried independently (by user, by time). Genres, in contrast, are embedded as an array because they are small, bounded and always read together with the movie.", align="justify")

H("9.4 Sample Documents (after enrichment)", 2)
code("""// movies
{
  _id: ObjectId('...'),
  movieId: 1,
  title: 'Toy Story (1995)',
  genres: 'Adventure|Animation|Children|Comedy|Fantasy',
  year: 1995,
  genreList: [ 'Adventure', 'Animation', 'Children', 'Comedy', 'Fantasy' ]
}

// ratings
{ userId: 1, movieId: 1, rating: 4, timestamp: 964982703, ratedAt: ISODate('2000-07-30T18:45:03.000Z') }

// tags
{ userId: 2, movieId: 60756, tag: 'funny', timestamp: 1445714994, taggedAt: ISODate('2015-10-24T19:29:54.000Z') }

// movie_stats  (materialised)
{ _id: 356, ratingCount: 329, avgRating: 4.164, stdDev: 0.905 }""")

H("9.5 Indexes", 2)
table(["Collection", "Index", "Type", "Purpose"], [
    ["ratings", ("{ movieId: 1 }",), "Single field", "$lookup from movies, per-movie statistics"],
    ["ratings", ("{ userId: 1 }",), "Single field", "User profiles and collaborative filtering"],
    ["tags", ("{ movieId: 1 }",), "Single field", "Tags of a movie"],
    ["movies", ("{ movieId: 1 }, unique",), "Unique", "Primary lookup key; prevents duplicate movies"],
    ["movies", ("{ genreList: 1 }",), "Multikey", "Genre filters ($in, $all) on the array"],
    ["movies", ("{ year: 1 }",), "Single field", "Year / decade filters"],
    ["movies", ("{ title: 'text' }",), "Text", "Keyword search with $text"],
], widths=[2.4, 4.8, 2.6, 6.8])

# ───────────────────────── methodology ─────────────────────────
H("10. Methodology / Implementation")
numbered([
    [("Data acquisition – ", {"b": 1}), "the ml-latest-small archive was downloaded and the four CSV files were verified (row counts and headers)."],
    [("Import – ", {"b": 1}), "each CSV was loaded into its own collection in the cinematch database with numeric columns typed as numbers (equivalent to mongoimport --type csv --headerline)."],
    [("Verification – ", {"b": 1}), "collection names, document counts and sample documents were checked in mongosh (Queries 1–6)."],
    [("Cleaning & enrichment – ", {"b": 1}), "year, genreList, ratedAt and taggedAt were derived with updateMany pipelines (Queries 7–11)."],
    [("Indexing – ", {"b": 1}), "seven indexes were created on join keys, the genre array and the title (Query 12)."],
    [("Querying – ", {"b": 1}), "basic find/countDocuments/distinct queries with filtering, projection, regex and text search (Queries 13–21)."],
    [("Aggregation – ", {"b": 1}), "rating, genre, user and tag analytics with $group, $lookup, $unwind, $facet, $bucket and date operators (Queries 22–48)."],
    [("Recommendation – ", {"b": 1}), "content-based, collaborative and weighted-rating pipelines, plus $merge to materialise movie_stats (Queries 49–54)."],
    [("CRUD & performance – ", {"b": 1}), "insert/update/delete demonstration and explain() verification of index usage (Queries 55–58)."],
    [("Dashboard – ", {"b": 1}), "the pipelines were wrapped in an Express REST API and visualised in a React application (Section 14)."],
])
para("Every query below was executed in mongosh against the live database; the screenshot under each query is its actual output. Long cursor outputs are truncated in the screenshot where indicated.", italic=True, align="justify")

# ───────────────────────── queries ─────────────────────────
INSIGHT = {
    1: "The four CSV files are present as four collections (movie_stats is added later by Query 53).",
    2: "Document counts match the dataset description exactly: 9,742 movies, 100,836 ratings, 3,683 tags and 9,742 links – the import lost no rows.",
    3: "The raw movie document shows genres as a single pipe-delimited string, which motivates the $split enrichment in Query 8.",
    4: "rating and timestamp were imported as numbers; the timestamp (964982703) is Unix epoch seconds and is converted to a Date in Query 9.",
    5: "Tags are free text with arbitrary casing; imdbId is stored as a string to preserve its leading zero.",
    6: "610 distinct users produced the 100,836 ratings – an average of about 165 ratings per user.",
    7: "All 9,742 movie documents were updated; the year is now a numeric field that can be filtered, sorted and bucketed.",
    8: "genreList is now an array, so a movie with three genres can be matched on any one of them and unwound for per-genre statistics.",
    9: "100,836 ratings and 3,683 tags now carry a proper ISODate, enabling $year, $dayOfWeek and date range queries.",
    10: "1,822 titles matched the pattern and were rewritten – e.g. 'Shawshank Redemption, The (1994)' is now 'The Shawshank Redemption (1994)'. All later results use the readable form.",
    11: "Toy Story now has year: 1995 and a five-element genreList, and movieId 318 shows the normalised title – schema evolution without any migration script.",
    12: "Seven indexes exist on the movies collection alone (including the default _id index); the multikey index on genreList and the text index on title are used by later queries.",
    13: "1995 has 259 movies in the catalogue; the projection returns only movieId, title and genres and .limit(10) keeps the output short.",
    14: "The case-insensitive regex returns all 13 titles containing 'star wars' in chronological order – the nine saga films plus spin-offs such as Rogue One, Solo and the Holiday Special.",
    15: "$all requires both genres to be present in the array; the query returns recent romantic comedies only.",
    16: "34 movies carry the placeholder '(no genres listed)'; they are excluded from genre analytics.",
    17: "Drama (4,361) and Comedy (3,756) dominate the catalogue, followed by Thriller, Action and Romance; Film-Noir (87) is the rarest genre.",
    18: "The 1990s and 2000s each contain over 2,000 movies; the catalogue thins rapidly before 1950 and after 2015 (dataset generated in 2018).",
    19: "2002 (311 movies) and 2006 (295) are the most represented years, followed by 2001, 2007 and 2000.",
    20: "Comedy|Drama, Comedy|Romance and Drama|Romance are the most frequent multi-genre combinations – romantic comedies and dramedies dominate the catalogue.",
    21: "The text index ranks the Lord of the Rings trilogy first; textScore reflects term frequency in the title.",
    22: "4.0 is by far the most common rating (26,818), followed by 3.0 and 5.0. Whole-star values are used far more than half-stars, showing users round their opinions.",
    23: "The global mean is 3.50 with a standard deviation of 1.04; this value of 3.5 is used as the prior C in the weighted-rating formula (Query 31).",
    24: "Toy Story has 215 ratings with an average of 3.92 – a well-liked and widely watched film.",
    25: "Forrest Gump (329 ratings), The Shawshank Redemption (317) and Pulp Fiction (307) are the most-rated movies – 1990s classics dominate popularity.",
    26: "With a 100-rating minimum, The Shawshank Redemption (4.43) leads, followed by The Godfather (4.29) and Fight Club (4.27) – the list closely mirrors the IMDb Top 250.",
    27: "Widely watched but poorly received: Godzilla (1998) averages 1.95, followed by I Know What You Did Last Summer, Wild Wild West and Batman & Robin – all below 2.3.",
    28: "The Blair Witch Project (σ 1.36, mean 2.8) is the most divisive film, followed by First Knight and Austin Powers – audiences split between loving and hating them; the average alone hides this disagreement.",
    29: "Shawshank Redemption, Pulp Fiction and Forrest Gump have the most perfect scores, combining popularity with quality.",
    30: "18 catalogue entries have never been rated – the anti-join pattern ($lookup then $match on an empty array) finds orphan documents.",
    31: "The Bayesian formula shrinks averages of movies with few votes towards 3.5, so the top-10 contains only films that are both popular and highly rated – the basis of the dashboard's recommendations.",
    32: "Film-Noir (3.92), War (3.81) and Documentary (3.80) receive the highest average ratings; Horror (3.26), Comedy (3.39) and Children (3.41) the lowest – niche genres attract enthusiasts, mass genres attract critics.",
    33: "By volume, Drama (41,928 ratings) and Comedy (39,053) are the most watched genres, even though they are not the highest rated.",
    34: "Each genre's best film (min 50 ratings): The Shawshank Redemption for Crime/Drama, Fight Club for Action/Thriller, Spirited Away for Animation, Rear Window for Mystery, Casablanca for Romance and Chinatown for Film-Noir.",
    35: "Drama out-produced Comedy and Action in every decade; all three peaked in the 2000s, reflecting catalogue growth rather than a change in taste.",
    36: "Movies carry on average 2.27 genres; the maximum is 10 (a single title tagged with almost every genre).",
    37: "User 414 rated 2,698 movies, followed by users 599 (2,478) and 474 (2,108) – a handful of super-users contribute a large share of all ratings.",
    38: "$facet returns both lists in one query: user 139 averages only 2.14 stars across 194 ratings while user 452 averages 4.56 – rating scales are highly subjective, which is why per-user normalisation matters in recommenders.",
    39: "225 users have 20–49 ratings and 137 have 50–99; only 12 users exceed 1,000 ratings – a classic long-tail activity distribution.",
    40: "User 1's most-rated genres are Action, Adventure and Comedy, with Drama rated highest (4.53) – this profile drives the personalised recommendations in Query 51.",
    41: "Rating activity peaks in 2000 (10,061 ratings), 2007 (7,114) and 2015 (6,616); the average rating per year stays within 3.3–3.9 despite large swings in volume.",
    42: "Monday (17,583) is the busiest day and Thursday (10,706) the quietest; activity is otherwise spread fairly evenly across the week.",
    43: "User 414 was active from June 2000 to June 2018 – an 18-year rating history.",
    44: "'in netflix queue' (131) is the most common tag, followed by 'atmospheric', 'thought-provoking' and 'superhero'; $toLower merges case variants.",
    45: "Pulp Fiction carries 173 distinct tags from just 4 users – tagging is concentrated among a few enthusiastic users.",
    46: "Pulp Fiction (181 tags) and Fight Club (54) are the most tagged movies – cult classics attract the most annotation.",
    47: "Films tagged 'funny' range from Pulp Fiction (4.20) and Guardians of the Galaxy (4.05) down to Home Alone 2 (2.52) – the double $lookup combines all three collections in one pipeline.",
    48: "User 474 applied 1,507 of the 3,683 tags (41 %) – a single user dominates the tags collection.",
    49: "Movies sharing all five of Toy Story's genres are Toy Story 3, Monsters Inc., The Lego Movie, Shrek and Toy Story 2 – content-based similarity finds its sequels and peers purely from metadata.",
    50: "Of 150 users who rated The Matrix 4.5 or 5, half also loved The Shawshank Redemption and Fight Club, and 60 loved Star Wars – a simple but effective item-to-item collaborative recommendation.",
    51: "The pipeline recommends highly-rated Action/Adventure films that user 1 has not rated (anti-join on r.userId): North by Northwest, City of God, The Good, the Bad and the Ugly and The Return of the King.",
    52: "Hidden gems such as Secrets & Lies (4.59 from 11 ratings), Paths of Glory and A Streetcar Named Desire average ≥ 4.3 with only 10–30 ratings – quality titles that a popularity-based list would never surface.",
    53: "$merge writes 9,724 per-movie statistics into movie_stats so the dashboard can sort and filter movies without re-aggregating 100k ratings on every request.",
    54: "A single $facet query returns four independent aggregations (overall stats, top movies, top users, star histogram) – exactly what a dashboard overview page needs in one round-trip.",
    55: "The inserted document contains a field (source) that no other movie has – MongoDB's flexible schema accepts it without any DDL change.",
    56: "$push appended 'Drama' to the array and $set added a new field in one atomic update; the returned document confirms both changes.",
    57: "After deletion the collection is back to exactly 9,742 documents.",
    58: "The plan uses IXSCAN on movieId_1: 307 keys examined, 307 documents examined, 307 returned, in 1 ms. Without the index the same query would examine all 100,836 documents (COLLSCAN).",
}

groups = []
for r in results.values():
    if not groups or groups[-1][0] != r["group"]:
        groups.append((r["group"], []))
    groups[-1][1].append(r)

H("11. Queries and Results")
para("The queries are organised into nine groups. For each query the purpose, the exact mongosh command, its output and the observation drawn from the result are given.", align="justify")
for gi, (gname, qs) in enumerate(groups, 1):
    H(f"11.{gi} {gname}", 2)
    for r in qs:
        H(f"Query {r['id']}: {r['title']}", 3)
        rich([("Purpose: ", {"b": 1}), r["purpose"]])
        para("Query:", bold=True, after=2).paragraph_format.keep_with_next = True
        code(r["shell"])
        para("Output:", bold=True, after=2).paragraph_format.keep_with_next = True
        shot = A("shots", f"q{r['id']:02d}.png")
        from PIL import Image
        w, h = Image.open(shot).size
        width_cm = 16.4
        # keep very tall shots within one page
        if h / w * width_cm > 23.5:
            width_cm = 23.5 * w / h
        image(shot, width_cm=width_cm)
        rich([("Observation: ", {"b": 1}), INSIGHT.get(r["id"], "")])

# ───────────────────────── findings ─────────────────────────
H("12. Key Findings")
bullets([
    "The rating scale is used asymmetrically: 4.0 is the mode, whole stars dominate, and the global mean is 3.50 (σ 1.04).",
    "Popularity and quality differ: Forrest Gump is the most rated film, but The Shawshank Redemption is the best rated (4.43 from 317 ratings) and also has the most 5-star votes.",
    "Niche genres score highest (Film-Noir 3.92, War 3.81, Documentary 3.80) while the most-watched genres (Drama 3.66, Comedy 3.39) sit around the mean and Horror is lowest (3.26).",
    "User behaviour follows a long tail: 3 super-users have over 2,000 ratings each, only 12 exceed 1,000, and one user produced 41 % of all tags.",
    "Rating scales are subjective – average scores given by individual users range from 2.14 to 4.56 – so recommenders should normalise per user.",
    "Three recommendation strategies were implemented entirely in the aggregation framework: genre-overlap similarity ($setIntersection), item-to-item collaborative filtering ($lookup with $in on a fan list), and Bayesian weighted rating.",
    "Indexes matter: the movieId index answers a lookup by examining 307 keys instead of scanning 100,836 documents; $merge turns a 1-second aggregation into a millisecond lookup for the dashboard.",
])

# ───────────────────────── operators ─────────────────────────
H("13. MongoDB Operators and Stages Used")
table(["Operator / Stage", "Category", "Used for"], [
    [("find, findOne, countDocuments, distinct",), "Query", "Basic retrieval, counting and unique values"],
    [("$regex, $text / $meta",), "Query", "Pattern matching and full-text title search"],
    [("$all, $in, $ne, $gte, $lte, $size, $not, $expr",), "Query", "Array and comparison filters, anti-joins"],
    [("insertOne, updateOne, updateMany, deleteOne",), "CRUD", "Write operations; pipeline-style updateMany for enrichment"],
    [("$set, $push",), "Update", "Adding fields and array elements"],
    [("$match, $project, $addFields, $sort, $limit, $skip, $count",), "Aggregation", "Filtering, shaping and ranking pipeline documents"],
    [("$group with $sum, $avg, $min, $max, $first, $addToSet, $push, $stdDevPop",), "Aggregation", "Grouping and statistics"],
    [("$lookup (simple and pipeline form), $unwind",), "Aggregation", "Joining collections and flattening arrays"],
    [("$facet, $bucket",), "Aggregation", "Multiple result sets in one query; histograms"],
    [("$split, $regexFind, $toLower, $toInt, $toDate, $let, $cond, $ifNull",), "Expression", "String, type-conversion and conditional expressions"],
    [("$year, $dayOfWeek",), "Date", "Time-based analysis"],
    [("$setIntersection, $arrayElemAt, $slice, $size, $round, $multiply, $divide, $floor, $add",), "Expression", "Array and arithmetic operations (similarity, decades, weighted rating)"],
    [("$merge",), "Output", "Materialising results into movie_stats"],
    [("createIndex, getIndexes, explain('executionStats')",), "Indexing", "Index creation and query-plan verification"],
], widths=[7.4, 2.4, 6.8])

# ───────────────────────── dashboard ─────────────────────────
H("14. CineMatch Web Dashboard")
para("To make the analysis usable beyond the shell, the aggregation pipelines were wrapped in an Express REST API and presented in a React single-page application. The dashboard reads from the same cinematch database and re-uses the pipelines from Section 11; the Query Lab page lists all 58 queries, shows the exact mongosh code and executes each one live, rendering the result as a chart, a table or raw JSON.", align="justify")
table(["Endpoint", "Description"], [
    [("GET /api/overview",), "$facet-style summary: counts, rating histogram, ratings per year, genre statistics, top movies"],
    [("GET /api/movies?q=&genre=&sort=&minRatings=",), "Catalogue search with regex, multikey genre filter and sort on movie_stats"],
    [("GET /api/movies/:id",), "Movie detail: rating breakdown, tags, genre-similar movies, \"users also liked\""],
    [("GET /api/genres/:genre",), "Releases per decade and top-rated films of a genre"],
    [("GET /api/users/top, /api/users/:id",), "Most active users; user profile with genre taste and personalised recommendations"],
    [("GET /api/queries, /api/queries/:id/run",), "The query catalogue and live execution of any query"],
], widths=[6.6, 10])
for name, cap in [
    ("ui_overview", "Figure 14.1 – Overview page: KPIs, rating distribution, ratings per year, average rating by genre and top-rated movies."),
    ("ui_explore", "Figure 14.2 – Explore page: highest-rated movies with at least 100 ratings, filterable by genre."),
    ("ui_movie", "Figure 14.3 – Movie page for The Matrix: rating breakdown, tags, collaborative (\"also liked\") and content-based recommendations."),
    ("ui_genres", "Figure 14.4 – Genre analytics: movies per genre and average rating vs. rating volume."),
    ("ui_user", "Figure 14.5 – User 414 profile: genres rated, rating habits and personalised weighted-rating recommendations for unseen movies."),
    ("ui_lab", "Figure 14.6 – Query Lab executing Query 50 (collaborative filtering) live with chart output."),
]:
    from PIL import Image
    w, h = Image.open(A("assets", f"{name}.png")).size
    image(A("assets", f"{name}.png"), width_cm=min(16.4, 22 * w / h), caption=cap)

# ───────────────────────── conclusion ─────────────────────────
H("15. Conclusion")
para("This case study showed how a document database can take a raw, multi-file rating dataset from import to insight without leaving the database. MongoDB's flexible schema allowed the movie documents to be enriched in place with a numeric year and a genre array, its aggregation framework answered every analytical question posed – from simple counts to joins across three collections, statistical measures such as standard deviation, histograms with $bucket, and multi-view results with $facet – and its indexing features kept those queries fast, as confirmed with explain().", align="justify")
para("Beyond descriptive analytics, three recommendation techniques were implemented as pure aggregation pipelines, and the resulting statistics were materialised with $merge to power an interactive dashboard. The project therefore demonstrates the complete NoSQL workflow: data modelling with references and embedding, CRUD, querying, aggregation, indexing, and integration with an application layer.", align="justify")

H("16. Future Scope")
bullets([
    "Scale to the full MovieLens dataset (33 million ratings) using sharding on movieId/userId and Atlas Search for title search.",
    "Add user-based collaborative filtering with cosine similarity computed in the pipeline, and store pre-computed neighbourhoods with $merge.",
    "Enrich movies with TMDb metadata (posters, cast, overview) via the links collection.",
    "Use change streams to update movie_stats incrementally as new ratings arrive instead of re-running the $merge pipeline.",
])

H("17. References")
numbered([
    "MongoDB Manual – https://www.mongodb.com/docs/manual/",
    "MongoDB Aggregation Pipeline – https://www.mongodb.com/docs/manual/aggregation/",
    "MongoDB Aggregation Stages and Operators – https://www.mongodb.com/docs/manual/reference/operator/aggregation/",
    "MongoDB Indexes – https://www.mongodb.com/docs/manual/indexes/",
    "MongoDB Shell (mongosh) Documentation – https://www.mongodb.com/docs/mongodb-shell/",
    "MongoDB Node.js Driver – https://www.mongodb.com/docs/drivers/node/current/",
    "F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets: History and Context. ACM Transactions on Interactive Intelligent Systems (TiiS) 5, 4, Article 19. https://doi.org/10.1145/2827872",
    "GroupLens Research – MovieLens Latest Datasets (ml-latest-small) – https://grouplens.org/datasets/movielens/latest/",
    "Kaggle – Popular Movies Datasets (9742 Movies) – https://www.kaggle.com/datasets/whenamancodes/popular-movies-datasets-9000-movies",
    "Express.js – https://expressjs.com/  ·  React – https://react.dev/  ·  Recharts – https://recharts.org/",
])

out = A("CineMatch_NoSQL_Case_Study_Report.docx")
doc.save(out)
print("saved", out)
