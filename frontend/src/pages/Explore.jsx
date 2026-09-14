import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetch, Loader, fmt, MovieCard, GENRE_COLORS } from "../lib";

const GENRES = Object.keys(GENRE_COLORS).filter((g) => !g.startsWith("("));
const SORTS = [["popular", "Most rated"], ["rating", "Highest rated"], ["controversial", "Most divisive"], ["newest", "Newest"], ["oldest", "Oldest"]];

export default function Explore() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const genre = sp.get("genre") || "";
  const sort = sp.get("sort") || "popular";
  const minRatings = sp.get("minRatings") || (sort === "rating" || sort === "controversial" ? "50" : "0");
  const page = Number(sp.get("page") || 1);
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const set = (patch) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    setSp(n);
  };

  const url = `/api/movies?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(genre)}&sort=${sort}&minRatings=${minRatings}&page=${page}&limit=24`;
  const { data, loading } = useFetch(url, [url]);
  const pages = data ? Math.ceil(data.total / 24) : 0;

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Explore</span><h2>Movie catalogue</h2><p>Regex title search, multikey-index genre filters and sorting on the pre-aggregated <code className="mono">movie_stats</code> collection.</p></div>
      </div>

      <form className="controls" style={{ marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); set({ q: draft }); }}>
        <input className="input big" placeholder="Search titles… e.g. godfather, matrix, toy story" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn">Search</button>
        <select className="select" value={sort} onChange={(e) => set({ sort: e.target.value, minRatings: "" })}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="select" value={minRatings} onChange={(e) => set({ minRatings: e.target.value })}>
          <option value="0">any # ratings</option><option value="10">≥ 10 ratings</option><option value="50">≥ 50 ratings</option><option value="100">≥ 100 ratings</option>
        </select>
      </form>

      <div className="row" style={{ marginBottom: 18, gap: 6 }}>
        <span className={"chip click" + (!genre ? " gold" : "")} onClick={() => set({ genre: "" })}>All genres</span>
        {GENRES.map((g) => {
          const c = GENRE_COLORS[g]; const on = genre === g;
          return <span key={g} className="chip click" style={on ? { color: "#111", background: c, borderColor: c } : { color: c, borderColor: c + "55" }} onClick={() => set({ genre: on ? "" : g })}>{g}</span>;
        })}
      </div>

      {loading || !data ? <Loader /> : (
        <>
          <div className="row spread" style={{ marginBottom: 12 }}>
            <span className="muted">{fmt(data.total)} movies{q && <> matching <b>“{q}”</b></>}{genre && <> in <b>{genre}</b></>}</span>
            {pages > 1 && <div className="row"><button className="btn ghost sm" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>‹ Prev</button><span className="muted">page {page} / {pages}</span><button className="btn ghost sm" disabled={page >= pages} onClick={() => set({ page: page + 1 })}>Next ›</button></div>}
          </div>
          {data.items.length ? <div className="cards">{data.items.map((m, i) => <MovieCard key={m.movieId} m={m} rank={(page - 1) * 24 + i + 1} sub={sort === "controversial" ? <span className="chip rose">σ {m.stdDev}</span> : undefined} />)}</div> : <div className="empty">Nothing matched.</div>}
        </>
      )}
    </>
  );
}
