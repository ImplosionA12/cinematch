import { Link, useParams } from "react-router-dom";
import { useFetch, Loader, fmt, fx, cleanTitle, Genre, MovieCard, Stars } from "../lib";

export default function Movie() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(`/api/movies/${id}`, [id]);
  if (loading) return <Loader />;
  if (error || !data) return <div className="empty">Movie not found.</div>;
  const m = data;
  const total = m.stats?.ratingCount || 0;
  const maxBar = Math.max(1, ...m.distribution.map((d) => d.n));

  return (
    <>
      <Link to="/explore" className="back">← Back to explore</Link>
      <div className="grid c3" style={{ marginBottom: 18, alignItems: "start" }}>
        <div className="panel" style={{ gridColumn: "span 2" }}>
          <span className="eyebrow">movieId {m.movieId}{m.link?.imdbId && <> · <a href={`https://www.imdb.com/title/tt${m.link.imdbId}/`} target="_blank" rel="noreferrer" style={{ color: "var(--teal)" }}>IMDb ↗</a></>}</span>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 36, margin: "0 0 6px", lineHeight: 1.1 }}>{cleanTitle(m.title)} <span className="muted" style={{ fontFamily: "var(--sans)", fontSize: 20, fontWeight: 400 }}>({m.year})</span></h2>
          <div className="row" style={{ margin: "10px 0 18px", gap: 6 }}>{m.genreList.map((g) => <Genre key={g} g={g} click />)}</div>
          <div className="grid c3">
            <div><div className="kpi"><div className="l">Average</div><div className="v" style={{ color: "var(--gold)" }}>{fx(m.stats?.avgRating)}</div></div></div>
            <div><div className="kpi"><div className="l">Ratings</div><div className="v">{fmt(total)}</div></div></div>
            <div><div className="kpi"><div className="l">Std. dev</div><div className="v">{fx(m.stats?.stdDev, 3)}</div></div></div>
          </div>
          {m.tags.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="sub">User tags · $group by $toLower(tag)</p>
              <div className="tags">{m.tags.map((t) => <span key={t._id} className="chip violet">{t._id}{t.n > 1 && <span className="dim" style={{ marginLeft: 5 }}>×{t.n}</span>}</span>)}</div>
            </div>
          )}
        </div>
        <div className="panel">
          <h3>Rating breakdown</h3>
          <p className="sub">$match movieId → $group by rating</p>
          {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((s) => {
            const n = m.distribution.find((d) => d._id === s)?.n || 0;
            return <div className="rating-bar" key={s}><span className="stars">{s}★</span><div className="bar"><i style={{ width: (n / maxBar) * 100 + "%" }} /></div><span className="muted" style={{ textAlign: "right" }}>{fmt(n)}</span></div>;
          })}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <h3>Users who rated this ≥ 4★ also liked</h3>
        <p className="sub">collaborative filtering: {fmt(m.alsoLiked.fanCount)} fans → $lookup with $in on their userIds → count co-liked movies</p>
        {m.alsoLiked.also.length ? <div className="cards">{m.alsoLiked.also.map((x) => <MovieCard key={x.movieId} m={x} sub={<span className="chip gold">{x.fans} fans</span>} />)}</div> : <div className="empty">Not enough ratings for collaborative recommendations.</div>}
      </div>

      <div className="panel">
        <h3>Similar by genre</h3>
        <p className="sub">content-based: $setIntersection(genreList) size ≥ {Math.max(1, m.genreList.length - 1)} → sorted by shared genres then average rating (≥ 20 ratings)</p>
        {m.similar.length ? <div className="cards">{m.similar.map((x) => <MovieCard key={x.movieId} m={x} sub={<span><Stars v={x.avgRating} /> <span className="chip teal" style={{ marginLeft: 4 }}>{x.shared} shared</span></span>} />)}</div> : <div className="empty">No similar movies found.</div>}
      </div>
    </>
  );
}
