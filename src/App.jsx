import { useState, useRef, useEffect, useCallback } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ektichcptphekmkhibde.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdGljaGNwdHBoZWtta2hpYmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjU4MDAsImV4cCI6MjA4ODE0MTgwMH0.xbtKl33uVx6KaZd-gxxcUeJqslITWX2b_tfhYhzQDjE";

const supabase = {
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
};

// ── RATE CALCULATOR ───────────────────────────────────────────────────────────
function calcInvoice(sheet) {
  const pieces = parseInt(sheet.pieceCount) || 0;
  let base = 0;
  if      (pieces <= 1699)  base = 210;
  else if (pieces <= 1849)  base = 235;
  else if (pieces <= 2499)  base = 260;
  else if (pieces <= 3499)  base = 280;
  else if (pieces <= 4999)  base = 320;
  else if (pieces <= 6499)  base = 450;
  else if (pieces <= 7999)  base = 525;
  else if (pieces <= 8999)  base = 620;
  else                       base = 720;

  const isWeekend = sheet.isWeekend === "yes";
  const baseCharge = isWeekend ? base * 1.5 : base;

  let accessorials = 0;
  if (sheet.loadType === "highcube_tipped_mixed") accessorials += 80;
  if (sheet.loadType === "fully_tipped_mixed")    accessorials += 100;
  if (sheet.productWeight === "heavy")            accessorials += 80;
  if (sheet.productWeight === "super_heavy")      accessorials += 110;

  const extraSKUs = Math.max(0, (parseInt(sheet.skuCount) || 0) - 10);
  const skuCharge = extraSKUs * 15;

  // Wait time: $30/hr/lumper after first hour
  const waitMins = parseInt(sheet.waitMinutes) || 0;
  const lumpers  = parseInt(sheet.lumperCount) || 2;
  const billableWaitHrs = Math.max(0, (waitMins - 60) / 60);
  const waitCharge = Math.round(billableWaitHrs * 30 * lumpers * 100) / 100;

  // Cancellation
  const cancelCharge = sheet.wasCancelled === "yes" ? 120 : 0;

  const subtotal = baseCharge + accessorials + skuCharge + waitCharge + cancelCharge;
  const hst = Math.round(subtotal * 0.13 * 100) / 100;
  const total = Math.round((subtotal + hst) * 100) / 100;

  // Build accessorial list for invoice email
  const accessorialList = [];
  if (sheet.loadType === "highcube_tipped_mixed") accessorialList.push("Highcube / Tipped / Mixed load (+$80)");
  if (sheet.loadType === "fully_tipped_mixed") accessorialList.push("Fully Tipped / Mixed load (+$100)");
  if (sheet.productWeight === "heavy") accessorialList.push("Heavy product 45lbs+ (+$80)");
  if (sheet.productWeight === "super_heavy") accessorialList.push("Super Heavy 100lbs+ (+$110)");
  if (extraSKUs > 0) accessorialList.push(`Extra SKUs: ${extraSKUs} × $15`);
  if (sheet.isWeekend === "yes") accessorialList.push("Weekend / Holiday rate (1.5×)");
  if (sheet.wasCancelled === "yes") accessorialList.push("Same-day cancellation fee ($120)");

  return { base, baseCharge, accessorials, skuCharge, waitCharge, cancelCharge, subtotal, hst, total, pieces, accessorialList, waitHours: billableWaitHrs };
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const GOLD = "#c9a84c";
const BG   = "#050402";
const CARD = "#0a0906";
const BORDER = "#1a1814";
const TEXT  = "#f0ead6";
const MUTED = "#a89878";
const ERROR = "#f87171";

const inp = (err) => ({
  width: "100%", background: "#080706", border: `1px solid ${err ? ERROR : BORDER}`,
  borderRadius: 5, padding: "10px 12px", color: TEXT, fontSize: 13,
  fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box",
});

const lbl = { fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: "0.12em", display: "block", marginBottom: 5 };
const section = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 16 };
const sectionTitle = { fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: "0.2em", marginBottom: 14, borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", required, err }) {
  return (
    <Field label={`${label}${required ? " *" : ""}`}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inp(err)} />
      {err && <div style={{ color: ERROR, fontSize: 10, marginTop: 3 }}>Required</div>}
    </Field>
  );
}

function Select({ label, value, onChange, options, required, err }) {
  return (
    <Field label={`${label}${required ? " *" : ""}`}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inp(err), background: "#080706" }}>
        <option value="">— Select —</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {err && <div style={{ color: ERROR, fontSize: 10, marginTop: 3 }}>Required</div>}
    </Field>
  );
}

function Radio({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {options.map(([v, l]) => (
          <label key={v} onClick={() => onChange(v)}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              background: value === v ? "#c9a84c18" : "#080706",
              border: `1px solid ${value === v ? GOLD : BORDER}`,
              borderRadius: 5, padding: "7px 12px", fontSize: 12, color: value === v ? GOLD : MUTED,
              transition: "all 0.15s" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${value === v ? GOLD : "#3a3028"}`,
              background: value === v ? GOLD : "transparent", transition: "all 0.15s" }} />
            {l}
          </label>
        ))}
      </div>
    </Field>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

// ── SIGNATURE PAD ─────────────────────────────────────────────────────────────
function SignaturePad({ value, onChange, error, label }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    setDrawing(true);
    lastPos.current = pos;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#C9A84C";
    ctx.fill();
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#C9A84C";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
    onChange(canvas.toDataURL("image/png"));
  };

  const stopDraw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
    lastPos.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange("");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#5a5040", letterSpacing: "0.12em", marginBottom: 6, textTransform: "uppercase" }}>{label} *</div>
      <div style={{ position: "relative", border: `1px solid ${error ? "#f87171" : hasSignature ? "#C9A84C" : "#1e1c18"}`, borderRadius: 6, background: "#060504", overflow: "hidden", transition: "border-color 0.2s" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          style={{ width: "100%", height: 150, display: "block", touchAction: "none", cursor: "crosshair" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {!hasSignature && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", color: "#2a2218", fontSize: 12, fontFamily: "\'Barlow\',sans-serif", textAlign: "center" }}>
            Sign here with your finger or mouse
          </div>
        )}
        {hasSignature && (
          <button onClick={clear} style={{ position: "absolute", top: 8, right: 8, background: "#1a1814", border: "1px solid #2a2218", color: "#5a5040", borderRadius: 4, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: "\'Barlow\',sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
            CLEAR
          </button>
        )}
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 10, marginTop: 3 }}>Required</div>}
      {hasSignature && <div style={{ fontSize: 9, color: "#3a3028", marginTop: 4 }}>Signed · {new Date().toLocaleDateString("en-CA", { year:"numeric", month:"long", day:"numeric" })}</div>}
    </div>
  );
}

export default function JobSheet() {
  const [step, setStep] = useState(0); // 0=form, 1=review, 2=sign, 3=done
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [sheet, setSheet] = useState({
    // Job info
    clientName: "", facilityAddress: "", jobDate: new Date().toISOString().split("T")[0],
    crewStartTime: "", crewEndTime: "",
    // Container
    containerNumber: "", probillNumber: "", pieceCount: "", skuCount: "10",
    // Load type
    loadType: "standard", productWeight: "standard",
    isWeekend: "no",
    // Crew
    lumperCount: "2", lumperNames: "",
    // Wait time
    hasWaitTime: "no", waitMinutes: "0", waitCause: "",
    // Cancellation
    wasCancelled: "no",
    // Discrepancies
    hasDiscrepancy: "no", discrepancyNotes: "",
    // Sign off
    supervisorName: "", supervisorSignature: "", lumperSignature: "",
    notes: "",
  });

  const set = (k) => (v) => setSheet(prev => ({ ...prev, [k]: v }));

  const calc = calcInvoice(sheet);

  const validate = () => {
    const e = {};
    if (!sheet.clientName)        e.clientName = true;
    if (!sheet.facilityAddress)   e.facilityAddress = true;
    if (!sheet.jobDate)           e.jobDate = true;
    if (!sheet.crewStartTime)     e.crewStartTime = true;
    if (!sheet.containerNumber)   e.containerNumber = true;
    if (!sheet.probillNumber)     e.probillNumber = true;
    if (!sheet.pieceCount)        e.pieceCount = true;
    if (!sheet.lumperNames)       e.lumperNames = true;
    if (sheet.hasWaitTime === "yes" && !sheet.waitCause) e.waitCause = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateSign = () => {
    const e = {};
    if (!sheet.supervisorName)      e.supervisorName = true;
    if (!sheet.supervisorSignature) e.supervisorSignature = true;
    if (!sheet.lumperSignature)     e.lumperSignature = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateSign()) return;
    setSubmitting(true);
    try {
      await supabase.insert("job_sheets", {
        client_name: sheet.clientName,
        facility_address: sheet.facilityAddress,
        job_date: sheet.jobDate,
        crew_start_time: sheet.crewStartTime,
        crew_end_time: sheet.crewEndTime,
        container_number: sheet.containerNumber,
        probill_number: sheet.probillNumber,
        piece_count: parseInt(sheet.pieceCount) || 0,
        sku_count: parseInt(sheet.skuCount) || 0,
        load_type: sheet.loadType,
        product_weight: sheet.productWeight,
        is_weekend: sheet.isWeekend === "yes",
        lumper_count: parseInt(sheet.lumperCount) || 2,
        lumper_names: sheet.lumperNames,
        has_wait_time: sheet.hasWaitTime === "yes",
        wait_minutes: parseInt(sheet.waitMinutes) || 0,
        wait_cause: sheet.waitCause,
        was_cancelled: sheet.wasCancelled === "yes",
        has_discrepancy: sheet.hasDiscrepancy === "yes",
        discrepancy_notes: sheet.discrepancyNotes,
        supervisor_name: sheet.supervisorName,
        supervisor_signature: sheet.supervisorSignature,
        lumper_signature: sheet.lumperSignature,
        notes: sheet.notes,
        // Calculated invoice fields
        base_charge: calc.baseCharge,
        accessorial_charge: calc.accessorials,
        sku_charge: calc.skuCharge,
        wait_charge: calc.waitCharge,
        cancel_charge: calc.cancelCharge,
        subtotal: calc.subtotal,
        hst: calc.hst,
        total: calc.total,
        invoice_status: "pending",
        created_at: new Date().toISOString(),
      });

      // Look up client billing email by matching company name
      let clientEmail = "michael@midasindustrialservices.com"; // fallback
      try {
        const clientRes = await fetch(
          `${SUPABASE_URL}/rest/v1/client_accounts?company_name=ilike.*${encodeURIComponent(sheet.clientName.trim())}*&select=email,billing_email&limit=1`,
          { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        const clients = await clientRes.json();
        if (clients && clients.length > 0) {
          clientEmail = clients[0].billing_email || clients[0].email || clientEmail;
        }
      } catch {}

      // Send invoice email — then update invoice_status to "sent"
      try {
        const invoiceRes = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            client_email: clientEmail,
            company_name: sheet.clientName,
            probill: sheet.probillNumber,
            container_ref: sheet.containerNumber,
            location: sheet.facilityAddress,
            job_date: sheet.jobDate,
            piece_count: parseInt(sheet.pieceCount) || 0,
            sku_count: parseInt(sheet.skuCount) || 0,
            base_rate: calc.baseCharge,
            accessorials: calc.accessorialList || [],
            accessorial_total: calc.accessorials,
            wait_time_hours: calc.waitHours || 0,
            wait_time_lumpers: parseInt(sheet.lumperCount) || 2,
            wait_time_charge: calc.waitCharge,
            subtotal: calc.subtotal,
            hst: calc.hst,
            total: calc.total,
            supervisor_name: sheet.supervisorName,
            notes: sheet.notes,
          }),
        });
        // If invoice sent successfully, update status in job_sheets
        if (invoiceRes.ok) {
          const latestJob = await fetch(
            `${SUPABASE_URL}/rest/v1/job_sheets?client_name=ilike.*${encodeURIComponent(sheet.clientName.trim())}*&container_number=eq.${encodeURIComponent(sheet.containerNumber)}&order=created_at.desc&limit=1&select=id`,
            { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
          );
          const jobs = await latestJob.json();
          if (jobs && jobs.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/job_sheets?id=eq.${jobs[0].id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({
                invoice_status: "sent",
                invoiced_at: new Date().toISOString(),
              }),
            });
          }
        }
      } catch {}

      // Mark the container forecast as completed so the SMS webhook
      // doesn't pick it up again when workers reply YES to future shifts
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/container_forecasts?container_number=eq.${encodeURIComponent(sheet.containerNumber)}&status=eq.pending`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ status: "completed" }),
          }
        );
      } catch {}

      setStep(3);
    } catch (err) {
      alert("Submission failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── DONE SCREEN ──
  if (step === 3) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", marginBottom: 8 }}>JOB SHEET SUBMITTED</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 24, lineHeight: 1.7 }}>
          Container <strong style={{ color: GOLD }}>{sheet.containerNumber}</strong> — {sheet.probillNumber}<br />
          <strong style={{ color: GOLD }}>{sheet.pieceCount}</strong> pieces confirmed<br />
          Invoice total: <strong style={{ color: GOLD }}>${calc.total.toFixed(2)}</strong>
        </div>
        <button onClick={() => { setStep(0); setSheet({ clientName:"",facilityAddress:"",jobDate:new Date().toISOString().split("T")[0],crewStartTime:"",crewEndTime:"",containerNumber:"",probillNumber:"",pieceCount:"",skuCount:"10",loadType:"standard",productWeight:"standard",isWeekend:"no",lumperCount:"2",lumperNames:"",hasWaitTime:"no",waitMinutes:"0",waitCause:"",wasCancelled:"no",hasDiscrepancy:"no",discrepancyNotes:"",supervisorName:"",supervisorSignature:"",lumperSignature:"",notes:"" }); setErrors({}); }}
          style={{ background: GOLD, color: "#050402", border: "none", borderRadius: 5, padding: "12px 28px", fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: "0.1em" }}>
          NEW JOB SHEET
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Barlow', sans-serif", color: TEXT }}>
      {/* Header */}
      <div style={{ background: "#0a0906", borderBottom: `1px solid ${BORDER}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>MIDAS INDUSTRIAL SERVICES</div>
            <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: "0.15em" }}>DIGITAL JOB SHEET</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["JOB INFO", "REVIEW", "SIGN OFF"].map((s, i) => (
              <div key={s} style={{ fontSize: 8, fontWeight: 700, color: step >= i ? GOLD : "#2a2820",
                letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 3,
                background: step === i ? "#c9a84c18" : "transparent",
                border: `1px solid ${step >= i ? "#c9a84c40" : "#1a1814"}` }}>{s}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── STEP 0: JOB INFO ── */}
        {step === 0 && <>
          <div style={section}>
            <div style={sectionTitle}>📋 JOB INFORMATION</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Client Name" value={sheet.clientName} onChange={set("clientName")} required err={errors.clientName} placeholder="Proactive Supply Chain" />
              <Input label="Job Date" value={sheet.jobDate} onChange={set("jobDate")} type="date" required err={errors.jobDate} />
            </div>
            <Input label="Facility Address" value={sheet.facilityAddress} onChange={set("facilityAddress")} required err={errors.facilityAddress} placeholder="123 Dock Rd, Brampton ON" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Crew Start Time" value={sheet.crewStartTime} onChange={set("crewStartTime")} type="time" required err={errors.crewStartTime} />
              <Input label="Crew End Time" value={sheet.crewEndTime} onChange={set("crewEndTime")} type="time" />
            </div>
          </div>

          <div style={section}>
            <div style={sectionTitle}>📦 CONTAINER DETAILS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Container Number" value={sheet.containerNumber} onChange={set("containerNumber")} required err={errors.containerNumber} placeholder="EGSU6155752" />
              <Input label="Probill / Receipt #" value={sheet.probillNumber} onChange={set("probillNumber")} required err={errors.probillNumber} placeholder="N4246" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Piece Count (confirmed)" value={sheet.pieceCount} onChange={set("pieceCount")} type="number" required err={errors.pieceCount} placeholder="1651" />
              <Input label="Number of SKUs" value={sheet.skuCount} onChange={set("skuCount")} type="number" placeholder="10" />
            </div>
            <Radio label="Load Type" value={sheet.loadType} onChange={set("loadType")} options={[
              ["standard", "Standard"], ["highcube_tipped_mixed", "High-cube / Tipped / Mixed (+$80)"],
              ["fully_tipped_mixed", "Fully Tipped / Fully Mixed (+$100)"]
            ]} />
            <Radio label="Product Weight" value={sheet.productWeight} onChange={set("productWeight")} options={[
              ["standard", "Standard"], ["heavy", "Heavy 45lbs+ (+$80)"], ["super_heavy", "Super Heavy 100lbs+ (+$110)"]
            ]} />
            <Radio label="Weekend / Holiday?" value={sheet.isWeekend} onChange={set("isWeekend")} options={[["no", "No"], ["yes", "Yes (1.5x rate)"]]} />
          </div>

          <div style={section}>
            <div style={sectionTitle}>👷 CREW</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Number of Lumpers" value={sheet.lumperCount} onChange={set("lumperCount")} options={[["1","1"],["2","2"],["3","3"],["4","4"],["5","5"]]} />
            </div>
            <Input label="Lumper Names" value={sheet.lumperNames} onChange={set("lumperNames")} required err={errors.lumperNames} placeholder="John Smith, Marcus Brown" />
          </div>

          <div style={section}>
            <div style={sectionTitle}>⏱ WAIT TIME</div>
            <Radio label="Was there wait time?" value={sheet.hasWaitTime} onChange={set("hasWaitTime")} options={[["no", "No"], ["yes", "Yes"]]} />
            {sheet.hasWaitTime === "yes" && <>
              <Input label="Total Wait Time (minutes)" value={sheet.waitMinutes} onChange={set("waitMinutes")} type="number" placeholder="90" />
              <div style={{ background: "#0a0906", border: `1px solid ${GOLD}30`, borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11, color: MUTED }}>
                First 60 min free · Billable: <strong style={{ color: GOLD }}>{Math.max(0, (parseInt(sheet.waitMinutes)||0) - 60)} min</strong> × $30/hr × {sheet.lumperCount} lumpers = <strong style={{ color: GOLD }}>${calc.waitCharge.toFixed(2)}</strong>
              </div>
              <Input label="Cause of Wait Time" value={sheet.waitCause} onChange={set("waitCause")} err={errors.waitCause} placeholder="Late container arrival / No pallets / Equipment delay" />
            </>}
          </div>

          <div style={section}>
            <div style={sectionTitle}>❌ CANCELLATION & DISCREPANCIES</div>
            <Radio label="Same-day cancellation?" value={sheet.wasCancelled} onChange={set("wasCancelled")} options={[["no", "No"], ["yes", "Yes (+$120)"]]} />
            <Radio label="Inventory discrepancy?" value={sheet.hasDiscrepancy} onChange={set("hasDiscrepancy")} options={[["no", "No"], ["yes", "Yes — note below"]]} />
            {sheet.hasDiscrepancy === "yes" && (
              <Field label="Discrepancy Notes">
                <textarea value={sheet.discrepancyNotes} onChange={e => set("discrepancyNotes")(e.target.value)}
                  placeholder="Short count on SKU #4, 12 units missing. Client supervisor notified."
                  style={{ ...inp(false), resize: "vertical", minHeight: 70, lineHeight: 1.6 }} />
              </Field>
            )}
            <Field label="Additional Notes">
              <textarea value={sheet.notes} onChange={e => set("notes")(e.target.value)}
                placeholder="Any other relevant information..."
                style={{ ...inp(false), resize: "vertical", minHeight: 60, lineHeight: 1.6 }} />
            </Field>
          </div>

          <button onClick={() => { if (validate()) setStep(1); }}
            style={{ width: "100%", background: GOLD, color: "#050402", border: "none", borderRadius: 6,
              padding: "14px 0", fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: "0.1em",
              fontFamily: "'Barlow', sans-serif" }}>
            REVIEW & CALCULATE →
          </button>
        </>}

        {/* ── STEP 1: REVIEW ── */}
        {step === 1 && <>
          <div style={section}>
            <div style={sectionTitle}>💰 INVOICE BREAKDOWN</div>
            {[
              ["Base rate (" + calc.pieces.toLocaleString() + " pieces)", `$${calc.base.toFixed(2)}`],
              sheet.isWeekend === "yes" ? ["Weekend / holiday (1.5×)", `$${(calc.baseCharge - calc.base).toFixed(2)}`] : null,
              calc.accessorials > 0 ? ["Accessorial charge", `$${calc.accessorials.toFixed(2)}`] : null,
              calc.skuCharge > 0 ? [`Extra SKUs (${Math.max(0,(parseInt(sheet.skuCount)||0)-10)} × $15)`, `$${calc.skuCharge.toFixed(2)}`] : null,
              calc.waitCharge > 0 ? ["Wait time charge", `$${calc.waitCharge.toFixed(2)}`] : null,
              calc.cancelCharge > 0 ? ["Cancellation fee", `$${calc.cancelCharge.toFixed(2)}`] : null,
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
                <span style={{ color: MUTED }}>{k}</span>
                <span style={{ color: TEXT }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
              <span style={{ color: MUTED }}>Subtotal</span>
              <span style={{ color: TEXT }}>${calc.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
              <span style={{ color: MUTED }}>HST (13%)</span>
              <span style={{ color: TEXT }}>${calc.hst.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontSize: 16, fontWeight: 800 }}>
              <span style={{ color: GOLD }}>TOTAL</span>
              <span style={{ color: GOLD }}>${calc.total.toFixed(2)}</span>
            </div>
          </div>

          <div style={section}>
            <div style={sectionTitle}>📋 JOB SUMMARY</div>
            {[
              ["Client", sheet.clientName],
              ["Date", sheet.jobDate],
              ["Container #", sheet.containerNumber],
              ["Probill #", sheet.probillNumber],
              ["Piece Count", sheet.pieceCount],
              ["SKUs", sheet.skuCount],
              ["Crew", `${sheet.lumperCount} lumpers — ${sheet.lumperNames}`],
              ["Load Type", sheet.loadType],
              ["Wait Time", sheet.hasWaitTime === "yes" ? `${sheet.waitMinutes} min (${sheet.waitCause})` : "None"],
              ["Cancellation", sheet.wasCancelled === "yes" ? "Yes" : "No"],
              ["Discrepancy", sheet.hasDiscrepancy === "yes" ? sheet.discrepancyNotes : "None"],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>
                <span style={{ color: MUTED, minWidth: 110 }}>{k}</span>
                <span style={{ color: TEXT, textAlign: "right", maxWidth: 280 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => setStep(0)}
              style={{ background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 6,
                padding: "13px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: "0.08em" }}>
              ← EDIT
            </button>
            <button onClick={() => setStep(2)}
              style={{ background: GOLD, color: "#050402", border: "none", borderRadius: 6,
                padding: "13px 0", fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: "0.1em" }}>
              SIGN OFF →
            </button>
          </div>
        </>}

        {/* ── STEP 2: SIGN OFF ── */}
        {step === 2 && <>
          <div style={section}>
            <div style={sectionTitle}>✍️ CLIENT SIGN OFF</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
              By signing below, the client supervisor confirms the piece count of <strong style={{ color: GOLD }}>{sheet.pieceCount} pieces</strong> for container <strong style={{ color: GOLD }}>{sheet.containerNumber}</strong> and authorizes billing of <strong style={{ color: GOLD }}>${calc.total.toFixed(2)}</strong>.
            </div>
            <Input label="Client Supervisor Name" value={sheet.supervisorName} onChange={set("supervisorName")} required err={errors.supervisorName} placeholder="Jane Smith" />
            <SignaturePad
              label="Client Supervisor Signature"
              value={sheet.supervisorSignature}
              onChange={val => set("supervisorSignature")(val)}
              error={errors.supervisorSignature}
            />
          </div>

          <div style={section}>
            <div style={sectionTitle}>✍️ LUMPER LEAD SIGN OFF</div>
            <SignaturePad
              label="Lead Lumper Signature"
              value={sheet.lumperSignature}
              onChange={val => set("lumperSignature")(val)}
              error={errors.lumperSignature}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => setStep(1)}
              style={{ background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 6,
                padding: "13px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: "0.08em" }}>
              ← BACK
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ background: submitting ? "#5a4a20" : GOLD, color: "#050402", border: "none", borderRadius: 6,
                padding: "13px 0", fontWeight: 800, fontSize: 13, cursor: submitting ? "not-allowed" : "pointer",
                letterSpacing: "0.1em", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "SUBMITTING..." : "SUBMIT JOB SHEET ✓"}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}
