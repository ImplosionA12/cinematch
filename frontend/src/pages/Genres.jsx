import { Link, useParams } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ComposedChart, Line } from "recharts";
import { useFetch, Loader, fmt, fx, MovieCard, TT, AX, GENRE_COLORS } from "../lib";

export default function Genres() {
  const { genre } = useParams();
  const ov = useFetch("/api/overview");
  if (ov.loading || !ov.data) return <Loader />;
  const genres = ov.data.byGenre.filter((g) => g._id !== "(no genres listed)");
  const byMovies = [...genres].sort((a, b) => b.movies - a.movies);

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Genres</span><h2>Genre analytics</h2><p><code className="mono">genres</code> is stored as a pipe-delimited string; <code className="mono">$split</code> turned it into <code className="mono">genreList</code>, which is unwound and grouped here.</p></div>
      </div>

      <div className="row" style={{ marginBottom: 18, gap: 6 }}>
        {byMovies.map((g) => { const c = GENRE_COLORS[g._id]; const on = genre === g._id; return <Link key={g._id} to={`/genres/${encodeURIComponent(g._id)}`} className="chip click" style={on ? { color: "#111", background: c, borderColor: c } : { color: c, borderColor: c + "55" }}>{g._id} <span style={{ opacity: .7, marginLeft: 5 }}>{fmt(g.movies)}</span></Link>; })}
      </div>

      {genre ? <GenreDetail genre={genre} /> : (
        <div className="grid c2">
          <div className="panel">
            <h3>Movies per genre</h3><p className="sub">$unwind genreList → $group → $sum: 1</p>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={byMovies} layout="vertical" barCategoryGap="20%">
                <XAxis type="number" {...AX} /><YAxis type="category" dataKey="_id" {...AX} width={92} />
                <Tooltip {...TT} formatter={(v) => fmt(v)} />
                <Bar isAnimationActive={false} dataKey="movies" radius={[0, 6, 6, 0]}>{byMovies.map((g) => <Cell key={g._id} fill={GENRE_COLORS[g._id]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel">
            <h3>Average rating vs. rating volume</h3><p className="sub">bar = ratings received · line = mean rating (Film-Noir is loved by few, Horror rated lowest)</p>
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={[...genres].sort((a, b) => b.avg - a.avg)}>
                <XAxis dataKey="_id" {...AX} interval={0} angle={-35} textAnchor="end" height={80} />
                <YAxis yAxisId="l" {...AX} width={48} tickFormatter={(v) => (v / 1000) + "k"} />
                <YAxis yAxisId="r" orientation="right" domain={[3, 4]} ticks={[3, 3.25, 3.5, 3.75, 4]} tickFormatter={(v) => v.toFixed(2)} {...AX} width={40} />
                <Tooltip {...TT} formatter={(v, n) => n === "avg rating" ? fx(v, 3) : fmt(v)} />
                <Bar isAnimationActive={false} yAxisId="l" dataKey="ratings" name="ratings" fill="#8b7cff" radius={[6, 6, 0, 0]} opacity={.75} />
                <Line isAnimationActive={false} yAxisId="r" dataKey="avg" name="avg rating" stroke="#f5b83d" strokeWidth={2.5} dot={{ r: 3, fill: "#f5b83d" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}

function GenreDetail({ genre }) {
  const { data, loading } = useFetch(`/api/genres/${encodeURIComponent(genre)}`, [genre]);
  if (loading || !data) return <Loader />;
  const c = GENRE_COLORS[genre] || "#f5b83d";
  return (
    <>
      <div className="panel" style={{ marginBottom: 18 }}>
        <h3>{genre} releases per decade</h3><p className="sub">$match genreList: "{genre}" → bucket by decade · line = average rating of the decade's movies</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data.byDecade}>
            <XAxis dataKey="_id" {...AX} tickFormatter={(v) => v + "s"} />
            <YAxis yAxisId="l" {...AX} width={44} /><YAxis yAxisId="r" orientation="right" domain={[2.5, 4.5]} ticks={[2.5, 3, 3.5, 4, 4.5]} tickFormatter={(v) => v.toFixed(1)} {...AX} width={40} />
            <Tooltip {...TT} labelFormatter={(v) => v + "s"} formatter={(v, n) => n === "avg rating" ? fx(v) : fmt(v)} />
            <Bar isAnimationActive={false} yAxisId="l" dataKey="movies" name="movies" fill={c} radius={[6, 6, 0, 0]} opacity={.8} />
            <Line isAnimationActive={false} yAxisId="r" dataKey="avg" name="avg rating" stroke="#fff" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="panel">
        <h3>Top rated {genre} movies</h3><p className="sub">minimum 30 ratings · sorted by average</p>
        <div className="cards">{data.top.map((m, i) => <MovieCard key={m.movieId} m={m} rank={i + 1} />)}</div>
      </div>
    </>
  );
}
