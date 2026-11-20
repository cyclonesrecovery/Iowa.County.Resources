(function () {
  const CFG = window.IA_CONFIG || {
    files: {
      fips: "data/IACountyFIPS.csv",
      population: "data/IACityCountyPopulation2024.csv",
      fire: "data/FireDeptsByCounty.csv",
      ems: "data/EMSByCounty.csv",
      le: "data/LEAgenciesByCounty.csv",
      health: "data/IACountyHealthDepts.csv",
      hospitals: "data/IAHospitalsByCounty.csv",
      treatment: "data/IATreatmentFacilities.csv",
      opioidFunding: "data/2025OpioidSettlementFundingIowa.csv",
      sources: "data/DataSources.csv",
      countyGeoJson: "County.geojson"
    }
  };

  const state = {
    counties: [],          // Array of 99 county summary objects
    countyByFips: new Map(),
    countyByName: new Map(),
    cityIndex: []          // Array of { city, cleanCity, fips, countyName, pop }
  };

  function normalizeFips(raw) {
    if (raw === null || raw === undefined) return "";
    const cleaned = String(raw).trim().replace(/\.0$/, "");
    return /^19\d{3}$/.test(cleaned) ? cleaned : "";
  }

  function normalizeCountyName(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+County$/i, "")
      .toLowerCase();
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString("en-US");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseCsv(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data || []),
        error: (err) => reject(new Error(`Failed to load ${url}: ${err.message || err}`))
      });
    });
  }

  function countByFips(rows, fipsCol = "FIPS") {
    const counts = new Map();
    let validTotal = 0;

    for (const row of rows) {
      const fips = normalizeFips(row[fipsCol]);
      if (!fips || !state.countyByFips.has(fips)) continue;
      counts.set(fips, (counts.get(fips) || 0) + 1);
      validTotal += 1;
    }

    return { counts, validTotal };
  }

  async function init() {
    const statusEl = document.getElementById("loading-status");

    try {
      const [
        fipsRows,
        popRows,
        fireRows,
        emsRows,
        leRows,
        healthRows,
        hospitalRows,
        treatmentRows,
        opioidrows,
        sourceRows
      ] = await Promise.all([
        parseCsv(CFG.files.fips),
        parseCsv(CFG.files.population),
        parseCsv(CFG.files.fire),
        parseCsv(CFG.files.ems),
        parseCsv(CFG.files.le),
        parseCsv(CFG.files.health),
        parseCsv(CFG.files.hospitals),
        parseCsv(CFG.files.treatment),
        parseCsv(CFG.files.opioidFunding),
        parseCsv(CFG.files.sources)
      ]);

      // 1. Initialize master 99-county lookup from IACountyFIPS.csv
      for (const row of fipsRows) {
        const fips = normalizeFips(row["FIPS"]);
        if (!fips) continue;

        const shortName = String(row["County Name"] || "").trim();
        const fullName = String(row["County"] || `${shortName} County`).trim();

        const record = {
          fips,
          shortName,
          fullName,
          population: 0,
          municipalityCount: 0,
          fire: 0,
          ems: 0,
          le: 0,
          health: 0,
          hospitals: 0,
          treatment: 0
        };

        state.counties.push(record);
        state.countyByFips.set(fips, record);
        state.countyByName.set(normalizeCountyName(shortName), record);
      }

      // 2. Process 2024 City & County Populations (IACityCountyPopulation2024.csv)
      const uniquePlaceFips = new Set();

      for (const row of popRows) {
        const fips = normalizeFips(row["county_fips_code"]);
        const county = state.countyByFips.get(fips);
        if (!county) continue;

        const cityRaw = String(row["city"] || "").trim();
        const estimate = Number(String(row["estimate"] || "0").replace(/,/g, "")) || 0;

        // Every row (including "Balance of <County> County") contributes to total county population
        county.population += estimate;

        // Exclude unincorporated "Balance of ..." rows when counting municipalities
        if (!/^Balance of /i.test(cityRaw) && cityRaw !== "") {
          county.municipalityCount += 1;
          if (row["place_fips_code"]) {
            uniquePlaceFips.add(String(row["place_fips_code"]).trim());
          }
          state.cityIndex.push({
            city: cityRaw,
            cleanCity: cityRaw.replace(/\s*\(pt\.\)\s*$/i, ""),
            fips,
            countyName: county.fullName,
            pop: estimate
          });
        }
      }

      // 3. Aggregate department & facility counts by county FIPS
      const fireAgg = countByFips(fireRows, "FIPS");
      const emsAgg = countByFips(emsRows, "FIPS");
      const leAgg = countByFips(leRows, "FIPS");
      const healthAgg = countByFips(healthRows, "FIPS");
      const hospitalAgg = countByFips(hospitalRows, "FIPS");
      const treatmentAgg = countByFips(treatmentRows, "FIPS");

      for (const county of state.counties) {
        county.fire = fireAgg.counts.get(county.fips) || 0;
        county.ems = emsAgg.counts.get(county.fips) || 0;
        county.le = leAgg.counts.get(county.fips) || 0;
        county.health = healthAgg.counts.get(county.fips) || 0;
        county.hospitals = hospitalAgg.counts.get(county.fips) || 0;
        county.treatment = treatmentAgg.counts.get(county.fips) || 0;
      }

      // 4. Populate Statewide Summary Cards
      setStat("stat-counties", state.counties.length);
      setStat("stat-fire", fireAgg.validTotal);
      setStat("stat-ems", emsAgg.validTotal);
      setStat("stat-le", leAgg.validTotal);
      setStat("stat-hospitals", hospitalAgg.validTotal);
      setStat("stat-health", healthAgg.validTotal);
      setStat("stat-treatment", treatmentAgg.validTotal);
      setStat("stat-cities", uniquePlaceFips.size || state.cityIndex.length);

      // 5. Render UI components
      if (statusEl) statusEl.hidden = true;
      renderCountyGrid("name-asc");
      renderSources(sourceRows);
      setupSorting();
      setupSearch();
      await initCountyMap();
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = `Error loading repository data: ${err.message}. Verify your files are inside the data/ folder.`;
      }
    }
  }

  function setStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatNumber(value);
  }

  function sortCounties(mode) {
    const list = [...state.counties];
    switch (mode) {
      case "pop-desc":
        return list.sort((a, b) => b.population - a.population || a.shortName.localeCompare(b.shortName));
      case "fire-desc":
        return list.sort((a, b) => b.fire - a.fire || a.shortName.localeCompare(b.shortName));
      case "ems-desc":
        return list.sort((a, b) => b.ems - a.ems || a.shortName.localeCompare(b.shortName));
      case "le-desc":
        return list.sort((a, b) => b.le - a.le || a.shortName.localeCompare(b.shortName));
      case "hospitals-desc":
        return list.sort((a, b) => b.hospitals - a.hospitals || a.shortName.localeCompare(b.shortName));
      case "name-asc":
      default:
        return list.sort((a, b) => a.shortName.localeCompare(b.shortName));
    }
  }

  function renderCountyGrid(sortMode) {
    const grid = document.getElementById("county-grid");
    if (!grid) return;

    const sorted = sortCounties(sortMode);
    grid.innerHTML = sorted
      .map(
        (c) => `
        <a href="county.html?fips=${encodeURIComponent(c.fips)}" class="county-card">
          <div>
            <div class="county-card-header">
              <h3>${escapeHtml(c.fullName)}</h3>
              <span class="county-pop">Pop. ${formatNumber(c.population)}</span>
            </div>
            <ul class="dept-badges">
              <li><strong>${c.fire}</strong> Fire</li>
              <li><strong>${c.ems}</strong> EMS</li>
              <li><strong>${c.le}</strong> Law Enf.</li>
              <li><strong>${c.hospitals}</strong> Hospitals</li>
              <li><strong>${c.health}</strong> Health</li>
              <li><strong>${c.treatment}</strong> Treatment</li>
            </ul>
          </div>
          <div class="county-card-footer">
            <span>${c.municipalityCount} ${c.municipalityCount === 1 ? "municipality" : "municipalities"}</span>
            <span class="arrow">View details &rarr;</span>
          </div>
        </a>
      `
      )
      .join("");
  }

  function setupSorting() {
    const select = document.getElementById("sort-select");
    if (!select) return;
    select.addEventListener("change", (e) => renderCountyGrid(e.target.value));
  }

  function setupSearch() {
    const input = document.getElementById("county-search");
    const dropdown = document.getElementById("search-results");
    if (!input || !dropdown) return;

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        return;
      }

      const countyMatches = state.counties
        .filter(
          (c) =>
            c.shortName.toLowerCase().includes(q) ||
            c.fullName.toLowerCase().includes(q) ||
            c.fips.includes(q)
        )
        .slice(0, 6)
        .map((c) => ({
          label: `${c.fullName} (FIPS ${c.fips})`,
          meta: `Pop. ${formatNumber(c.population)}`,
          href: `county.html?fips=${encodeURIComponent(c.fips)}`
        }));

      const cityMatches = state.cityIndex
        .filter((item) => item.cleanCity.toLowerCase().includes(q))
        .sort((a, b) => b.pop - a.pop)
        .slice(0, 6)
        .map((item) => ({
          label: `${item.city} — ${item.countyName}`,
          meta: `City Pop. ${formatNumber(item.pop)}`,
          href: `county.html?fips=${encodeURIComponent(item.fips)}&city=${encodeURIComponent(item.cleanCity)}`
        }));

      const combined = [...countyMatches, ...cityMatches].slice(0, 10);

      if (combined.length === 0) {
        dropdown.innerHTML = `<li style="padding:0.6rem 1rem;color:#64748b;">No matching counties or cities found.</li>`;
      } else {
        dropdown.innerHTML = combined
          .map(
            (m) => `
            <li>
              <a href="${m.href}">
                <span>${escapeHtml(m.label)}</span>
                <span style="color:#64748b;font-size:0.85rem;">${escapeHtml(m.meta)}</span>
              </a>
            </li>
          `
          )
          .join("");
      }

      dropdown.hidden = false;
    });

    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.hidden = true;
      }
    });
  }

  function renderSources(rows) {
    const container = document.getElementById("sources-list");
    if (!container) return;

    container.innerHTML = rows
      .filter((r) => r["Source"] && r["Link"])
      .map(
        (r) => `
        <div class="source-item">
          <a href="${escapeHtml(r["Link"].trim())}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(r["Source"].trim())} &nearr;
          </a>
        </div>
      `
      )
      .join("");
  }

  function matchCountyFromGeoFeature(props = {}) {
    // Check common FIPS property keys across Iowa GIS GeoJSON schemas
    const fipsCandidates = [
      props.FIPS,
      props.fips,
      props.GEOID,
      props.geoid,
      props.COUNTYFP ? `19${String(props.COUNTYFP).padStart(3, "0")}` : "",
      props.FIPS_INT
    ];

    for (const cand of fipsCandidates) {
      const fips = normalizeFips(cand);
      if (fips && state.countyByFips.has(fips)) {
        return state.countyByFips.get(fips);
      }
    }

    // Fallback: match by common county name property keys
    const nameCandidates = [
      props.COUNTY,
      props.County,
      props.county,
      props.NAME,
      props.Name,
      props.name,
      props.COUNTY_NAME,
      props.NAMELSAD
    ];

    for (const cand of nameCandidates) {
      const norm = normalizeCountyName(cand);
      if (norm && state.countyByName.has(norm)) {
        return state.countyByName.get(norm);
      }
    }

    return null;
  }

  async function initCountyMap() {
    const mapEl = document.getElementById("iowa-map");
    if (!mapEl || typeof L === "undefined") return;

    try {
      const res = await fetch(CFG.files.countyGeoJson);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();

      const map = L.map("iowa-map", { scrollWheelZoom: false }).setView([42.0, -93.5], 7);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 14,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      const defaultStyle = {
        color: "#1e3a8a",
        weight: 1.25,
        fillColor: "#3b82f6",
        fillOpacity: 0.22
      };

      const hoverStyle = {
        weight: 2.5,
        color: "#1d4ed8",
        fillColor: "#2563eb",
        fillOpacity: 0.45
      };

      const layer = L.geoJSON(geojson, {
        style: () => defaultStyle,
        onEachFeature: (feature, featureLayer) => {
          const county = matchCountyFromGeoFeature(feature.properties);
          if (!county) return;

          featureLayer.bindTooltip(
            `<strong>${escapeHtml(county.fullName)}</strong><br>` +
              `2024 Pop: ${formatNumber(county.population)}<br>` +
              `Fire: ${county.fire} &bull; EMS: ${county.ems} &bull; Law Enf.: ${county.le}`,
            { sticky: true }
          );

          featureLayer.on({
            mouseover: (e) => {
              e.target.setStyle(hoverStyle);
              e.target.bringToFront();
            },
            mouseout: (e) => {
              layer.resetStyle(e.target);
            },
            click: () => {
              window.location.href = `county.html?fips=${encodeURIComponent(county.fips)}`;
            }
          });
        }
      }).addTo(map);

      if (layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), { padding: [12, 12] });
      }
    } catch (err) {
      console.warn("County map skipped:", err);
      mapEl.innerHTML = `<p style="padding:1rem;color:#475569;">Could not load ${escapeHtml(CFG.files.countyGeoJson)}.</p>`;
    }
  }
function formatCurrency(val) {
  const num = Number(String(val ?? "0").replace(/[$,]/g, ""));
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  document.addEventListener("DOMContentLoaded", init);
})();
