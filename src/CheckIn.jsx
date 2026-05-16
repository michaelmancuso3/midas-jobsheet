import { useState, useEffect, useCallback, useMemo } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ektichcptphekmkhibde.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdGljaGNwdHBoZWtta2hpYmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjU4MDAsImV4cCI6MjA4ODE0MTgwMH0.xbtKl33uVx6KaZd-gxxcUeJqslITWX2b_tfhYhzQDjE";

const STORAGE_KEY = "midas_lead_v1";

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

async function sbRpc(name, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `RPC ${name} failed`);
  }
  return res.json();
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── STYLES (mirrors App.jsx) ─────────────────────────────────────────────────
const GOLD    = "#c9a84c";
const BG      = "#050402";
const CARD    = "#0a0906";
const BORDER  = "#1a1814";
const TEXT    = "#f0ead6";
const MUTED   = "#a89878";
const ERROR   = "#f87171";
const SUCCESS = "#22c55e";

const lbl = { fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: "0.12em", display: "block", marginBottom: 5 };
const inp = (err) => ({
  width: "100%", background: "#080706", border: `1px solid ${err ? ERROR : BORDER}`,
  borderRadius: 5, padding: "10px 12px", color: TEXT, fontSize: 13,
  fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box",
});
const button = (variant = "primary") => ({
  background: variant === "primary" ? GOLD : "transparent",
  color: variant === "primary" ? "#050402" : TEXT,
  border: variant === "primary" ? "none" : `1px solid ${BORDER}`,
  borderRadius: 5, padding: "12px 22px", fontWeight: 800, fontSize: 12,
  letterSpacing: "0.1em", cursor: "pointer",
  fontFamily: "'Barlow', sans-serif",
});

function Shell({ children, lead, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Barlow', sans-serif", color: TEXT }}>
      <div style={{ background: "#0a0906", borderBottom: `1px solid ${BORDER}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>MIDAS INDUSTRIAL SERVICES</div>
            <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: "0.15em" }}>CHECK-IN / CHECK-OUT</div>
          </div>
          {lead && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ fontSize: 11, color: MUTED }}>Lead: <span style={{ color: GOLD }}>{lead.lead_name}</span></div>
              <button onClick={onSignOut} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 9, letterSpacing: "0.12em", cursor: "pointer", padding: 0 }}>SIGN OUT</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>{children}</div>
    </div>
  );
}

// ── SCREEN 1: PIN ENTRY ───────────────────────────────────────────────────────
function PinScreen({ onAuthenticated }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!phone || !pin) {
      setError("Phone and PIN required.");
      return;
    }
    setSubmitting(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const result = await sbRpc("verify_lead_pin", { p_phone: cleanPhone, p_pin: pin });
      if (!result || result.length === 0) {
        setError("Wrong phone or PIN.");
      } else {
        const lead = result[0];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
        onAuthenticated(lead);
      }
    } catch (e) {
      setError("Sign-in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <div style={{ maxWidth: 360, margin: "40px auto 0" }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", marginBottom: 4 }}>LEAD SIGN-IN</div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>Enter your phone number and PIN to start a shift.</div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>PHONE NUMBER</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 4164587014"
              autoComplete="tel"
              style={inp(false)}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN"
              inputMode="numeric"
              autoComplete="current-password"
              style={inp(false)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>

          {error && <div style={{ color: ERROR, fontSize: 11, marginBottom: 14 }}>{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...button("primary"), width: "100%", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "SIGNING IN…" : "SIGN IN"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── SCREEN 2: CONTAINER PICKER ────────────────────────────────────────────────

// job_date is a TEXT column (portal writes YYYY-MM-DD, SMS uses MM.DD.YYYY).
// Parse YYYY-MM-DD as a local-midnight Date so timezone shifting doesn't
// flip the day. Anything else falls into the "OTHER" bucket.
function parseJobDate(raw) {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(raw).trim());
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

const DOW   = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayBucket(date, today) {
  if (!date) return { key: "OTHER", label: "OTHER · DATE UNKNOWN", order: 99999 };
  const diff = Math.round((date - today) / 86400000);
  const dateStr = `${MONTH[date.getMonth()]} ${date.getDate()}`;
  if (diff === 0) return { key: `D-${date.getTime()}`, label: `TODAY · ${dateStr}`,    order: 0 };
  if (diff === 1) return { key: `D-${date.getTime()}`, label: `TOMORROW · ${dateStr}`, order: 1 };
  if (diff <  0)  return { key: `D-${date.getTime()}`, label: `PAST · ${dateStr}`,     order: -10000 + diff };
  return            { key: `D-${date.getTime()}`, label: `${DOW[date.getDay()]} · ${dateStr}`, order: diff };
}

function ContainerPicker({ lead, onSelect, onSignOut }) {
  const [forecasts, setForecasts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await sbGet(
          "container_forecasts?status=eq.pending&order=job_date.asc.nullslast,created_at.asc&select=id,container_number,account_name,customer_notes,created_at,job_date&limit=50"
        );
        if (!cancelled) setForecasts(data);
      } catch (e) {
        if (!cancelled) setError("Could not load active containers.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const grouped = useMemo(() => {
    if (!forecasts) return null;
    const map = new Map();
    for (const f of forecasts) {
      const d = parseJobDate(f.job_date);
      const b = dayBucket(d, today);
      // Hide past-dated forecasts — they're stale pending records and not
      // jobs Mikey needs to check anyone in for. Today + future + OTHER only.
      if (b.order < 0) continue;
      if (!map.has(b.key)) map.set(b.key, { ...b, items: [] });
      map.get(b.key).items.push(f);
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [forecasts, today]);

  return (
    <Shell lead={lead} onSignOut={onSignOut}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>PICK A CONTAINER</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Grouped by job date. Tap one to start checking lumpers in.</div>
      </div>

      {error && <div style={{ color: ERROR, fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {grouped === null && <div style={{ color: MUTED, fontSize: 12 }}>Loading…</div>}

      {grouped !== null && grouped.length === 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
          <div style={{ color: MUTED, fontSize: 12 }}>No active container forecasts. Have the office submit one from the customer portal first.</div>
        </div>
      )}

      {grouped && grouped.map((g) => (
        <div key={g.key} style={{ marginBottom: 4 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: "0.2em",
            marginTop: 16, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}`,
          }}>
            {g.label} <span style={{ color: MUTED, marginLeft: 6 }}>({g.items.length})</span>
          </div>
          {g.items.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
                padding: 16, marginBottom: 10, cursor: "pointer",
                color: TEXT, fontFamily: "'Barlow', sans-serif",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: GOLD, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>
                  {f.container_number || "(no container #)"}
                </div>
                {f.account_name && (
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.account_name}</div>
                )}
              </div>
              {f.customer_notes && (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{f.customer_notes}</div>
              )}
            </button>
          ))}
        </div>
      ))}
    </Shell>
  );
}

// ── SCREEN 3: ROSTER + LIVE STATUS ────────────────────────────────────────────
function RosterScreen({ lead, forecast, onBack, onSignOut }) {
  const [lumpers, setLumpers] = useState(null);
  const [currentlyIn, setCurrentlyIn] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  // Reload lumpers + currently-in status
  const refresh = useCallback(async () => {
    try {
      const [lumperData, inData] = await Promise.all([
        sbGet("lumpers?active=eq.true&select=id,full_name,is_lead,default_rate&order=full_name.asc"),
        sbGet(`currently_checked_in?forecast_id=eq.${forecast.id}&select=*`),
      ]);
      setLumpers(lumperData);
      setCurrentlyIn(inData);
    } catch (e) {
      setError("Could not load roster.");
    }
  }, [forecast.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tick every 30s so "Xm in" stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const isCheckedIn = (lumperId) => currentlyIn.find((c) => c.lumper_id === lumperId);

  const handleToggle = async (lumper) => {
    setError("");
    const existing = isCheckedIn(lumper.id);
    setPendingId(lumper.id);
    try {
      if (existing) {
        // Confirm check-out
        const ok = window.confirm(`Check OUT ${lumper.full_name}?`);
        if (!ok) { setPendingId(null); return; }
        await sbRpc("lumper_check_out", {
          p_lead_id: lead.lead_id,
          p_lumper_id: lumper.id,
          p_forecast_id: forecast.id,
        });
      } else {
        await sbRpc("lumper_check_in", {
          p_lead_id: lead.lead_id,
          p_lumper_id: lumper.id,
          p_forecast_id: forecast.id,
        });
      }
      await refresh();
    } catch (e) {
      const msg = String(e.message || "");
      if (msg.includes("already_checked_in_elsewhere")) {
        setError(`${lumper.full_name} is already checked in to a different container. Check them out there first.`);
      } else if (msg.includes("no_open_punch")) {
        setError(`${lumper.full_name} has no open check-in on this container.`);
      } else {
        setError("Action failed. Try again.");
      }
    } finally {
      setPendingId(null);
    }
  };

  const fmtMinutes = (mins) => {
    if (mins == null) return "";
    const m = Math.floor(mins);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  };

  return (
    <Shell lead={lead} onSignOut={onSignOut}>
      <button onClick={onBack} style={{ ...button("secondary"), marginBottom: 14, fontSize: 10, padding: "8px 14px" }}>
        ← BACK TO CONTAINERS
      </button>

      {/* Container header */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: GOLD, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>
            {forecast.container_number}
          </div>
          {forecast.account_name && (
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {forecast.account_name}
            </div>
          )}
        </div>
      </div>

      {/* Currently in panel */}
      <div style={{
        background: currentlyIn.length > 0 ? "#0a1a0a" : CARD,
        border: `1px solid ${currentlyIn.length > 0 ? "#22c55e40" : BORDER}`,
        borderRadius: 10, padding: 14, marginBottom: 14,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: currentlyIn.length > 0 ? SUCCESS : MUTED, letterSpacing: "0.15em", marginBottom: 8 }}>
          CURRENTLY IN ({currentlyIn.length})
        </div>
        {currentlyIn.length === 0 ? (
          <div style={{ fontSize: 11, color: MUTED }}>Nobody checked in yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {currentlyIn.map((c) => (
              <div key={c.punch_id} style={{
                background: "#22c55e18", border: `1px solid #22c55e40`,
                borderRadius: 4, padding: "4px 10px", fontSize: 11, color: TEXT,
              }}>
                {c.lumper_name} <span style={{ color: MUTED, marginLeft: 4 }}>{fmtMinutes(c.minutes_in)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "#1a0a0a", border: `1px solid ${ERROR}40`, borderRadius: 6, padding: 10, marginBottom: 12, color: ERROR, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Roster */}
      <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: "0.2em", marginBottom: 8, marginTop: 4 }}>
        ROSTER
      </div>

      {lumpers === null && <div style={{ color: MUTED, fontSize: 12 }}>Loading…</div>}

      {lumpers && lumpers.map((l) => {
        const inHere = isCheckedIn(l.id);
        const isPending = pendingId === l.id;
        return (
          <button
            key={l.id}
            onClick={() => handleToggle(l)}
            disabled={isPending}
            style={{
              display: "block", width: "100%", textAlign: "left",
              background: inHere ? "#22c55e10" : CARD,
              border: `1px solid ${inHere ? "#22c55e40" : BORDER}`,
              borderRadius: 10, padding: 14, marginBottom: 8,
              cursor: isPending ? "wait" : "pointer", color: TEXT,
              fontFamily: "'Barlow', sans-serif",
              opacity: isPending ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                  {l.full_name}
                  {l.is_lead && <span style={{ fontSize: 9, color: GOLD, letterSpacing: "0.1em", marginLeft: 8 }}>LEAD</span>}
                </div>
                {inHere && (
                  <div style={{ fontSize: 10, color: SUCCESS, marginTop: 2 }}>
                    IN · {fmtMinutes(inHere.minutes_in)}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                padding: "6px 12px", borderRadius: 4,
                background: inHere ? ERROR : GOLD,
                color: inHere ? "#fff" : "#050402",
              }}>
                {inHere ? "CHECK OUT" : "CHECK IN"}
              </div>
            </div>
          </button>
        );
      })}

      <div style={{ marginTop: 24, fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.6 }}>
        Hours are calculated from check-in to check-out and feed payroll automatically.<br />
        When the container closes, anyone still checked in is auto-stamped at end-of-container.
      </div>
    </Shell>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function CheckIn() {
  const [lead, setLead] = useState(null);
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLead(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLead(null);
    setForecast(null);
  };

  if (!lead) return <PinScreen onAuthenticated={setLead} />;
  if (!forecast) return <ContainerPicker lead={lead} onSelect={setForecast} onSignOut={handleSignOut} />;
  return <RosterScreen lead={lead} forecast={forecast} onBack={() => setForecast(null)} onSignOut={handleSignOut} />;
}
