import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  CATEGORIES, SEVERITIES, SEVERITY_META, STAGES, NAV_ITEMS, SOURCES, ROLES,
  SEED_REQUESTS, SEED_ORGS, capColor, orgCap, orgNote, timeAgo, nextIdFrom,
  loadStoredSession, saveStoredSession,
} from "./lib.js";
import LoginScreen from "./LoginScreen.jsx";
import NearbyResourcesMap from "./NearbyResourcesMap.jsx";

/* ---------------------------------------------------------
   RELIEFMESH — "old style" build (now functional)
   Table layout, beveled buttons, Verdana/Times, navy+gray.
   Built like a late-90s / early-2000s county emergency-
   services site, wired up with real interactive state:
   login, intake form, mission approval workflow, resource
   registry, audit trail, search/severity filtering, live
   timestamps, and a live nearby-resources map.
--------------------------------------------------------- */

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.id, r.label]));

export default function App() {
  const [session, setSession] = useState(() => loadStoredSession());
  const [role, setRole] = useState(() => loadStoredSession()?.role || "commander");
  const [view, setView] = useState("dashboard");
  const [activeCats, setActiveCats] = useState([]);
  const [activeSevs, setActiveSevs] = useState([]);
  const [showResolved, setShowResolved] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(SEED_REQUESTS[0].id);
  const [requests, setRequests] = useState(SEED_REQUESTS);
  const [orgs, setOrgs] = useState(SEED_ORGS);
  const [audit, setAudit] = useState([
    { id: "a0", ts: Date.now(), actor: "system", text: "ReliefMesh console initialized for Cedar County incident." },
  ]);
  const [now, setNow] = useState(Date.now());
  const [fieldUpdateFor, setFieldUpdateFor] = useState(null);
  const [fieldUpdateText, setFieldUpdateText] = useState("");
  const [intakeMsg, setIntakeMsg] = useState("");

  // Keep "time ago" labels live without needing a page refresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const logAudit = useCallback((text, actorOverride) => {
    setAudit((prev) => [{ id: `a${prev.length}-${Date.now()}`, ts: Date.now(), actor: actorOverride || role, text }, ...prev]);
  }, [role]);

  const handleLogin = ({ name, email, role: loginRole, remember }) => {
    const newSession = { name, email, role: loginRole };
    setSession(newSession);
    setRole(loginRole);
    saveStoredSession(remember ? newSession : null);
    logAudit(`${name} logged in as ${ROLE_LABEL[loginRole]}.`, loginRole);
  };

  const handleLogout = () => {
    if (session) logAudit(`${session.name} logged out.`, session.role);
    setSession(null);
    saveStoredSession(null);
  };

  const toggleCat = (id) =>
    setActiveCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const toggleSev = (id) =>
    setActiveSevs((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const visibleRequests = useMemo(() => {
    return requests.filter((r) => {
      if (!showResolved && r.resolved) return false;
      if (activeCats.length && !activeCats.includes(r.category)) return false;
      if (activeSevs.length && !activeSevs.includes(r.severity)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !r.loc.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [requests, activeCats, activeSevs, showResolved, search]);

  const filtered = useMemo(() => {
    const order = { critical: 0, high: 1, medium: 2 };
    return [...visibleRequests].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [visibleRequests]);

  const selectedReq = requests.find((r) => r.id === selected) || requests[0];

  const pendingApprovals = requests.filter((r) => !r.resolved && r.stage < 3).length;
  const mergedClusters = requests.filter((r) => r.note && r.note.toLowerCase().includes("merged")).length;
  const nearCapacityOrgs = orgs.filter((o) => orgCap(o) > 85).length;

  const advanceStage = (id) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.resolved) return r;
        if (r.stage >= STAGES.length - 1) {
          logAudit(`Marked ${r.id} resolved after dispatch.`);
          return { ...r, resolved: true };
        }
        const nextStage = r.stage + 1;
        logAudit(`Advanced ${r.id} to "${STAGES[nextStage]}".`);
        return { ...r, stage: nextStage };
      })
    );
  };

  const acknowledge = (id) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, acknowledged: true } : r)));
    logAudit(`Acknowledged assignment for ${id}.`);
  };

  const openFieldUpdate = (id) => {
    setFieldUpdateFor(id);
    setFieldUpdateText("");
  };

  const submitFieldUpdate = () => {
    if (!fieldUpdateFor || !fieldUpdateText.trim()) return;
    setRequests((prev) =>
      prev.map((r) => (r.id === fieldUpdateFor ? { ...r, note: fieldUpdateText.trim() } : r))
    );
    logAudit(`Field update submitted for ${fieldUpdateFor}: "${fieldUpdateText.trim()}"`);
    setFieldUpdateFor(null);
    setFieldUpdateText("");
  };

  const primaryAction = (r) => {
    if (r.resolved) return;
    if (role === "commander") advanceStage(r.id);
    else if (role === "volunteer") acknowledge(r.id);
    else openFieldUpdate(r.id);
  };

  const primaryActionLabel = (r) => {
    if (r.resolved) return "Resolved";
    if (role === "commander") return r.stage < 2 ? "Approve Mission Plan" : r.stage < 3 ? "Approve Dispatch" : "Mark Resolved";
    if (role === "volunteer") return r.acknowledged ? "Acknowledged ✓" : "Acknowledge Assignment";
    return "Submit Field Update";
  };

  const submitIntake = (form) => {
    const id = nextIdFrom(requests);
    const newReq = {
      id,
      title: form.title,
      category: form.category,
      severity: form.severity,
      stage: 0,
      loc: form.loc,
      ts: Date.now(),
      source: form.source,
      resolved: false,
      acknowledged: false,
    };
    setRequests((prev) => [newReq, ...prev]);
    setSelected(id);
    setView("dashboard");
    logAudit(`New report ${id} submitted via ${form.source}: "${form.title}"`);
    setIntakeMsg(`Report ${id} logged and added to the stream.`);
    setTimeout(() => setIntakeMsg(""), 4000);
  };

  const addBeds = (orgId, amount) => {
    setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, bedsTotal: o.bedsTotal + amount } : o)));
    const org = orgs.find((o) => o.id === orgId);
    if (org) logAudit(`Added ${amount} beds of capacity to ${org.name}.`);
  };

  const restock = (orgId) => {
    setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, cap: Math.max(0, o.cap - 15) } : o)));
    const org = orgs.find((o) => o.id === orgId);
    if (org) logAudit(`Restocked ${org.name}, load reduced by 15%.`);
  };

  const registerResource = (form) => {
    const id = `org-${orgs.length + 1}-${Date.now()}`;
    if (form.type === "shelter") {
      setOrgs((prev) => [...prev, { id, name: form.name, type: "shelter", bedsUsed: 0, bedsTotal: Number(form.capacity) || 50 }]);
    } else {
      setOrgs((prev) => [...prev, { id, name: form.name, type: "kitchen", cap: 0, note: "just registered" }]);
    }
    logAudit(`Registered new resource: ${form.name}.`);
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="rm-page">
      <style>{`
        .rm-page {
          background: #C8CDD4;
          font-family: Verdana, Geneva, Arial, sans-serif;
          font-size: 12px;
          color: #000000;
          min-height: 100vh;
          padding: 10px;
        }
        .rm-wrap {
          max-width: 980px;
          margin: 0 auto;
          background: #FFFFFF;
          border: 2px solid #00004D;
        }
        .rm-banner {
          background: linear-gradient(#0000A8, #000060);
          color: #FFFFFF;
          padding: 10px 14px;
          border-bottom: 3px solid #FFCC00;
        }
        .rm-title {
          font-family: "Times New Roman", Times, serif;
          font-size: 26px;
          font-weight: bold;
          letter-spacing: 0.5px;
          margin: 0;
        }
        .rm-title .dot { color: #FFCC00; }
        .rm-tagline { font-size: 11px; color: #CFE0FF; margin-top: 1px; }
        .rm-marquee {
          background: #FFF8CC;
          border-top: 1px solid #999;
          border-bottom: 1px solid #999;
          padding: 3px 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .rm-marquee-inner {
          display: inline-block;
          padding-left: 100%;
          animation: rm-scroll 22s linear infinite;
          color: #990000;
          font-weight: bold;
          font-size: 11px;
        }
        @keyframes rm-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rm-marquee-inner { animation: none; }
        }
        .rm-navbar {
          background: #D8DEE6;
          border-bottom: 1px solid #999;
          padding: 6px 10px;
          font-size: 11px;
        }
        .rm-navbar a { color: #000080; text-decoration: underline; margin-right: 12px; font-weight: bold; cursor: pointer; }
        .rm-navbar a:visited { color: #550088; }
        .rm-link-active { color: #990000 !important; background: #FFF3B0; padding: 1px 4px; text-decoration: none !important; }
        table.rm-layout { width: 100%; border-collapse: collapse; }
        td.rm-col { vertical-align: top; padding: 10px; }
        td.rm-sidebar { width: 190px; background: #EDEFF3; border-right: 1px solid #B7BCC4; }
        td.rm-feed { width: 270px; background: #EDEFF3; border-left: 1px solid #B7BCC4; }
        .rm-box { background: #FFFFFF; border: 1px solid #9AA1AC; margin-bottom: 12px; }
        .rm-box-title {
          background: #C0C7D1;
          border-bottom: 1px solid #9AA1AC;
          font-weight: bold;
          font-size: 11px;
          padding: 3px 6px;
        }
        .rm-box-body { padding: 6px 8px; }
        fieldset.rm-fs {
          border: 1px solid #9AA1AC;
          background: #FFFFFF;
          margin-bottom: 12px;
          padding: 4px 8px 8px 8px;
        }
        fieldset.rm-fs legend { font-weight: bold; font-size: 11px; padding: 0 4px; }
        label.rm-check { display: block; padding: 2px 0; font-size: 11px; }
        .rm-btn {
          font-family: Verdana, Arial, sans-serif;
          font-size: 11px;
          background: #D8DEE6;
          border-top: 1px solid #FFFFFF;
          border-left: 1px solid #FFFFFF;
          border-right: 1px solid #6B7280;
          border-bottom: 1px solid #6B7280;
          padding: 3px 10px;
          cursor: pointer;
        }
        .rm-btn:active {
          border-top: 1px solid #6B7280;
          border-left: 1px solid #6B7280;
          border-right: 1px solid #FFFFFF;
          border-bottom: 1px solid #FFFFFF;
        }
        .rm-btn:disabled { color: #999; cursor: not-allowed; }
        .rm-btn-active { background: #FFCC00; font-weight: bold; }
        table.rm-datatable { width: 100%; border-collapse: collapse; font-size: 11px; }
        table.rm-datatable th {
          background: #000080;
          color: #FFFFFF;
          text-align: left;
          padding: 3px 5px;
          border: 1px solid #00004D;
        }
        table.rm-datatable td { padding: 3px 5px; border: 1px solid #C0C7D1; }
        tr.rm-row-alt td { background: #F1F3F6; }
        tr.rm-row-sel td { background: #FFEFC2; }
        .rm-severity { font-weight: bold; padding: 1px 4px; border: 1px solid; }
        .rm-map-cell {
          border: 1px solid #9AA1AC;
          width: 90px;
          height: 70px;
          text-align: center;
          vertical-align: middle;
          font-size: 10px;
          font-weight: bold;
          color: #333;
          position: relative;
        }
        .rm-pin { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; margin: 1px; cursor: pointer; }
        .rm-hr { border: none; border-top: 1px solid #9AA1AC; margin: 8px 0; }
        .rm-footer {
          background: #D8DEE6;
          border-top: 1px solid #999;
          padding: 8px 10px;
          font-size: 10px;
          color: #444;
          text-align: center;
        }
        .rm-blink { animation: rm-blink 1s steps(1) infinite; color: #CC0000; font-weight: bold; }
        @keyframes rm-blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .rm-blink { animation: none; } }
        .rm-progress-outer { border: 1px solid #9AA1AC; background: #FFFFFF; height: 12px; width: 100%; }
        .rm-progress-inner { height: 100%; }
        .rm-stepper-cell { font-size: 10px; text-align: center; padding: 2px 4px; border: 1px solid #9AA1AC; }
        a.rm-link { color: #000080; text-decoration: underline; cursor: pointer; }
        a.rm-link:hover { color: #CC0000; }
        .rm-agent-tag {
          font-size: 9px;
          background: #EDEFF3;
          border: 1px solid #9AA1AC;
          padding: 1px 4px;
          margin-right: 3px;
          display: inline-block;
        }
        .rm-field, .rm-select, textarea.rm-field {
          font-family: Verdana, Arial, sans-serif;
          font-size: 11px;
          border: 1px solid #9AA1AC;
          padding: 3px 4px;
          width: 100%;
          box-sizing: border-box;
          background: #FFFFFF;
        }
        .rm-form-row { margin-bottom: 8px; }
        .rm-form-row label { display: block; font-weight: bold; font-size: 11px; margin-bottom: 2px; }
        .rm-note-ok { background: #E7F5E3; border: 1px solid #7FB86B; color: #245C1A; padding: 5px 8px; font-size: 11px; margin-bottom: 8px; }
        .rm-empty { padding: 10px; color: #666; font-style: italic; font-size: 11px; }
      `}</style>

      <div className="rm-wrap">
        {/* Banner */}
        <div className="rm-banner">
          <table width="100%">
            <tbody>
              <tr>
                <td>
                  <p className="rm-title">RELIEF<span className="dot">MESH</span></p>
                  <p className="rm-tagline">Multi-Agent Disaster Resource &amp; Mission Coordinator — Cedar County</p>
                </td>
                <td align="right" style={{ verticalAlign: "top" }}>
                  <span style={{ fontSize: 11 }}>
                    Logged in as: <b>{session.name}, {ROLE_LABEL[session.role]}</b> &nbsp;|&nbsp; <a className="rm-link" style={{ color: "#FFCC00" }}>Account</a> &nbsp;|&nbsp; <a className="rm-link" style={{ color: "#FFCC00" }} onClick={handleLogout}>Log Out</a>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Marquee alert ticker — reflects live state */}
        <div className="rm-marquee">
          <span className="rm-marquee-inner">
            *** FLASH FLOOD WARNING — Cedar County in effect until 9:00 PM *** {nearCapacityOrgs} SHELTER{nearCapacityOrgs === 1 ? "" : "S"} NEARING CAPACITY *** ROAD CLOSURE: River Rd at Sector C1, replanning affected missions *** {pendingApprovals} MISSION{pendingApprovals === 1 ? "" : "S"} PENDING APPROVAL *** For emergencies dial 911 ***
          </span>
        </div>

        {/* Nav bar — now switches views */}
        <div className="rm-navbar">
          {NAV_ITEMS.map((n) => (
            <a
              key={n.id}
              className={`rm-link ${view === n.id ? "rm-link-active" : ""}`}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </a>
          ))}
        </div>

        {/* Role switch strip */}
        <table width="100%" style={{ background: "#F1F3F6", borderBottom: "1px solid #B7BCC4" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 10px", fontSize: 11 }}>
                Preview console permissions as:&nbsp;
                {["field", "volunteer", "commander"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rm-btn ${role === r ? "rm-btn-active" : ""}`}
                    style={{ marginRight: 6, textTransform: "capitalize" }}
                  >
                    {r}
                  </button>
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        {view === "dashboard" && (
          <DashboardView
            requests={requests}
            filtered={filtered}
            selectedReq={selectedReq}
            selected={selected}
            setSelected={setSelected}
            activeCats={activeCats}
            toggleCat={toggleCat}
            activeSevs={activeSevs}
            toggleSev={toggleSev}
            showResolved={showResolved}
            setShowResolved={setShowResolved}
            search={search}
            setSearch={setSearch}
            orgs={orgs}
            role={role}
            now={now}
            pendingApprovals={pendingApprovals}
            mergedClusters={mergedClusters}
            primaryAction={primaryAction}
            primaryActionLabel={primaryActionLabel}
            fieldUpdateFor={fieldUpdateFor}
            fieldUpdateText={fieldUpdateText}
            setFieldUpdateText={setFieldUpdateText}
            submitFieldUpdate={submitFieldUpdate}
            setFieldUpdateFor={setFieldUpdateFor}
          />
        )}

        {view === "intake" && <IntakeView onSubmit={submitIntake} message={intakeMsg} />}

        {view === "evidence" && <EvidenceView requests={requests} now={now} setSelected={setSelected} setView={setView} />}

        {view === "planner" && (
          <PlannerView
            requests={requests}
            role={role}
            advanceStage={advanceStage}
            setSelected={setSelected}
            setView={setView}
          />
        )}

        {view === "registry" && (
          <RegistryView orgs={orgs} addBeds={addBeds} restock={restock} registerResource={registerResource} />
        )}

        {view === "audit" && <AuditView audit={audit} />}

        {/* Footer */}
        <div className="rm-footer">
          ReliefMesh Disaster Coordination Console &copy; 2026 &nbsp;|&nbsp; Best viewed at 1024x768 &nbsp;|&nbsp;
          <a className="rm-link"> Privacy Policy</a> &nbsp;|&nbsp; <a className="rm-link">Audit Log</a> &nbsp;|&nbsp; <a className="rm-link">Report a Problem</a>
          <br />
          All mission plans require human commander approval. This console recommends; it does not dispatch autonomously.
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Dashboard ----------------------------- */

function DashboardView(props) {
  const {
    requests, filtered, selectedReq, selected, setSelected,
    activeCats, toggleCat, activeSevs, toggleSev, showResolved, setShowResolved,
    search, setSearch, orgs, role, now, pendingApprovals, mergedClusters,
    primaryAction, primaryActionLabel,
    fieldUpdateFor, fieldUpdateText, setFieldUpdateText, submitFieldUpdate, setFieldUpdateFor,
  } = props;

  return (
    <table className="rm-layout">
      <tbody>
        <tr>
          {/* Sidebar */}
          <td className="rm-col rm-sidebar">
            <fieldset className="rm-fs">
              <legend>Search</legend>
              <input
                className="rm-field"
                type="text"
                placeholder="ID, title, sector..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </fieldset>

            <fieldset className="rm-fs">
              <legend>Filter by Category</legend>
              {CATEGORIES.map((c) => (
                <label className="rm-check" key={c.id}>
                  <input type="checkbox" checked={activeCats.includes(c.id)} onChange={() => toggleCat(c.id)} />{" "}
                  {c.label}
                </label>
              ))}
            </fieldset>

            <fieldset className="rm-fs">
              <legend>Filter by Severity</legend>
              {SEVERITIES.map((s) => (
                <label className="rm-check" key={s.id}>
                  <input type="checkbox" checked={activeSevs.includes(s.id)} onChange={() => toggleSev(s.id)} />{" "}
                  {s.label}
                </label>
              ))}
              <label className="rm-check" style={{ borderTop: "1px dashed #C0C7D1", marginTop: 4, paddingTop: 6 }}>
                <input type="checkbox" checked={showResolved} onChange={() => setShowResolved((v) => !v)} />{" "}
                Show resolved
              </label>
            </fieldset>

            <div className="rm-box">
              <div className="rm-box-title">Shelter Capacity</div>
              <div className="rm-box-body">
                {orgs.map((o) => (
                  <div key={o.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, marginBottom: 2 }}>{o.name}</div>
                    <div className="rm-progress-outer">
                      <div className="rm-progress-inner" style={{ width: `${orgCap(o)}%`, background: capColor(orgCap(o)) }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#555" }}>{orgNote(o)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rm-box">
              <div className="rm-box-title">Agent Status</div>
              <div className="rm-box-body" style={{ fontSize: 11 }}>
                Evidence agent: <b style={{ color: "#006600" }}>OK</b><br />
                Geo-risk agent: <b style={{ color: "#006600" }}>OK</b><br />
                Mission planner: <b style={{ color: "#006600" }}>OK</b><br />
                Constraint checker: <b style={{ color: "#006600" }}>OK</b><br />
                <hr className="rm-hr" />
                Reports today: <b>{requests.length}</b><br />
                Duplicate clusters merged: <b>{mergedClusters}</b><br />
                Pending human approval: <b>{pendingApprovals}</b>
              </div>
            </div>
          </td>

          {/* Center: map + detail */}
          <td className="rm-col">
            <div className="rm-box">
              <div className="rm-box-title">Incident Map (click a marker for details)</div>
              <div className="rm-box-body">
                <table style={{ borderCollapse: "collapse", margin: "0 auto" }}>
                  <tbody>
                    {[0, 1].map((row) => (
                      <tr key={row}>
                        {["A", "B"].map((col, ci) => {
                          const sectorId = row === 0 ? (ci === 0 ? "A" : "B") : ci === 0 ? "C" : "D";
                          const sectorReqs = requests.filter((_, i) => i % 4 === (row * 2 + ci));
                          return (
                            <td className="rm-map-cell" key={sectorId}>
                              SECTOR {sectorId}
                              <br />
                              {sectorReqs.map((r) => (
                                <span
                                  key={r.id}
                                  className="rm-pin"
                                  title={r.title}
                                  onClick={() => setSelected(r.id)}
                                  style={{
                                    background: SEVERITY_META[r.severity].color,
                                    opacity: r.resolved ? 0.3 : 1,
                                    outline: r.id === selected ? "2px solid #000" : "none",
                                  }}
                                />
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 10, marginTop: 6, color: "#555" }}>
                  <span className="rm-pin" style={{ background: "#CC0000" }} /> Critical &nbsp;
                  <span className="rm-pin" style={{ background: "#B36A00" }} /> High &nbsp;
                  <span className="rm-pin" style={{ background: "#000080" }} /> Medium
                </p>
              </div>
            </div>

            {selectedReq && (
              <div className="rm-box">
                <div className="rm-box-title">
                  Report Detail — {selectedReq.id}
                  {selectedReq.severity === "critical" && !selectedReq.resolved && <span className="rm-blink"> &nbsp;*** URGENT ***</span>}
                  {selectedReq.resolved && <span style={{ color: "#006600" }}> &nbsp;— RESOLVED</span>}
                </div>
                <div className="rm-box-body">
                  <table width="100%">
                    <tbody>
                      <tr>
                        <td style={{ fontSize: 11, width: "60%" }}>
                          <b>{selectedReq.title}</b><br />
                          Location: {selectedReq.loc}<br />
                          Reported: {timeAgo(selectedReq.ts, now)}<br />
                          Source: <span className="rm-agent-tag">{selectedReq.source}</span><br />
                          Severity:{" "}
                          <span
                            className="rm-severity"
                            style={{ color: SEVERITY_META[selectedReq.severity].color, borderColor: SEVERITY_META[selectedReq.severity].color }}
                          >
                            {SEVERITY_META[selectedReq.severity].label}
                          </span>
                          {selectedReq.note && (
                            <>
                              <br /><span style={{ fontSize: 10, color: "#555" }}>{selectedReq.note}</span>
                            </>
                          )}
                        </td>
                        <td style={{ verticalAlign: "top" }}>
                          <table className="rm-datatable" cellSpacing="0">
                            <tbody>
                              <tr>
                                {STAGES.map((s, i) => (
                                  <td key={s} className="rm-stepper-cell" style={{ background: i <= selectedReq.stage ? "#FFCC00" : "#FFFFFF", fontWeight: i <= selectedReq.stage ? "bold" : "normal" }}>
                                    {i + 1}. {s}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <hr className="rm-hr" />

                  {fieldUpdateFor === selectedReq.id ? (
                    <div>
                      <textarea
                        className="rm-field"
                        rows={2}
                        placeholder="Describe the field update..."
                        value={fieldUpdateText}
                        onChange={(e) => setFieldUpdateText(e.target.value)}
                        style={{ marginBottom: 6 }}
                      />
                      <br />
                      <button className="rm-btn" onClick={submitFieldUpdate} disabled={!fieldUpdateText.trim()} style={{ marginRight: 6 }}>
                        Submit Update
                      </button>
                      <button className="rm-btn" onClick={() => setFieldUpdateFor(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className="rm-btn"
                      onClick={() => primaryAction(selectedReq)}
                      disabled={selectedReq.resolved || (role === "volunteer" && selectedReq.acknowledged)}
                    >
                      {primaryActionLabel(selectedReq)}
                    </button>
                  )}
                </div>
              </div>
            )}

            <NearbyResourcesMap />
          </td>

          {/* Feed */}
          <td className="rm-col rm-feed">
            <div className="rm-box-title" style={{ marginBottom: 6 }}>Report Stream ({filtered.length})</div>
            {filtered.length === 0 ? (
              <div className="rm-empty">No reports match the current filters.</div>
            ) : (
              <table className="rm-datatable" cellSpacing="0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Sev.</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={r.id}
                      className={r.id === selected ? "rm-row-sel" : i % 2 ? "rm-row-alt" : ""}
                      onClick={() => setSelected(r.id)}
                      style={{ cursor: "pointer", opacity: r.resolved ? 0.55 : 1 }}
                    >
                      <td>{r.id}</td>
                      <td>
                        <span style={{ color: SEVERITY_META[r.severity].color, fontWeight: "bold" }}>
                          {SEVERITY_META[r.severity].label.charAt(0)}
                        </span>
                      </td>
                      <td>
                        {r.title}
                        <br />
                        <span style={{ color: "#555" }}>{r.loc} — {timeAgo(r.ts, now)}</span>
                        <br />
                        <span className="rm-agent-tag">{r.source}</span>
                        {r.resolved && <span className="rm-agent-tag" style={{ color: "#006600" }}>Resolved</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ----------------------------- Intake ----------------------------- */

function IntakeView({ onSubmit, message }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [severity, setSeverity] = useState("medium");
  const [loc, setLoc] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !loc.trim()) {
      setError("Title and location are required.");
      return;
    }
    setError("");
    onSubmit({ title: title.trim(), category, severity, loc: loc.trim(), source });
    setTitle("");
    setLoc("");
    setSeverity("medium");
    setCategory(CATEGORIES[0].id);
    setSource(SOURCES[0]);
  };

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: "0 auto" }}>
      <div className="rm-box">
        <div className="rm-box-title">New Incident Report Intake</div>
        <div className="rm-box-body">
          {message && <div className="rm-note-ok">{message}</div>}
          {error && <div className="rm-note-ok" style={{ background: "#FBE3E3", borderColor: "#CC0000", color: "#7A0000" }}>{error}</div>}
          <form onSubmit={submit}>
            <div className="rm-form-row">
              <label>What is happening?</label>
              <input className="rm-field" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Basement flooding, family needs evac" />
            </div>
            <div className="rm-form-row">
              <label>Location / Sector</label>
              <input className="rm-field" type="text" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Sector A2 - Birch St" />
            </div>
            <div className="rm-form-row">
              <label>Category</label>
              <select className="rm-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="rm-form-row">
              <label>Severity</label>
              <select className="rm-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="rm-form-row">
              <label>Source</label>
              <select className="rm-select" value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button className="rm-btn" type="submit">Submit Report</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Evidence Log ----------------------------- */

function EvidenceView({ requests, now, setSelected, setView }) {
  const sorted = [...requests].sort((a, b) => b.ts - a.ts);
  return (
    <div style={{ padding: 10 }}>
      <div className="rm-box">
        <div className="rm-box-title">Evidence Log — All Reports ({requests.length})</div>
        <div className="rm-box-body">
          <table className="rm-datatable" cellSpacing="0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Reported</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.id}
                  className={i % 2 ? "rm-row-alt" : ""}
                  onClick={() => { setSelected(r.id); setView("dashboard"); }}
                  style={{ cursor: "pointer" }}
                >
                  <td>{r.id}</td>
                  <td>{timeAgo(r.ts, now)}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.category}</td>
                  <td style={{ color: SEVERITY_META[r.severity].color, fontWeight: "bold" }}>{SEVERITY_META[r.severity].label}</td>
                  <td>{r.resolved ? "Resolved" : STAGES[r.stage]}</td>
                  <td>{r.source}</td>
                  <td style={{ color: "#555" }}>{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Mission Planner ----------------------------- */

function PlannerView({ requests, role, advanceStage, setSelected, setView }) {
  const queue = requests
    .filter((r) => !r.resolved && (r.stage === 1 || r.stage === 2))
    .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity] - { critical: 0, high: 1, medium: 2 }[b.severity]));

  const approveAllCritical = () => {
    queue.filter((r) => r.severity === "critical").forEach((r) => advanceStage(r.id));
  };

  return (
    <div style={{ padding: 10 }}>
      <div className="rm-box">
        <div className="rm-box-title">Mission Planner — Awaiting Approval ({queue.length})</div>
        <div className="rm-box-body">
          {role !== "commander" && (
            <div className="rm-note-ok" style={{ background: "#FBE3E3", borderColor: "#CC0000", color: "#7A0000" }}>
              Switch to Commander view to approve mission plans and dispatches.
            </div>
          )}
          {queue.length === 0 ? (
            <div className="rm-empty">No missions currently awaiting approval.</div>
          ) : (
            <>
              <button className="rm-btn" disabled={role !== "commander"} onClick={approveAllCritical} style={{ marginBottom: 10 }}>
                Approve All Critical Missions
              </button>
              <table className="rm-datatable" cellSpacing="0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Stage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((r, i) => (
                    <tr key={r.id} className={i % 2 ? "rm-row-alt" : ""}>
                      <td onClick={() => { setSelected(r.id); setView("dashboard"); }} style={{ cursor: "pointer" }}>{r.id}</td>
                      <td>{r.title}</td>
                      <td style={{ color: SEVERITY_META[r.severity].color, fontWeight: "bold" }}>{SEVERITY_META[r.severity].label}</td>
                      <td>{STAGES[r.stage]}</td>
                      <td>
                        <button className="rm-btn" disabled={role !== "commander"} onClick={() => advanceStage(r.id)}>
                          {r.stage < 2 ? "Approve Plan" : "Approve Dispatch"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Resource Registry ----------------------------- */

function RegistryView({ orgs, addBeds, restock, registerResource }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("shelter");
  const [capacity, setCapacity] = useState(50);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    registerResource({ name: name.trim(), type, capacity });
    setName("");
    setCapacity(50);
  };

  return (
    <div style={{ padding: 10 }}>
      <table className="rm-layout">
        <tbody>
          <tr>
            <td className="rm-col" style={{ width: "60%" }}>
              <div className="rm-box">
                <div className="rm-box-title">Registered Resources ({orgs.length})</div>
                <div className="rm-box-body">
                  {orgs.map((o) => (
                    <div key={o.id} style={{ marginBottom: 12, borderBottom: "1px dashed #C0C7D1", paddingBottom: 8 }}>
                      <div style={{ fontWeight: "bold", fontSize: 11 }}>{o.name} <span className="rm-agent-tag" style={{ textTransform: "capitalize" }}>{o.type}</span></div>
                      <div className="rm-progress-outer" style={{ margin: "4px 0" }}>
                        <div className="rm-progress-inner" style={{ width: `${orgCap(o)}%`, background: capColor(orgCap(o)) }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>{orgNote(o)} &nbsp;({orgCap(o)}% load)</div>
                      {o.type === "shelter" ? (
                        <button className="rm-btn" onClick={() => addBeds(o.id, 20)}>+ Add 20 Beds</button>
                      ) : (
                        <button className="rm-btn" onClick={() => restock(o.id)}>Restock (-15% load)</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </td>
            <td className="rm-col">
              <div className="rm-box">
                <div className="rm-box-title">Register New Resource</div>
                <div className="rm-box-body">
                  <form onSubmit={submit}>
                    <div className="rm-form-row">
                      <label>Organization Name</label>
                      <input className="rm-field" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oak Hollow Church Shelter" />
                    </div>
                    <div className="rm-form-row">
                      <label>Type</label>
                      <select className="rm-select" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="shelter">Shelter</option>
                        <option value="kitchen">Food / Kitchen</option>
                      </select>
                    </div>
                    {type === "shelter" && (
                      <div className="rm-form-row">
                        <label>Bed Capacity</label>
                        <input className="rm-field" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                      </div>
                    )}
                    <button className="rm-btn" type="submit">Register</button>
                  </form>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------- Audit Trail ----------------------------- */

function AuditView({ audit }) {
  return (
    <div style={{ padding: 10 }}>
      <div className="rm-box">
        <div className="rm-box-title">Audit Trail ({audit.length} entries)</div>
        <div className="rm-box-body">
          <table className="rm-datatable" cellSpacing="0">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Timestamp</th>
                <th style={{ width: 100 }}>Actor</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a, i) => (
                <tr key={a.id} className={i % 2 ? "rm-row-alt" : ""}>
                  <td>{new Date(a.ts).toLocaleTimeString()}</td>
                  <td style={{ textTransform: "capitalize" }}>{a.actor}</td>
                  <td>{a.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
