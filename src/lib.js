/* Shared constants and helpers used across the ReliefMesh console. */

export const CATEGORIES = [
  { id: "medical", label: "Medical" },
  { id: "shelter", label: "Shelter" },
  { id: "food", label: "Food & Water" },
  { id: "transport", label: "Transport" },
];

export const SEVERITIES = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
];

export const SEVERITY_META = {
  critical: { label: "CRITICAL", color: "#CC0000" },
  high: { label: "HIGH", color: "#B36A00" },
  medium: { label: "MEDIUM", color: "#000080" },
};

export const STAGES = ["Reported", "Clustered", "Planned", "Dispatched"];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Incident Map" },
  { id: "intake", label: "Report / Intake" },
  { id: "evidence", label: "Evidence Log" },
  { id: "planner", label: "Mission Planner" },
  { id: "registry", label: "Resource Registry" },
  { id: "audit", label: "Audit Trail" },
];

export const SOURCES = ["Web", "SMS", "Call Center", "Field Team"];

export const ROLES = [
  { id: "commander", label: "Commander" },
  { id: "volunteer", label: "Volunteer" },
  { id: "field", label: "Field" },
];

export function minsAgo(n) {
  return Date.now() - n * 60000;
}

export const SEED_REQUESTS = [
  { id: "RM-2291", title: "Family of 4 trapped, rising water", category: "medical", severity: "critical", stage: 0, loc: "Sector C3 - Elm & 9th", ts: minsAgo(2), source: "SMS", resolved: false, acknowledged: false },
  { id: "RM-2287", title: "Elderly resident, needs insulin", category: "medical", severity: "critical", stage: 1, loc: "Sector B2 - Maple Ct", ts: minsAgo(6), source: "Field Team", resolved: false, acknowledged: false },
  { id: "RM-2280", title: "Shelter overflow, 12 need beds", category: "shelter", severity: "high", stage: 1, loc: "Sector D1 - Civic Center", ts: minsAgo(14), source: "Web", resolved: false, acknowledged: false },
  { id: "RM-2274", title: "Drinking water low, 30+ households", category: "food", severity: "high", stage: 2, loc: "Sector A4 - Pine Grove", ts: minsAgo(22), source: "Call Center", resolved: false, acknowledged: false },
  { id: "RM-2266", title: "Road blocked, need transport to clinic", category: "transport", severity: "medium", stage: 0, loc: "Sector C1 - River Rd", ts: minsAgo(31), source: "SMS", resolved: false, acknowledged: false },
  { id: "RM-2251", title: "Duplicate report — flooding, Oak Hollow", category: "shelter", severity: "medium", stage: 3, loc: "Sector B4 - Oak Hollow", ts: minsAgo(60), source: "Web", note: "Merged with RM-2240 (2 reports, 1 contradiction retained)", resolved: false, acknowledged: false },
];

export const SEED_ORGS = [
  { id: "org-1", name: "Cedar County Red Cross", type: "shelter", bedsUsed: 123, bedsTotal: 150 },
  { id: "org-2", name: "Riverside Community Shelter", type: "shelter", bedsUsed: 62, bedsTotal: 150 },
  { id: "org-3", name: "St. Anne's Relief Kitchen", type: "kitchen", cap: 95, note: "meals near capacity" },
];

export function capColor(cap) {
  if (cap > 85) return "#CC0000";
  if (cap > 60) return "#B36A00";
  return "#006600";
}

export function orgCap(o) {
  return o.type === "shelter" ? Math.round((o.bedsUsed / o.bedsTotal) * 100) : o.cap;
}

export function orgNote(o) {
  return o.type === "shelter" ? `${o.bedsUsed} / ${o.bedsTotal} beds` : o.note;
}

export function timeAgo(ts, now) {
  const diffMs = Math.max(0, now - ts);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min. ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function nextIdFrom(requests) {
  const nums = requests.map((r) => parseInt(r.id.replace("RM-", ""), 10)).filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 2200;
  return `RM-${max + 1}`;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistanceKm(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export const SESSION_KEY = "reliefmesh_session";

export function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.role) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore storage errors (e.g. private browsing) */
  }
}
