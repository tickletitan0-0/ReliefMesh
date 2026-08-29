import React, { useState } from "react";
import { ROLES } from "./lib.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("commander");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 4) return setError("Password must be at least 4 characters.");
    setError("");
    onLogin({ name: name.trim(), email: email.trim(), role, remember });
  };

  return (
    <div className="rm-login-page">
      <style>{`
        .rm-login-page {
          background: #C8CDD4;
          font-family: Verdana, Geneva, Arial, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .rm-login-card {
          width: 100%;
          max-width: 360px;
          background: #FFFFFF;
          border: 2px solid #00004D;
        }
        .rm-login-banner {
          background: linear-gradient(#0000A8, #000060);
          color: #FFFFFF;
          padding: 14px 16px;
          border-bottom: 3px solid #FFCC00;
          text-align: center;
        }
        .rm-login-title {
          font-family: "Times New Roman", Times, serif;
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .rm-login-title .dot { color: #FFCC00; }
        .rm-login-tagline { font-size: 11px; color: #CFE0FF; margin-top: 2px; }
        .rm-login-body { padding: 16px; }
        .rm-login-row { margin-bottom: 10px; }
        .rm-login-row label { display: block; font-weight: bold; font-size: 11px; margin-bottom: 3px; }
        .rm-login-field, .rm-login-select {
          font-family: Verdana, Arial, sans-serif;
          font-size: 12px;
          border: 1px solid #9AA1AC;
          padding: 5px 6px;
          width: 100%;
          box-sizing: border-box;
        }
        .rm-login-error {
          background: #FBE3E3;
          border: 1px solid #CC0000;
          color: #7A0000;
          font-size: 11px;
          padding: 5px 8px;
          margin-bottom: 10px;
        }
        .rm-login-hint {
          background: #FFF8CC;
          border: 1px solid #E0CE7A;
          color: #6B5900;
          font-size: 10px;
          padding: 5px 8px;
          margin-bottom: 12px;
        }
        .rm-login-btn {
          font-family: Verdana, Arial, sans-serif;
          font-size: 12px;
          font-weight: bold;
          background: #FFCC00;
          border-top: 1px solid #FFF3B0;
          border-left: 1px solid #FFF3B0;
          border-right: 1px solid #8A6D00;
          border-bottom: 1px solid #8A6D00;
          padding: 6px 14px;
          cursor: pointer;
          width: 100%;
        }
        .rm-login-btn:active {
          border-top: 1px solid #8A6D00;
          border-left: 1px solid #8A6D00;
          border-right: 1px solid #FFF3B0;
          border-bottom: 1px solid #FFF3B0;
        }
        .rm-login-check { font-size: 11px; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
        .rm-login-footer { text-align: center; font-size: 10px; color: #777; padding: 8px 0 2px; }
      `}</style>

      <div className="rm-login-card">
        <div className="rm-login-banner">
          <p className="rm-login-title">RELIEF<span className="dot">MESH</span></p>
          <p className="rm-login-tagline">Multi-Agent Disaster Resource &amp; Mission Coordinator</p>
        </div>
        <div className="rm-login-body">
          <p style={{ fontSize: 11, marginTop: 0 }}>Sign in to Cedar County Console</p>

          <div className="rm-login-hint">
            Demo console — this is a local, in-browser login only. No account is created on
            a server; any email format and a password of 4+ characters will work.
          </div>

          {error && <div className="rm-login-error">{error}</div>}

          <form onSubmit={submit}>
            <div className="rm-login-row">
              <label>Full Name</label>
              <input className="rm-login-field" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="J. Doe" autoFocus />
            </div>
            <div className="rm-login-row">
              <label>Email</label>
              <input className="rm-login-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jdoe@cedarcounty.gov" />
            </div>
            <div className="rm-login-row">
              <label>Password</label>
              <input className="rm-login-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="rm-login-row">
              <label>Sign in as</label>
              <select className="rm-login-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <label className="rm-login-check">
              <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} />
              Keep me signed in on this device
            </label>
            <button className="rm-login-btn" type="submit">Log In</button>
          </form>
        </div>
      </div>
      <div />
      <p className="rm-login-footer" style={{ position: "fixed", bottom: 10, width: "100%", left: 0 }}>
        ReliefMesh Disaster Coordination Console &copy; 2026
      </p>
    </div>
  );
}
