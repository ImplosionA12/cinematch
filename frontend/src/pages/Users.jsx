import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useFetch, Loader, fmt, fx, MovieCard, TT, AX, GENRE_COLORS, Genre } from "../lib";

export default function Users() {
  const { id } = useParams();
  const nav = useNavigate();
  const [draft, setDraft] = useState(id || "");
  const top = useFetch("/api/users/top");

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Users</span><h2>User profiles & recommendations</h2><p>610 anonymous users, each with at least 20 ratings. Pick a user to see their taste profile and personalised, weighted-rating recommendations for movies they have not seen.</p></div>
        <form className="controls" onSubmit={(e) => { e.preventDefault(); if (draft) nav(`/users/${draft}`); }}>
          <input className="input" type="number" min="1" max="610" placeholder="userId 1–610" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 150 }} />
          <button className="btn">Open</button>
        </form>
      </div>

      {id ? <UserDetail id={id} /> : (
        <div className="panel">
          <h3>Most active users</h3><p className="sub">$group by userId → $sum, $avg, $min/$max ratedAt</p>
          {top.loading ? <Loader /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th className="idx">#</th><th>userId</th><th className="num">ratings</th><th className="num">avg rating</th><th>first rating</th><th>last rating</th><th></th></tr></thead>
              <tbody>{top.data.map((u, i) => <tr key={u.userId}><td className="idx">{i + 1}</td><td><b>User {u.userId}</b></td><td className="num">{fmt(u.ratings)}</td><td className="num"><span className="stars">★ {fx(u.avg)}</span></td><td className="muted">{new Date(u.first).toLocaleDateString()}</td><td className="muted">{new Date(u.last).toLocaleDateString()}</td><td><Link to={`/users/${u.userId}`} className="btn ghost sm">Profile</Link></td></tr>)}</tbody>
            </table></div>
          )}
        </div>
      )}
    </>
  );
}

function UserDetail({ id }) {
  const { data, loading, error } = useFetch(`/api/users/${id}`, [id]);
  if (loading) return <Loader />;
  if (error || !data) return <div className="empty">User not found (valid range 1–610).</div>;
  const u = data;
  return (
    <>
      <div className="grid c4" style={{ marginBottom: 18 }}>
        <div className="panel kpi"><div className="accent" style={{ background: "#8b7cff" }} /><div className="l">User</div><div className="v">#{u.userId}</div></div>
        <div className="panel kpi"><div className="accent" style={{ background: "#f5b83d" }} /><div className="l">Ratings</div><div className="v">{fmt(u.ratings)}</div></div>
        <div className="panel kpi"><div className="accent" style={{ background: "#ff5c7a" }} /><div className="l">Average given</div><div className="v">{fx(u.avg)}</div><div className="sub" style={{ margin: 0 }}>{u.avg > 3.8 ? "generous critic" : u.avg < 3.2 ? "harsh critic" : "balanced critic"}</div></div>
        <div className="panel kpi"><div className="accent" style={{ background: "#3ddbd9" }} /><div className="l">Active</div><div className="v" style={{ fontSize: 20 }}>{new Date(u.first).getFullYear()} – {new Date(u.last).getFullYear()}</div></div>
      </div>

      <div className="grid c2" style={{ marginBottom: 18 }}>
        <div className="panel">
          <h3>Genres rated</h3><p className="sub">$lookup movies → $unwind genreList → $group; colour = average rating given</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={u.genres.slice(0, 12)} layout="vertical" barCategoryGap="18%">
              <XAxis type="number" {...AX} /><YAxis type="category" dataKey="genre" {...AX} width={90} />
              <Tooltip {...TT} formatter={(v, n, p) => [`${fmt(v)} rated · avg ${fx(p.payload.avg)}`, "ratings"]} />
              <Bar isAnimationActive={false} dataKey="n" radius={[0, 6, 6, 0]}>{u.genres.slice(0, 12).map((g) => <Cell key={g.genre} fill={GENRE_COLORS[g.genre] || "#9a97b3"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>How this user rates</h3><p className="sub">distribution of stars given</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={u.distribution} barCategoryGap="18%">
              <XAxis dataKey="_id" {...AX} /><YAxis {...AX} width={44} />
              <Tooltip {...TT} formatter={(v) => fmt(v)} />
              <Bar isAnimationActive={false} dataKey="n" name="ratings" radius={[6, 6, 0, 0]}>{u.distribution.map((d, i) => <Cell key={i} fill={d._id >= 4 ? "#f5b83d" : d._id >= 3 ? "#8b7cff" : "#4b4966"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <h3>Recommended for user {u.userId}</h3>
        <p className="sub">favourite genres from ≥ 4★ ratings: {u.recommendations.favGenres.map((g) => <Genre key={g} g={g} />)} → unseen movies (anti-join via $lookup + $size: 0) ranked by IMDb-style weighted rating</p>
        {u.recommendations.items.length ? <div className="cards">{u.recommendations.items.map((m, i) => <MovieCard key={m.movieId} m={m} rank={i + 1} />)}</div> : <div className="empty">Nothing left to recommend!</div>}
      </div>

      <div className="panel">
        <h3>Most recent ratings</h3><p className="sub">$sort ratedAt: -1 → $limit 12</p>
        <div className="cards">{u.recent.map((m) => <MovieCard key={m.movieId} m={m} sub={<span><span className="stars">★ {m.rating}</span> <span className="dim">· {new Date(m.ratedAt).toLocaleDateString()}</span></span>} />)}</div>
      </div>
    </>
  );
}
