import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, Cell, PieChart, Pie, Legend } from "recharts";
import { useFetch, Loader, fmt, fx, MovieCard, TT, AX, GENRE_COLORS } from "../lib";

function Kpi({ label, value, accent, hint }) {
  return (
    <div className="panel kpi">
      <div className="accent" style={{ background: accent }} />
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {hint && <div className="sub" style={{ margin: 0 }}>{hint}</div>}
    </div>
  );
}

export default function Overview() {
  const { data, loading } = useFetch("/api/overview");
  if (loading || !data) return <Loader />;
  const genres = data.byGenre.filter((g) => g._id !== "(no genres listed)");
  const topGenres = [...genres].sort((a, b) => b.ratings - a.ratings).slice(0, 8);

  return (
    <>
      <div className="hero" style={{ marginBottom: 22 }}>
        <div className="glow" />
        <span className="eyebrow">MongoDB · MovieLens (ml-latest-small)</span>
        <h2>CineMatch</h2>
        <p>Movie recommendation and analytics built entirely on MongoDB queries and aggregation pipelines — {fmt(data.counts.ratings)} ratings by {fmt(data.counts.users)} users across {fmt(data.counts.movies)} movies, joined with <code className="mono">$lookup</code>, shaped with <code className="mono">$group</code>, <code className="mono">$unwind</code>, <code className="mono">$facet</code> and friends.</p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link to="/explore" className="btn">Explore movies</Link>
          <Link to="/lab" className="btn ghost">Open the Query Lab →</Link>
        </div>
      </div>

      <div className="grid c4" style={{ marginBottom: 18 }}>
        <Kpi label="Movies" value={fmt(data.counts.movies)} accent="#f5b83d" hint="movies collection" />
        <Kpi label="Ratings" value={fmt(data.counts.ratings)} accent="#8b7cff" hint="ratings collection" />
        <Kpi label="Users" value={fmt(data.counts.users)} accent="#3ddbd9" hint="distinct userId" />
        <Kpi label="Average rating" value={fx(data.avgRating)} accent="#ff5c7a" hint={`σ = ${fx(data.stdDev, 3)} · ${fmt(data.counts.tags)} tags`} />
      </div>

      <div className="grid c2" style={{ marginBottom: 18 }}>
        <div className="panel">
          <h3>Rating distribution</h3>
          <p className="sub">$group by rating — users prefer whole stars; 4.0 is the mode</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byStar} barCategoryGap="18%">
              <XAxis dataKey="_id" {...AX} /><YAxis {...AX} width={52} tickFormatter={(v) => (v / 1000) + "k"} />
              <Tooltip {...TT} formatter={(v) => fmt(v)} />
              <Bar isAnimationActive={false} dataKey="n" name="ratings" radius={[6, 6, 0, 0]}>
                {data.byStar.map((d, i) => <Cell key={i} fill={d._id >= 4 ? "#f5b83d" : d._id >= 3 ? "#8b7cff" : "#4b4966"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>Ratings per year</h3>
          <p className="sub">$year on the converted ratedAt date, 1996 → 2018</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.byYear}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cff" stopOpacity=".7" /><stop offset="100%" stopColor="#8b7cff" stopOpacity="0" /></linearGradient></defs>
              <XAxis dataKey="_id" {...AX} /><YAxis {...AX} width={52} tickFormatter={(v) => (v / 1000) + "k"} />
              <Tooltip {...TT} formatter={(v, n) => n === "avg" ? fx(v) : fmt(v)} />
              <Area isAnimationActive={false} dataKey="n" name="ratings" stroke="#8b7cff" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid c3" style={{ marginBottom: 18 }}>
        <div className="panel" style={{ gridColumn: "span 2" }}>
          <h3>Average rating by genre</h3>
          <p className="sub">$unwind genreList → $group with $avg · bar height = average, sorted by movie count</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={genres} barCategoryGap="22%">
              <XAxis dataKey="_id" {...AX} interval={0} angle={-30} textAnchor="end" height={64} />
              <YAxis {...AX} domain={[3, 4]} ticks={[3, 3.25, 3.5, 3.75, 4]} tickFormatter={(v) => v.toFixed(2)} width={44} />
              <Tooltip {...TT} formatter={(v, n) => n === "avg" ? fx(v, 3) : fmt(v)} />
              <Bar isAnimationActive={false} dataKey="avg" name="avg" radius={[6, 6, 0, 0]}>{genres.map((g) => <Cell key={g._id} fill={GENRE_COLORS[g._id] || "#9a97b3"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>Share of ratings</h3>
          <p className="sub">top 8 genres by rating volume</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie isAnimationActive={false} data={topGenres} dataKey="ratings" nameKey="_id" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                {topGenres.map((g) => <Cell key={g._id} fill={GENRE_COLORS[g._id]} />)}
              </Pie>
              <Tooltip {...TT} formatter={(v) => fmt(v)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11.5, color: "#9a97b3" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="row spread"><div><h3>Highest rated · minimum 100 ratings</h3><p className="sub">$match ratingCount ≥ 100 → $sort avgRating → $lookup movies</p></div><Link to="/explore?sort=rating&minRatings=100" className="btn ghost sm">See all</Link></div>
        <div className="cards">{data.topRated.map((m, i) => <MovieCard key={m.movieId} m={m} rank={i + 1} />)}</div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="row spread"><div><h3>Most rated · popularity</h3><p className="sub">$group by movieId with $sum: 1</p></div><Link to="/explore?sort=popular" className="btn ghost sm">See all</Link></div>
        <div className="cards">{data.mostRated.map((m, i) => <MovieCard key={m.movieId} m={m} rank={i + 1} />)}</div>
      </div>

      <div className="panel">
        <h3>Movies per decade</h3>
        <p className="sub">year extracted from the title with $regexFind, bucketed with $floor(year / 10) × 10</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.decades} barCategoryGap="25%">
            <XAxis dataKey="_id" {...AX} tickFormatter={(v) => v + "s"} /><YAxis {...AX} width={44} />
            <Tooltip {...TT} formatter={(v) => fmt(v)} labelFormatter={(v) => v + "s"} />
            <Bar isAnimationActive={false} dataKey="n" name="movies" fill="#3ddbd9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
