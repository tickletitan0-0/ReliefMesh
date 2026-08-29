import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { haversineKm, formatDistanceKm } from "./lib.js";

const RESOURCE_TYPES = {
  hospital: { label: "Hospital / Clinic", color: "#CC0000" },
  shelter: { label: "Shelter / Community Site", color: "#B36A00" },
  food: { label: "Food / Groceries", color: "#006600" },
};

const DEFAULT_NAMES = {
  hospital: "Unnamed medical facility",
  shelter: "Unnamed shelter / community site",
  food: "Unnamed food resource",
};

const RADIUS_M = 8000;

function classify(tags) {
  if (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.healthcare === "hospital") return "hospital";
  if (tags.amenity === "food_bank" || tags.social_facility === "food_bank" || tags.shop === "supermarket") return "food";
  return "shelter";
}

function addressOf(tags) {
  const line = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const city = tags["addr:city"];
  const combined = [line, city].filter(Boolean).join(", ");
  return combined || null;
}

function buildQuery(lat, lon, radius = RADIUS_M) {
  return `[out:json][timeout:25];(
    node["amenity"="hospital"](around:${radius},${lat},${lon});
    way["amenity"="hospital"](around:${radius},${lat},${lon});
    node["amenity"="clinic"](around:${radius},${lat},${lon});
    node["amenity"="social_facility"](around:${radius},${lat},${lon});
    way["amenity"="social_facility"](around:${radius},${lat},${lon});
    node["social_facility"="shelter"](around:${radius},${lat},${lon});
    node["amenity"="community_centre"](around:${radius},${lat},${lon});
    node["amenity"="food_bank"](around:${radius},${lat},${lon});
    node["social_facility"="food_bank"](around:${radius},${lat},${lon});
    node["shop"="supermarket"](around:${radius},${lat},${lon});
  );out center 100;`;
}

function pinIcon(color, big) {
  const size = big ? 16 : 12;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #000;box-shadow:0 0 2px rgba(0,0,0,0.6);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function NearbyResourcesMap({ onLocated }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);

  const [coords, setCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | locating | ready | error
  const [fetchStatus, setFetchStatus] = useState("idle"); // idle | loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const [resources, setResources] = useState([]);
  const [filterCat, setFilterCat] = useState("all");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const fetchResources = useCallback(async (lat, lon) => {
    setFetchStatus("loading");
    setErrorMsg("");
    try {
      const query = buildQuery(lat, lon);
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`Overpass API returned ${res.status}`);
      const data = await res.json();
      const seen = new Set();
      const items = [];
      for (const el of data.elements || []) {
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (elLat == null || elLon == null) continue;
        const id = `${el.type}/${el.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const tags = el.tags || {};
        const category = classify(tags);
        items.push({
          id,
          name: tags.name || DEFAULT_NAMES[category],
          category,
          lat: elLat,
          lon: elLon,
          address: addressOf(tags),
          distanceKm: haversineKm(lat, lon, elLat, elLon),
        });
      }
      items.sort((a, b) => a.distanceKm - b.distanceKm);
      setResources(items.slice(0, 60));
      setFetchStatus("ready");
      if (onLocated) onLocated(items.length);
    } catch (e) {
      setFetchStatus("error");
      setErrorMsg("Could not reach the OpenStreetMap resource lookup service. Please try again in a moment.");
    }
  }, [onLocated]);

  const locate = () => {
    setGeoStatus("locating");
    setErrorMsg("");
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setErrorMsg("Geolocation isn't supported by this browser. Enter coordinates manually below.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lon: longitude });
        setGeoStatus("ready");
        fetchResources(latitude, longitude);
      },
      (err) => {
        setGeoStatus("error");
        setErrorMsg(err.message || "Location permission was denied. Enter coordinates manually below.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const submitManual = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setErrorMsg("Enter valid numeric coordinates (e.g. 12.9184, 80.1266).");
      return;
    }
    setCoords({ lat, lon });
    setGeoStatus("ready");
    fetchResources(lat, lon);
  };

  // Initialize the Leaflet map once we have a first coordinate.
  useEffect(() => {
    if (!coords || !mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, { attributionControl: true }).setView([coords.lat, coords.lon], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [coords]);

  const visibleResources = useMemo(
    () => (filterCat === "all" ? resources : resources.filter((r) => r.category === filterCat)),
    [resources, filterCat]
  );

  // Redraw markers whenever coords / filtered resources change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coords) return;
    markersRef.current.clearLayers();

    L.marker([coords.lat, coords.lon], { icon: pinIcon("#000080", true) })
      .bindPopup("Your location")
      .addTo(markersRef.current);

    const bounds = [[coords.lat, coords.lon]];
    visibleResources.forEach((r) => {
      const meta = RESOURCE_TYPES[r.category];
      L.marker([r.lat, r.lon], { icon: pinIcon(meta.color) })
        .bindPopup(`<b>${escapeHtml(r.name)}</b><br/>${meta.label}<br/>${formatDistanceKm(r.distanceKm)} away`)
        .addTo(markersRef.current);
      bounds.push([r.lat, r.lon]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    } else {
      map.setView([coords.lat, coords.lon], 13);
    }
  }, [coords, visibleResources]);

  const counts = useMemo(() => {
    const c = { hospital: 0, shelter: 0, food: 0 };
    resources.forEach((r) => { c[r.category] += 1; });
    return c;
  }, [resources]);

  return (
    <div className="rm-box">
      <div className="rm-box-title">Nearby Resources (live, from your location)</div>
      <div className="rm-box-body">
        <style>{`
          .rm-map-container { height: 280px; width: 100%; border: 1px solid #9AA1AC; margin-bottom: 8px; background: #EDEFF3; }
          .rm-chip-row { margin-bottom: 8px; }
          .rm-chip {
            display: inline-block;
            font-size: 10px;
            border: 1px solid #9AA1AC;
            background: #EDEFF3;
            padding: 2px 7px;
            margin-right: 5px;
            cursor: pointer;
          }
          .rm-chip-active { background: #FFCC00; font-weight: bold; border-color: #8A6D00; }
          .rm-resource-list { max-height: 220px; overflow-y: auto; border: 1px solid #C0C7D1; }
          .rm-resource-row { padding: 5px 7px; font-size: 11px; border-bottom: 1px solid #E4E7EC; display: flex; gap: 8px; align-items: flex-start; }
          .rm-resource-row:last-child { border-bottom: none; }
          .rm-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1px solid #000; margin-top: 2px; flex-shrink: 0; }
          .rm-map-note { font-size: 10px; color: #666; margin-top: 6px; }
        `}</style>

        {!coords && geoStatus !== "locating" && (
          <div>
            <p style={{ fontSize: 11, marginTop: 0 }}>
              Find the nearest hospitals, shelters, and food resources around your current position.
            </p>
            <button className="rm-btn" onClick={locate} style={{ marginBottom: 10 }}>
              Use My Current Location
            </button>
          </div>
        )}

        {geoStatus === "locating" && <p style={{ fontSize: 11 }}>Requesting your location…</p>}

        {errorMsg && (
          <div className="rm-note-ok" style={{ background: "#FBE3E3", borderColor: "#CC0000", color: "#7A0000" }}>
            {errorMsg}
          </div>
        )}

        {(geoStatus === "error" || !coords) && (
          <form onSubmit={submitManual} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: "bold" }}>Latitude</label>
                <input className="rm-field" style={{ width: 110 }} type="text" value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder="12.9184" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: "bold" }}>Longitude</label>
                <input className="rm-field" style={{ width: 110 }} type="text" value={manualLon} onChange={(e) => setManualLon(e.target.value)} placeholder="80.1266" />
              </div>
              <button className="rm-btn" type="submit">Locate</button>
            </div>
          </form>
        )}

        {coords && (
          <>
            <div ref={mapDivRef} className="rm-map-container" />

            <div className="rm-chip-row">
              <span
                className={`rm-chip ${filterCat === "all" ? "rm-chip-active" : ""}`}
                onClick={() => setFilterCat("all")}
              >
                All ({resources.length})
              </span>
              {Object.entries(RESOURCE_TYPES).map(([key, meta]) => (
                <span
                  key={key}
                  className={`rm-chip ${filterCat === key ? "rm-chip-active" : ""}`}
                  onClick={() => setFilterCat(key)}
                  style={{ borderColor: meta.color }}
                >
                  {meta.label} ({counts[key]})
                </span>
              ))}
              <button className="rm-btn" onClick={locate} style={{ marginLeft: 6, fontSize: 10 }}>
                Re-locate
              </button>
            </div>

            {fetchStatus === "loading" && <p style={{ fontSize: 11 }}>Looking up nearby resources…</p>}

            {fetchStatus === "ready" && (
              <div className="rm-resource-list">
                {visibleResources.length === 0 ? (
                  <div className="rm-empty">No resources of this type were found within {RADIUS_M / 1000} km.</div>
                ) : (
                  visibleResources.map((r) => (
                    <div className="rm-resource-row" key={r.id}>
                      <span className="rm-dot" style={{ background: RESOURCE_TYPES[r.category].color }} />
                      <div style={{ flex: 1 }}>
                        <b>{r.name}</b> — {formatDistanceKm(r.distanceKm)}
                        <br />
                        <span style={{ color: "#555" }}>
                          {RESOURCE_TYPES[r.category].label}
                          {r.address ? ` · ${r.address}` : ""}
                        </span>
                      </div>
                      <a
                        className="rm-link"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 10, whiteSpace: "nowrap" }}
                      >
                        Directions
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            <p className="rm-map-note">
              Data via OpenStreetMap contributors within {RADIUS_M / 1000} km, categorized automatically from map
              tags — this is a planning reference, not an official emergency-services directory. Always verify
              critical resources directly.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
