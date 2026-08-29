# ReliefMesh

A functional prototype of a multi-agent disaster resource & mission coordination console, styled as a late-90s / early-2000s county emergency-services site (table layout, beveled buttons, Verdana/Times, navy+gray).

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a production build in `dist/`.

## Features

- **Working login** — a local, in-browser sign-in (name, email, password, role) gates the console. Session is remembered via `localStorage` when "keep me signed in" is checked, and Log Out actually clears it. This is a client-side demo login only — there's no server-side account creation or password verification, and that's stated on the login screen.
- **Live nearby-resources map** — below the Report Detail panel, "Nearby Resources" asks for your browser location (or accepts manual lat/lon), then queries OpenStreetMap's free Overpass API for real hospitals, shelters/community sites, and food resources (food banks + supermarkets) within 8 km, plots them on a Leaflet/OpenStreetMap map with a distance-sorted list, category filters, and one-click Google Maps directions links.
- **Live incident dashboard** — sortable report stream, sector map with clickable pins, and a detail panel with a real mission-approval workflow (Reported → Clustered → Planned → Dispatched → Resolved).
- **Role-aware actions** — switching between Commander / Volunteer / Field changes what the primary action button does: commanders advance/approve missions, volunteers acknowledge assignments, field staff submit free-text field updates.
- **Report intake form** — submit a new incident report (title, location, category, severity, source); it's assigned a new ID and immediately appears in the live stream and map.
- **Search & filtering** — filter the report stream by category, severity, free-text search, and optionally show resolved reports.
- **Mission Planner** — a queue of reports awaiting approval, with per-item and bulk "approve all critical" actions (commander-only).
- **Resource Registry** — shelters and kitchens with live capacity bars; add bed capacity, restock a kitchen, or register a brand-new resource, all reflected instantly on the dashboard's Shelter Capacity panel.
- **Audit Trail** — every approval, dispatch, field update, intake submission, and resource change is logged with a timestamp and the acting role.
- **Live relative timestamps** ("2 min. ago", etc.) that update automatically.

## Tech

React 18 + Vite. Leaflet + OpenStreetMap tiles power the nearby-resources map (no API key required); everything else is hand-rolled CSS to preserve the retro aesthetic.
