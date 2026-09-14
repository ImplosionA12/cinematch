import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Overview from "./pages/Overview";
import Explore from "./pages/Explore";
import Movie from "./pages/Movie";
import Genres from "./pages/Genres";
import Users from "./pages/Users";
import Lab from "./pages/Lab";

const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" /></svg>,
  film: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" /></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12 12 20 3 11V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></svg>,
  lab: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 4 5 8-5 8M14 20h6" /></svg>,
};

export default function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="logo"><svg width="22" height="22" viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="none" stroke="#1a1405" strokeWidth="6" /><circle cx="32" cy="32" r="5" fill="#1a1405" /><path d="M32 12v10M32 42v10M12 32h10M42 32h10" stroke="#1a1405" strokeWidth="5" strokeLinecap="round" /></svg></div>
            <div><h1>CineMatch</h1><small>MongoDB analytics</small></div>
          </div>
          <nav className="nav">
            <NavLink to="/" end>{I.home} Overview</NavLink>
            <NavLink to="/explore">{I.film} Explore movies</NavLink>
            <NavLink to="/genres">{I.tag} Genres</NavLink>
            <NavLink to="/users">{I.users} Users & recs</NavLink>
            <NavLink to="/lab">{I.lab} Query Lab</NavLink>
          </nav>
          <div className="foot">
            <b>Database</b> cinematch<br />movies · ratings · tags · links · movie_stats<br /><br />
            <b>Dataset</b> MovieLens ml-latest-small<br />GroupLens Research, Univ. of Minnesota<br /><br />
            <b>NoSQL case study</b> · VIT-AP University
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/movies/:id" element={<Movie />} />
            <Route path="/genres" element={<Genres />} />
            <Route path="/genres/:genre" element={<Genres />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<Users />} />
            <Route path="/lab" element={<Lab />} />
            <Route path="/lab/:id" element={<Lab />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
