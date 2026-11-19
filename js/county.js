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
      treatment: "data/IATreatmentFacilities.csv"
    }
  };

  let currentCounty = null;
  let allMunicipalities = [];
  let balancePop = 0;

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

  function formatPct(part, total) {
    if (!total || total <= 0) return "0.00%";
    return `${((part / total) * 100).toFixed(2)}%`;
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

  function filterByFips(rows, targetFips, fipsCol = "FIPS") {
    return rows.filter((r) => normalizeFips(r[fipsCol]) === targetFips);
  }

  async function init() {
    const statusEl = document.getElementById("county-loading");

    try {
      const [
        fipsRows,
        popRows,
        fireRows,
        emsRows,
        leRows,
        healthRows,
        hospitalRows,
        treatmentRows
      ] = await Promise.all([
        parseCsv(CFG.files.fips),
        parseCsv(CFG.files.population),
        parseCsv(CFG.files.fire),
        parseCsv(CFG.files.ems),
        parseCsv(CFG.files.le),
        parseCsv(CFG.files.health),
        parseCsv(CFG.files.hospitals),
        parseCsv(CFG.files.treatment)
      ]);

      const counties = fipsRows
        .map((r) => {
          const fips = normalizeFips(r["FIPS"]);
          if (!fips) return null;
          const shortName = String(r["County Name"] || "").trim();
          const fullName = String(r["County"] || `${shortName} County`).trim();
          return { fips, shortName, fullName };
        })
        .filter(Boolean)
        .sort((a, b) => a.shortName.localeCompare(b.shortName));

      populateCountySwitcher(counties);

      const params = new URLSearchParams(window.location.search);
      const qFips = normalizeFips(params.get("fips"));
      const qCounty = normalizeCountyName(params.get("county"));

      currentCounty =
        counties.find((c) => c.fips === qFips) ||
        counties.find((c) => normalizeCountyName(c.shortName) === qCounty) ||
        counties[0];

      if (!currentCounty) {
        if (statusEl) statusEl.textContent = "No county records found in IACountyFIPS.csv.";
        return;
      }

      const selectEl = document.getElementById("county-select");
      if (selectEl) selectEl.value = currentCounty.fips;

      document.title = `${currentCounty.fullName} — Iowa County Directory`;
      document.getElementById("county-fips-label").textContent = `FIPS ${currentCounty.fips}`;
      document.getElementById("county-heading").textContent = currentCounty.fullName;

      // Population rows for this county
      const countyPopRows = popRows.filter(
        (r) => normalizeFips(r["county_fips_code"]) === currentCounty.fips
      );

      let totalCountyPop = 0;
      balancePop = 0;
      allMunicipalities = [];

      for (const row of countyPopRows) {
        const cityName = String(row["city"] || "").trim();
        const est = Number(String(row["estimate"] || "0").replace(/,/g, "")) || 0;
        totalCountyPop += est;

        if (/^Balance of /i.test(cityName)) {
          balancePop += est;
        } else if (cityName) {
          allMunicipalities.push({
            city: cityName,
            pop: est
          });
        }
      }

      // Filter agency & facility rows for this county
      const fireList = filterByFips(fireRows, currentCounty.fips, "FIPS");
      const emsList = filterByFips(emsRows, currentCounty.fips, "FIPS");
      const leList = filterByFips(leRows, currentCounty.fips, "FIPS");
      const healthList = filterByFips(healthRows, currentCounty.fips, "FIPS");
      const hospitalList = filterByFips(hospitalRows, currentCounty.fips, "FIPS");
      const treatmentList = filterByFips(treatmentRows, currentCounty.fips, "FIPS");

      // Populate top overview cards
      setText("c-pop", formatNumber(totalCountyPop));
      setText("c-muni-count", formatNumber(allMunicipalities.length));
      setText("c-fire", formatNumber(fireList.length));
      setText("c-ems", formatNumber(emsList.length));
      setText("c-le", formatNumber(leList.length));
      setText("c-hospitals", formatNumber(hospitalList.length));
      setText("c-health", formatNumber(healthList.length));
      setText("c-treatment", formatNumber(treatmentList.length));

      renderMunicipalities(totalCountyPop, "pop-desc", params.get("city") || "");
      setupMuniSort(totalCountyPop, params.get("city") || "");

      renderAgencyGroups({
        fireList,
        emsList,
        leList,
        hospitalList,
        healthList,
        treatmentList
      });

      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = `Error loading county data: ${err.message}`;
      }
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function populateCountySwitcher(counties) {
    const select = document.getElementById("county-select");
    if (!select) return;

    select.innerHTML = counties
      .map(
        (c) => `<option value="${escapeHtml(c.fips)}">${escapeHtml(c.fullName)} (${c.fips})</option>`
      )
      .join("");

    select.addEventListener("change", (e) => {
      if (e.target.value) {
        window.location.href = `county.html?fips=${encodeURIComponent(e.target.value)}`;
      }
    });
  }

  function renderMunicipalities(totalCountyPop, sortMode, highlightCity) {
    const tbody = document.getElementById("muni-table-body");
    const tfoot = document.getElementById("muni-table-foot");
    if (!tbody || !tfoot) return;

    const sorted = [...allMunicipalities].sort((a, b) => {
      if (sortMode === "name-asc") return a.city.localeCompare(b.city);
      if (sortMode === "pop-asc") return a.pop - b.pop || a.city.localeCompare(b.city);
      return b.pop - a.pop || a.city.localeCompare(b.city);
    });

    const normHighlight = String(highlightCity || "").trim().toLowerCase();

    tbody.innerHTML = sorted
      .map((m) => {
        const pctNum = totalCountyPop > 0 ? (m.pop / totalCountyPop) * 100 : 0;
        const widthPct = Math.min(100, Math.max(0, pctNum));
        const isHighlighted =
          normHighlight && m.city.toLowerCase().includes(normHighlight);

        return `
          <tr class="${isHighlighted ? "row-highlight" : ""}">
            <td><strong>${escapeHtml(m.city)}</strong></td>
            <td class="num-col">${formatNumber(m.pop)}</td>
            <td class="num-col">${pctNum.toFixed(2)}%</td>
            <td class="bar-col">
              <div class="pct-bar-track" aria-hidden="true">
                <div class="pct-bar-fill" style="width:${widthPct.toFixed(2)}%;"></div>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const muniSum = allMunicipalities.reduce((acc, m) => acc + m.pop, 0);

    tfoot.innerHTML = `
      ${
        balancePop > 0
          ? `
        <tr class="sub-row">
          <td>Balance of ${escapeHtml(currentCounty.shortName)} County (Unincorporated / Non-Municipal)</td>
          <td class="num-col">${formatNumber(balancePop)}</td>
          <td class="num-col">${formatPct(balancePop, totalCountyPop)}</td>
          <td class="bar-col"></td>
        </tr>
      `
          : ""
      }
      <tr class="total-row">
        <td>Incorporated Municipalities Subtotal</td>
        <td class="num-col">${formatNumber(muniSum)}</td>
        <td class="num-col">${formatPct(muniSum, totalCountyPop)}</td>
        <td class="bar-col"></td>
      </tr>
      <tr class="total-row">
        <td>Total ${escapeHtml(currentCounty.fullName)} Population (2024)</td>
        <td class="num-col">${formatNumber(totalCountyPop)}</td>
        <td class="num-col">100.00%</td>
        <td class="bar-col"></td>
      </tr>
    `;
  }

  function setupMuniSort(totalCountyPop, highlightCity) {
    const select = document.getElementById("muni-sort");
    if (!select) return;
    select.addEventListener("change", (e) => {
      renderMunicipalities(totalCountyPop, e.target.value, highlightCity);
    });
  }

  function renderAgencyCard(title, items, formatter) {
    const listHtml =
      items.length === 0
        ? `<p class="empty-note">None listed for this county in the dataset.</p>`
        : `<ul class="agency-list">${items.map((item) => `<li>${formatter(item)}</li>`).join("")}</ul>`;

    return `
      <div class="agency-card">
        <h3>${escapeHtml(title)} <span class="badge-count">${items.length}</span></h3>
        ${listHtml}
      </div>
    `;
  }

  function renderAgencyGroups({
    fireList,
    emsList,
    leList,
    hospitalList,
    healthList,
    treatmentList
  }) {
    const container = document.getElementById("agency-sections");
    if (!container) return;

    container.innerHTML = [
      renderAgencyCard("Fire Departments", fireList, (r) =>
        `<strong>${escapeHtml(r["Agency"] || "Unnamed Fire Dept")}</strong>` +
        (r["City"] ? ` <span class="item-meta">(${escapeHtml(r["City"])})</span>` : "")
      ),
      renderAgencyCard("EMS Agencies", emsList, (r) =>
        `<strong>${escapeHtml(r["Name"] || "Unnamed EMS Agency")}</strong>` +
        (r["City"] ? ` <span class="item-meta">(${escapeHtml(r["City"])})</span>` : "")
      ),
      renderAgencyCard("Law Enforcement Agencies", leList, (r) =>
        `<strong>${escapeHtml(r["AGENCYNAME"] || "Unnamed Agency")}</strong>` +
        (r["CITY"] ? ` <span class="item-meta">(${escapeHtml(r["CITY"])})</span>` : "")
      ),
      renderAgencyCard("Hospitals", hospitalList, (r) =>
        `<strong>${escapeHtml(r["Hospital"] || "Unnamed Hospital")}</strong>` +
        (r["City"] ? ` <span class="item-meta">(${escapeHtml(r["City"])})</span>` : "")
      ),
      renderAgencyCard("County Health Departments", healthList, (r) =>
        `<strong>${escapeHtml(r["Agency"] || "County Health Dept")}</strong>`
      ),
      renderAgencyCard("Treatment Facilities", treatmentList, (r) => {
        const name = r["name2"] ? `${r["name1"]} — ${r["name2"]}` : r["name1"];
        const loc = [r["city"], r["zip"]].filter(Boolean).join(" ");
        return (
          `<strong>${escapeHtml(name || "Treatment Facility")}</strong>` +
          (loc ? ` <span class="item-meta">(${escapeHtml(loc)})</span>` : "")
        );
      })
    ].join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
