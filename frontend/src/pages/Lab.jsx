import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, PieChart, Pie, Legend } from "recharts";
import { useFetch, Loader, fmt, fx, Code, ResultTable, TT, AX, PALETTE, GENRE_COLORS } from "../lib";

const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);

function Chart({ chart, rows }) {
  if (!chart || !Array.isArray(rows) || !rows.length) return null;
  const { type, x, y, series } = chart;
  if (type === "kpi") return null;
  const data = rows.map((r) => ({ ...r, __x: String(get(r, x)), __y: get(r, y) }));
  if (type === "grouped") {
    const xs = [...new Set(data.map((d) => d.__x))];
    const ss = [...new Set(data.map((d) => String(get(d, series))))];
    const wide = xs.map((xv) => Object.fromEntries([["__x", xv], ...ss.map((s) => [s, data.find((d) => d.__x === xv && String(get(d, series)) === s)?.__y ?? 0])]));
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={wide}><XAxis dataKey="__x" {...AX} /><YAxis {...AX} width={44} /><Tooltip {...TT} /><Legend wrapperStyle={{ fontSize: 12 }} />
          {ss.map((s, i) => <Bar isAnimationActive={false} key={s} dataKey={s} fill={GENRE_COLORS[s] || PALETTE[i]} radius={[5, 5, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "pie") return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart><Pie isAnimationActive={false} data={data} dataKey="__y" nameKey="__x" innerRadius={55} outerRadius={100} paddingAngle={2} stroke="none">{data.map((d, i) => <Cell key={i} fill={GENRE_COLORS[d.__x] || PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...TT} formatter={(v) => fmt(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart>
    </ResponsiveContainer>
  );
  if (type === "line") return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}><XAxis dataKey="__x" {...AX} /><YAxis {...AX} width={52} /><Tooltip {...TT} formatter={(v) => fmt(v)} /><Line isAnimationActive={false} dataKey="__y" name={y} stroke="#f5b83d" strokeWidth={2.5} dot={{ r: 3, fill: "#f5b83d" }} /></LineChart>
    </ResponsiveContainer>
  );
  const vertical = type === "hbar";
  const short = (s) => (s.length > 34 ? s.slice(0, 32) + "…" : s);
  const allSmall = data.every((d) => typeof d.__y === "number" && d.__y <= 5 && d.__y >= 0);
  return (
    <ResponsiveContainer width="100%" height={vertical ? 28 * data.length + 40 : 280}>
      <BarChart data={data} layout={vertical ? "vertical" : "horizontal"} barCategoryGap="20%">
        {vertical ? <><XAxis type="number" {...AX} domain={allSmall ? [0, 5] : [0, "auto"]} /><YAxis type="category" dataKey="__x" {...AX} width={230} tickFormatter={short} /></> : <><XAxis dataKey="__x" {...AX} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? "end" : "middle"} height={data.length > 8 ? 70 : 30} tickFormatter={short} /><YAxis {...AX} width={52} domain={allSmall ? [0, 5] : [0, "auto"]} /></>}
        <Tooltip {...TT} formatter={(v) => (Number.isInteger(v) ? fmt(v) : fx(v, 3))} />
        <Bar isAnimationActive={false} dataKey="__y" name={y} radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={GENRE_COLORS[d.__x] || PALETTE[i % PALETTE.length]} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Lab() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: list, loading } = useFetch("/api/queries");
  const [res, setRes] = useState(null);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState("table");
  const [filter, setFilter] = useState("");
  const cur = useMemo(() => list?.find((q) => q.id === Number(id)) || list?.[0], [list, id]);
  const groups = useMemo(() => { const g = {}; (list || []).forEach((q) => (g[q.group] ||= []).push(q)); return g; }, [list]);

  const run = async (q) => {
    if (!q) return;
    setRunning(true); setRes(null);
    const r = await fetch(`/api/queries/${q.id}/run`).then((r) => r.json());
    setRes(r); setRunning(false);
    setView(q.chart && q.chart.type !== "kpi" ? "chart" : "table");
  };
  useEffect(() => { if (cur) run(cur); }, [cur?.id]);

  if (loading || !list) return <Loader />;
  const rows = res?.result;
  const writeKinds = cur && (cur.kind === "raw");

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Query Lab</span><h2>All {list.length} MongoDB queries</h2><p>Every query from the case study, exactly as typed in <code className="mono">mongosh</code>. Select one to execute it live against the <code className="mono">cinematch</code> database and see the result as a table, chart or raw JSON.</p></div>
      </div>
      <div className="lab">
        <div className="qlist">
          <input className="input" placeholder="filter queries…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
          {Object.entries(groups).map(([g, qs]) => {
            const shown = qs.filter((q) => !filter || (q.title + q.shell).toLowerCase().includes(filter.toLowerCase()));
            if (!shown.length) return null;
            return <div className="qgroup" key={g}><h4>{g}</h4>{shown.map((q) => <div key={q.id} className={"qitem" + (cur?.id === q.id ? " on" : "")} onClick={() => nav(`/lab/${q.id}`)}><span className="no">{String(q.id).padStart(2, "0")}</span><span>{q.title}</span></div>)}</div>;
          })}
        </div>
        {cur && (
          <div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <span className="eyebrow">{cur.group} · Query {cur.id}</span>
              <h3 style={{ fontSize: 20, fontFamily: "var(--serif)", marginBottom: 6 }}>{cur.title}</h3>
              <p className="sub" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{cur.purpose}</p>
              <div className="badge-row">
                <span className="chip teal">{cur.kind === "raw" ? "shell script" : cur.kind}</span>
                {cur.collection && <span className="chip violet">db.{cur.collection}</span>}
                {[...new Set(cur.shell.match(/\$[a-zA-Z]+/g) || [])].filter((s) => /^\$[a-z]/.test(s) && s.length > 2).slice(0, 12).map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
              <Code code={cur.shell} />
            </div>
            <div className="panel">
              <div className="row spread" style={{ marginBottom: 12 }}>
                <div className="row">
                  <button className="btn sm" disabled={running} onClick={() => run(cur)}>{running ? "Running…" : "▶ Run again"}</button>
                  {res && <span className="muted" style={{ fontSize: 13 }}>{res.ms} ms · {Array.isArray(rows) ? `${rows.length} document${rows.length === 1 ? "" : "s"}` : typeof rows === "object" ? "1 document" : "scalar"}{writeKinds && " · idempotent write"}</span>}
                </div>
                <div className="seg">
                  {cur.chart && cur.chart.type !== "kpi" && <button className={view === "chart" ? "on" : ""} onClick={() => setView("chart")}>Chart</button>}
                  <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>Table</button>
                  <button className={view === "json" ? "on" : ""} onClick={() => setView("json")}>JSON</button>
                </div>
              </div>
              {running ? <Loader /> : res?.error ? <pre className="out" style={{ color: "var(--rose)" }}>{res.error}</pre> : rows === undefined ? null : (
                view === "chart" ? <Chart chart={cur.chart} rows={rows} /> :
                view === "json" ? <pre className="out">{JSON.stringify(rows, null, 2)}</pre> :
                typeof rows !== "object" || rows === null ? <div className="kpi"><div className="v">{typeof rows === "number" ? fmt(rows) : String(rows)}</div></div> :
                <ResultTable rows={rows} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
