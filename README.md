# CineMatch – Movie Recommendation & Analytics on MongoDB

NoSQL case study (VIT-AP, SCOPE). MovieLens `ml-latest-small` imported into MongoDB (`cinematch`),
57 mongosh queries/aggregations, an Express REST API and a React dashboard.

## Layout
```
data/ml-latest-small/     movies.csv ratings.csv tags.csv links.csv (downloaded from GroupLens)
import/import.js          CSV -> MongoDB (equivalent to mongoimport --type csv --headerline)
queries/queries.js        the 57-query catalogue (single source of truth)
queries/serialize.js      turns a query definition into mongosh text
queries/run-all.js        runs every query in real mongosh -> report/results.json
server/index.js           Express API (also serves frontend/dist)
frontend/                 Vite + React + Recharts dashboard
report/render_shots.py    results.json -> terminal-style PNGs (report/shots)
report/build_report.py    builds CineMatch_NoSQL_Case_Study_Report.docx
report/CineMatch_NoSQL_Case_Study_Report.{docx,pdf}
```

## Run
```bash
npm install                      # root deps (mongodb, csv-parse, express, cors)
node import/import.js            # load the 4 collections (MongoDB must be running on 27017)
node queries/run-all.js          # execute all 57 queries in mongosh (also enriches data + builds indexes + movie_stats)
cd frontend && npm install && npm run build && cd ..
node server/index.js             # http://localhost:4000
```
Dev mode for the frontend: `cd frontend && npm run dev` (proxies /api to :4000).

## Rebuild the report
```bash
node queries/run-all.js
python report/render_shots.py
python report/build_report.py    # then convert .docx -> .pdf (docx2pdf / Word)
```
