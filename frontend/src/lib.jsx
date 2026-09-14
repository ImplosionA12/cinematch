import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export const GENRE_COLORS = {
  Action: "#ff5c7a", Adventure: "#ff8c42", Animation: "#f5b83d", Children: "#ffd479", Comedy: "#5ee6a0",
  Crime: "#8b7cff", Documentary: "#9a97b3", Drama: "#3ddbd9", Fantasy: "#c084fc", "Film-Noir": "#6b6885",
  Horror: "#e11d48", IMAX: "#60a5fa", Musical: "#f472b6", Mystery: "#a78bfa", Romance: "#fb7185",
  "Sci-Fi": "#22d3ee", Thriller: "#f97316", War: "#94a3b8", Western: "#d4a373", "(no genres listed)": "#4b4966",
};
export const PALETTE = ["#f5b83d", "#8b7cff", "#3ddbd9", "#ff5c7a", "#5ee6a0", "#ff8c42", "#c084fc", "#60a5fa", "#fb7185", "#22d3ee", "#f472b6", "#94a3b8", "#d4a373", "#a78bfa", "#ffd479", "#e11d48", "#9a97b3", "#f97316", "#6b6885", "#4b4966"];

export const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString());
export const fx = (n, d = 2) => (n == null ? "–" : Number(n).toFixed(d));
export const cleanTitle = (t) => (t || "").replace(/\s*\(\d{4}\)\s*$/, "");

export function useFetch(url, deps = []) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true, error: null }));
    fetch(url).then((r) => r.json()).then((d) => alive && set({ data: d, loading: false, error: d.error || null }))
      .catch((e) => alive && set({ data: null, loading: false, error: e.message }));
    return () => { alive = false; };
  }, deps);
  return state;
}

export const Loader = () => <div className="row" style={{ padding: 30, justifyContent: "center" }}><span className="loader" /></div>;

export function Stars({ v }) {
  return <span className="stars">★ {fx(v)}</span>;
}

export function Genre({ g, click }) {
  const c = GENRE_COLORS[g] || "#9a97b3";
  const el = <span className="chip" style={{ color: c, borderColor: c + "55", background: c + "1a" }}>{g}</span>;
  return click ? <Link to={`/genres/${encodeURIComponent(g)}`}>{el}</Link> : el;
}

function posterGradient(movie) {
  const gs = movie.genres || [];
  const a = GENRE_COLORS[gs[0]] || "#8b7cff";
  const b = GENRE_COLORS[gs[1]] || GENRE_COLORS[gs[0]] || "#3ddbd9";
  const seed = (movie.movieId || 0) % 360;
  return `linear-gradient(${135 + (seed % 60)}deg, ${a}cc, ${b}99), radial-gradient(circle at ${seed % 100}% 30%, rgba(255,255,255,.25), transparent 50%)`;
}

export function MovieCard({ m, rank, sub }) {
  return (
    <Link to={`/movies/${m.movieId}`} className="card">
      {rank != null && <span className="rank">#{rank}</span>}
      <div className="poster" style={{ background: posterGradient(m) }}>{cleanTitle(m.title)}</div>
      <div className="meta">
        <span>{m.year || "—"}</span>
        {sub ? <span>{sub}</span> : <span><Stars v={m.avgRating} /> <span className="dim">· {fmt(m.ratingCount)}</span></span>}
      </div>
      <div className="genres">{(m.genres || []).slice(0, 3).map((g) => <Genre key={g} g={g} />)}</div>
    </Link>
  );
}

export const TT = { contentStyle: { background: "#14131f", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10, fontSize: 12.5 }, labelStyle: { color: "#9a97b3" }, itemStyle: { color: "#f3f1ff" }, cursor: { fill: "rgba(255,255,255,.04)" } };
export const AX = { tick: { fill: "#9a97b3", fontSize: 11.5 }, axisLine: { stroke: "rgba(255,255,255,.1)" }, tickLine: false };

/* simple mongosh syntax highlighter */
export function highlight(code) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc(code)
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="s">$1</span>')
    .replace(/(\$[A-Za-z]+)(?=[\s:,\]}])/g, '<span class="k">$1</span>')
    .replace(/\b(db|true|false|null|const)\b/g, '<span class="f">$1</span>')
    .replace(/(?<![\w$"'])(-?\d+(?:\.\d+)?)(?![\w"'])/g, '<span class="n">$1</span>')
    .replace(/(\/\/.*)$/gm, '<span class="c">$1</span>');
}

export function Code({ code }) {
  return (
    <div>
      <div className="term-head"><i style={{ background: "#ff5f57" }} /><i style={{ background: "#febc2e" }} /><i style={{ background: "#28c840" }} /><span style={{ marginLeft: 6 }}>mongosh · cinematch</span></div>
      <pre className="code" dangerouslySetInnerHTML={{ __html: highlight(code) }} />
    </div>
  );
}

/* generic result → table */
export function ResultTable({ rows }) {
  if (!Array.isArray(rows)) rows = [rows];
  if (!rows.length) return <div className="empty">No documents returned</div>;
  const objs = rows.every((r) => r && typeof r === "object" && !Array.isArray(r));
  if (!objs) return <pre className="out">{JSON.stringify(rows, null, 2)}</pre>;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v == null) return <span className="dim">null</span>;
    if (typeof v === "number") return Number.isInteger(v) ? fmt(v) : fx(v, 3);
    if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString() : v;
    if (Array.isArray(v) && v.every((x) => typeof x !== "object")) return v.join(", ");
    return <span className="mono" style={{ fontSize: 11.5 }}>{JSON.stringify(v)}</span>;
  };
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th className="idx">#</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td className="idx">{i + 1}</td>{cols.map((c) => <td key={c} className={typeof r[c] === "number" ? "num" : ""}>{cell(r[c])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
