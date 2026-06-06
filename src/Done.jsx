import { useState, useEffect, useCallback, useMemo } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ektichcptphekmkhibde.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdGljaGNwdHBoZWtta2hpYmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjU4MDAsImV4cCI6MjA4ODE0MTgwMH0.xbtKl33uVx6KaZd-gxxcUeJqslITWX2b_tfhYhzQDjE";

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};
async function sbRpc(name, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: sbHeaders, body: JSON.stringify(params) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const GOLD = "#c9a84c", BG = "#050402", CARD = "#0a0906", BORDER = "#1a1814";
const TEXT = "#f0ead6", MUTED = "#a89878", ERROR = "#f87171", SUCCESS = "#22c55e";

// ── HELPERS ───────────────────────────────────────────────────────────────────
const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (Toronto locale)

function parseISO(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || "").trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function dayLabel(jobDate, today) {
  const d = parseISO(jobDate), t = parseISO(today);
  if (!d) return jobDate;
  const diff = Math.round((d - t) / 86400000);
  const ds = `${MON[d.getMonth()]} ${d.getDate()}`;
  if (diff === 0) return `TODAY · ${ds}`;
  if (diff === 1) return `TOMORROW · ${ds}`;
  return `${DOW[d.getDay()]} · ${ds}`;
}
const mapLink = (loc) => `https://maps.google.com/?q=${encodeURIComponent(loc || "")}`;
const money = (n) => `$${Number(n || 0).toFixed(0)}`;
const cleanTime = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? `${m[1].padStart(2,"0")}:${m[2]}` : (t || ""); };

function Shell({ name, children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Barlow', sans-serif", color: TEXT }}>
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>MIDAS INDUSTRIAL SERVICES</div>
            <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: "0.15em" }}>MY CONTAINERS</div>
          </div>
          {name && <div style={{ fontSize: 13, color: GOLD, fontWeight: 800 }}>{name}</div>}
        </div>
      </div>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>{children}</div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Done() {
  const who = (new URLSearchParams(window.location.search).get("who") || "").toLowerCase().trim();
  const NAMES = { sean: "Sean", nick: "Nick", ben: "Ben" };
  const valid = who in NAMES;
  const name = NAMES[who] || "";
  const today = useMemo(() => todayISO(), []);

  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!valid) return;
    try {
      const data = await sbGet(
        `container_assignments?assignee=eq.${who}&job_date=gte.${today}` +
        `&order=job_date.asc,assigned_pay.desc` +
        `&select=id,job_date,container_number,piece_count,completed,confirmed,worked_by,container_forecasts(location,scheduled_time)`
      );
      setRows(data);
    } catch { setErr("Couldn't load your jobs — pull to refresh."); }
  }, [who, valid, today]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const markDone = async (id) => {
    setBusyId(id); setErr("");
    try { await sbRpc("set_assignment_completed", { p_assignment_id: id }); await load(); }
    catch { setErr("Couldn't mark that done. Try again."); }
    finally { setBusyId(null); }
  };

  // Sean tags who actually worked the can (drives payroll)
  const setWorker = async (id, whoName) => {
    setBusyId(id); setErr("");
    try { await sbRpc("set_worked_by", { p_assignment_id: id, p_who: whoName }); await load(); }
    catch { setErr("Couldn't set who worked it. Try again."); }
    finally { setBusyId(null); }
  };
  const CREW = ["Sean", "Nick", "Ben"];

  // hooks must run before any early return — groups uses useMemo internally
  const groups = useMemoGroups(rows);

  if (!valid) {
    return (
      <Shell name="">
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, marginTop: 40, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Wrong link</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Use your personal link. It should end in <span style={{ color: GOLD }}>?who=sean</span>, <span style={{ color: GOLD }}>?who=nick</span>, or <span style={{ color: GOLD }}>?who=ben</span>. Text Michael if you don't have it.
          </div>
        </div>
      </Shell>
    );
  }

  // today's counts (no pay shown to crew)
  const todayTotal = (rows || []).filter(r => r.job_date === today).length;
  const todayOpen = (rows || []).filter(r => r.job_date === today && !r.completed).length;

  return (
    <Shell name={name}>
      {/* earnings band */}
      <div style={{ background: "#0a1a0a", border: `1px solid #22c55e40`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: SUCCESS, letterSpacing: "0.18em", marginBottom: 4 }}>TODAY</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{todayTotal} can{todayTotal === 1 ? "" : "s"} <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>· {todayOpen} left</span></div>
      </div>

      {err && <div style={{ background: "#1a0a0a", border: `1px solid ${ERROR}40`, borderRadius: 6, padding: 10, marginBottom: 12, color: ERROR, fontSize: 12 }}>{err}</div>}

      {rows === null && <div style={{ color: MUTED, fontSize: 12 }}>Loading…</div>}
      {rows !== null && rows.length === 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, textAlign: "center", color: MUTED, fontSize: 13 }}>
          No containers assigned to you right now. Check back when Michael sends the next schedule.
        </div>
      )}

      {groups.map(g => (
        <div key={g.date} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: "0.2em", marginTop: 16, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
            {dayLabel(g.date, today)} <span style={{ color: MUTED, marginLeft: 6 }}>· {g.items.length} can{g.items.length === 1 ? "" : "s"}</span>
          </div>
          {g.items.map(r => {
            const fc = r.container_forecasts || {};
            const done = r.completed, busy = busyId === r.id;
            return (
              <div key={r.id} style={{
                background: done ? "#0c0c0a" : CARD,
                border: `1px solid ${done ? "#1a1814" : BORDER}`,
                borderRadius: 10, padding: 14, marginBottom: 10, opacity: done ? 0.55 : 1,
              }}>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: done ? MUTED : GOLD, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", textDecoration: done ? "line-through" : "none" }}>
                    {r.container_number || "(container)"}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
                  {cleanTime(fc.scheduled_time) && <span style={{ color: TEXT }}>{cleanTime(fc.scheduled_time)} · </span>}
                  {r.piece_count} pcs
                  {r.confirmed && <span style={{ color: SUCCESS, marginLeft: 8, fontWeight: 700 }}>✓ CONFIRMED</span>}
                </div>
                {fc.location && (
                  <a href={mapLink(fc.location)} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: GOLD, textDecoration: "none", display: "block", marginBottom: 12 }}>
                    📍 {fc.location}
                  </a>
                )}
                {who === "sean" && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: "0.12em", marginBottom: 5 }}>WORKED BY</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {CREW.map(n => {
                        const active = (r.worked_by || "sean").toLowerCase() === n.toLowerCase();
                        return (
                          <button key={n} onClick={() => setWorker(r.id, n)} disabled={busy}
                            style={{ flex: 1, padding: "9px 0", borderRadius: 6, fontSize: 12, fontWeight: 800,
                              border: `1px solid ${active ? GOLD : BORDER}`, background: active ? "#c9a84c22" : "#080706",
                              color: active ? GOLD : MUTED, cursor: busy ? "wait" : "pointer", fontFamily: "'Barlow', sans-serif" }}>
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!done && (
                  <button onClick={() => markDone(r.id)} disabled={busy}
                    style={{ display: "block", width: "100%", background: busy ? "#5a4a20" : SUCCESS, color: "#05140a",
                      border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 800, fontSize: 14, letterSpacing: "0.08em",
                      cursor: busy ? "wait" : "pointer", fontFamily: "'Barlow', sans-serif", marginTop: 4 }}>
                    {busy ? "SAVING…" : "MARK DONE ✓"}
                  </button>
                )}
                {done && <div style={{ fontSize: 11, color: SUCCESS, fontWeight: 700, letterSpacing: "0.1em" }}>✓ DONE</div>}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: 24, fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.6 }}>
        Tap MARK DONE when a container is fully unloaded.<br />Your pay tallies automatically — paid weekly.
      </div>
    </Shell>
  );
}

// group rows by job_date preserving order, with per-day pay total
function useMemoGroups(rows) {
  return useMemo(() => {
    if (!rows) return [];
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.job_date)) map.set(r.job_date, { date: r.job_date, items: [], pay: 0 });
      const g = map.get(r.job_date);
      g.items.push(r);
      g.pay += Number(r.assigned_pay || 0);
    }
    // within a day: open cans first, done last
    for (const g of map.values()) g.items.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    return Array.from(map.values());
  }, [rows]);
}
