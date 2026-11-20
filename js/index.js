(function () {
  const CFG = window.IA_CONFIG;
  const { normalizeFips, parseNumber, formatNumber, formatCurrency, escapeHtml, safeUrl, setText, loadCsvs } = window.IA;

  const state = {
    counties: [],          // Array of 99 county summary objects
    countyByFips: new Map(),
    cityIndex: []          // Array of { city, cleanCity, fips, countyName, pop }
  };

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
      const d = await loadCsvs(CFG.files, [
        "fips", "population", "fire", "ems", "le",
        "health", "hospitals", "treatment", "opioidFunding", "sources"
      ]);

      // 1. Initialize master 99-county lookup strictly by FIPS
      for (const row of d.fips) {
        const fips = normalizeFips(row["FIPS"]);
        if (!fips) continue;

        const shortName = String(row["County Name"] || "").trim();
        const fullName = String(row["County"] || `${shortName} County`).trim();

        const record = {
          fips, shortName, fullName,
          population: 0, municipalityCount: 0,
          fire: 0, ems: 0, le: 0, health: 0, hospitals: 0, treatment: 0,
          opioidSpent: 0
        };

        state.counties.push(record);
        state.countyByFips.set(fips, record);
      }

      // 2. Process 2024 City & County Populations by county_fips_code
      const uniquePlaceFips = new Set();

      for (const row of d.population) {
        const fips = normalizeFips(row["county_fips_code"]);
        const county = state.countyByFips.get(fips);
        if (!county) continue;

        const cityRaw = String(row["city"] || "").trim();
        const estimate = parseNumber(row["estimate"]);

        county.population += estimate;

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

      // 3. Aggregate department & facility counts strictly by FIPS
      const agg = {
        fire: countByFips(d.fire),
        ems: countByFips(d.ems),
        le: countByFips(d.le),
        health: countByFips(d.health),
        hospitals: countByFips(d.hospitals),
        treatment: countByFips(d.treatment)
      };

      for (const county of state.counties) {
        for (const key of Object.keys(agg)) {
          county[key] = agg[key].counts.get(county.fips) || 0;
        }
      }

      // 4. Attach 2025 Opioid Settlement Expenditures strictly by FIPS
      for (const row of d.opioidFunding) {
        const county = state.countyByFips.get(normalizeFips(row["FIPS"]));
        if (!county) continue; // ignores total/statewide rows without a valid county FIPS
        county.opioidSpent = parseNumber(row["Expenditures"]);
      }

      // 5. Populate Statewide Summary Cards
      const setStat = (id, value) => setText(id, formatNumber(value));
      setStat("stat-counties", state.counties.length);
      setStat("stat-fire", agg.fire.validTotal);
      setStat("stat-ems", agg.ems.validTotal);
      setStat("stat-le", agg.le.validTotal);
      setStat("stat-hospitals", agg.hospitals.validTotal);
      setStat("stat-health", agg.health.validTotal);
      setStat("stat-treatment", agg.treatment.validTotal);
      setStat("stat-cities", uniquePlaceFips.size || state.cityIndex.length);

      // 6. Render UI components
      if (statusEl) statusEl.hidden = true;
      renderCountyGrid("name-asc");
      renderSources(d.sources);
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

  function sortCounties(mode) {
    const list = [...state.counties];
    const byName = (a, b) => a.shortName.localeCompare(b.shortName);
    const desc = (key) => (a, b) => b[key] - a[key] || byName(a, b);

    switch (mode) {
      case "pop-desc":
        return list.sort(desc("population"));
      case "fire-desc":
        return list.sort(desc("fire"));
      case "ems-desc":
        return list.sort(desc("ems"));
      case "le-desc":
        return list.sort(desc("le"));
      case "hospitals-desc":
        return list.sort(desc("hospitals"));
      case "name-asc":
      default:
        return list.sort(byName);
    }
  }

  function renderCountyGrid(sortMode) {
    const grid = document.getElementById("county-grid");
    if (!grid) return;

    grid.innerHTML = sortCounties(sortMode)
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
              <a href="${escapeHtml(m.href)}">
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
      .map((r) => ({ name: String(r["Source"] || "").trim(), href: safeUrl(r["Link"]) }))
      .filter((r) => r.name && r.href)
      .map(
        (r) => `
        <div class="source-item">
          <a href="${escapeHtml(r.href)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(r.name)} &nearr;
          </a>
        </div>
      `
      )
      .join("");
  }

  function matchCountyFromGeoFeature(props = {}) {
    // 1) Any property that looks like a FIPS/GEOID field. Require a full 19xxx code
    //    so a state-level value like "19" can't be padded into Benton.
    for (const [key, val] of Object.entries(props)) {
      if (/fips|geoid/i.test(key)) {
        const fips = normalizeFips(val, { allowShort: false });
        if (fips && state.countyByFips.has(fips)) return state.countyByFips.get(fips);
      }
      // County-only codes like COUNTYFP = "001" are the one place padding is right.
      if (/^countyfp$/i.test(key)) {
        const fips = normalizeFips(val);
        if (fips && state.countyByFips.has(fips)) return state.countyByFips.get(fips);
      }
    }

    // 2) Fall back to the county name.
    for (const [key, val] of Object.entries(props)) {
      if (!/^(name|county|countyname|county_name|namelsad)$/i.test(key)) continue;
      const name = String(val || "").trim().replace(/\s+County$/i, "").toLowerCase();
      const hit = state.counties.find((c) => c.shortName.toLowerCase() === name);
      if (hit) return hit;
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

      const defaultStyle = { color: "#1e3a8a", weight: 1.25, fillColor: "#3b82f6", fillOpacity: 0.22 };
      const hoverStyle = { weight: 2.5, color: "#1d4ed8", fillColor: "#2563eb", fillOpacity: 0.45 };

      let matched = 0;
      const unmatched = [];

      const layer = L.geoJSON(geojson, {
        style: () => defaultStyle,
        onEachFeature: (feature, featureLayer) => {
          const county = matchCountyFromGeoFeature(feature.properties);
          if (!county) {
            unmatched.push(feature.properties);
            return;
          }
          matched += 1;

          featureLayer.bindTooltip(
            `<strong>${escapeHtml(county.fullName)}</strong><br>` +
              `2024 Pop: ${formatNumber(county.population)}<br>` +
              `Fire: ${county.fire} &bull; EMS: ${county.ems} &bull; Law Enf.: ${county.le}<br>` +
              `2025 Opioid Funds Spent: <strong>${formatCurrency(county.opioidSpent)}</strong>`,
            { sticky: true }
          );

          featureLayer.on({
            mouseover: (e) => {
              e.target.setStyle(hoverStyle);
              e.target.bringToFront();
            },
            mouseout: (e) => layer.resetStyle(e.target),
            click: () => {
              window.location.href = `county.html?fips=${encodeURIComponent(county.fips)}`;
            }
          });
        }
      }).addTo(map);

      console.info(`County map: ${matched} of ${geojson.features.length} features matched a county.`);
      if (unmatched.length) {
        console.warn("County map: unmatched feature properties (first 3):", JSON.stringify(unmatched.slice(0, 3)));
      }

      if (layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), { padding: [12, 12] });
      }
    } catch (err) {
      console.warn("County map skipped:", err);
      mapEl.innerHTML = `<p style="padding:1rem;color:#475569;">Could not load ${escapeHtml(CFG.files.countyGeoJson)}.</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
