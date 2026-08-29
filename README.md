# ReliefMesh

A functional prototype of a multi-agent disaster resource & mission coordination console, styled as a late-90s / early-2000s county emergency-services site (table layout, beveled buttons, Verdana/Times, navy+gray).

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a production build in `dist/`.

## Features

- **Live incident dashboard** — sortable report stream, sector map with clickable pins, and a detail panel with a real mission-approval workflow (Reported → Clustered → Planned → Dispatched → Resolved).
- **Role-aware actions** — switching between Commander / Volunteer / Field changes what the primary action button does: commanders advance/approve missions, volunteers acknowledge assignments, field staff submit free-text field updates.
- **Report intake form** — submit a new incident report (title, location, category, severity, source); it's assigned a new ID and immediately appears in the live stream and map.
- **Search & filtering** — filter the report stream by category, severity, free-text search, and optionally show resolved reports.
- **Mission Planner** — a queue of reports awaiting approval, with per-item and bulk "approve all critical" actions (commander-only).
- **Resource Registry** — shelters and kitchens with live capacity bars; add bed capacity, restock a kitchen, or register a brand-new resource, all reflected instantly on the dashboard's Shelter Capacity panel.
- **Audit Trail** — every approval, dispatch, field update, intake submission, and resource change is logged with a timestamp and the acting role.
- **Live relative timestamps** ("2 min. ago", etc.) that update automatically.

## Tech

React 18 + Vite, no external UI libraries — all styling is hand-rolled to preserve the retro aesthetic.
