(function () {
  const CFG = window.IA_CONFIG;
  const { normalizeFips, parseNumber, formatNumber, formatCurrency, escapeHtml, setText, loadCsvs } = window.IA;

  let currentCounty = null;
  let allMunicipalities = [];
  let balancePop = 0;

  // Page-specific helpers
  function normalizeCountyName(raw) {
    return String(raw || "").trim().replace(/\s+County$/i, "").toLowerCase();
  }

  function formatPct(part, total) {
    if (!total || total <= 0) return "0.00%";
    return `${((part / total) * 100).toFixed(2)}%`;
  }

  function filterByFips(rows, targetFips, fipsCol = "FIPS") {
    return rows.filter((r) => normalizeFips(r[fipsCol]) === targetFips);
  }

  async function init() {
    const statusEl = document.getElementById("county-loading");

    try {
      const d = await loadCsvs(CFG.files, [
        "fips", "population", "fire", "ems", "le",
        "health", "hospitals", "treatment", "opioidFunding"
      ]);

      const counties = d.fips
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
      setText("county-fips-label", `FIPS ${currentCounty.fips}`);
      setText("county-heading", currentCounty.fullName);

      // Population rows for this county
      let totalCountyPop = 0;
      balancePop = 0;
      allMunicipalities = [];

      for (const row of d.population) {
        if (normalizeFips(row["county_fips_code"]) !== currentCounty.fips) continue;

        const cityName = String(row["city"] || "").trim();
        const est = parseNumber(row["estimate"]);
        totalCountyPop += est;

        if (/^Balance of /i.test(cityName)) {
          balancePop += est;
        } else if (cityName) {
          allMunicipalities.push({ city: cityName, pop: est });
        }
      }

      // Agency & facility rows for this county
      const lists = {
        fireList: filterByFips(d.fire, currentCounty.fips),
        emsList: filterByFips(d.ems, currentCounty.fips),
        leList: filterByFips(d.le, currentCounty.fips),
        hospitalList: filterByFips(d.hospitals, currentCounty.fips),
        healthList: filterByFips(d.health, currentCounty.fips),
        treatmentList: filterByFips(d.treatment, currentCounty.fips)
      };

      // Overview cards
      setText("c-pop", formatNumber(totalCountyPop));
      setText("c-muni-count", formatNumber(allMunicipalities.length));
      setText("c-fire", formatNumber(lists.fireList.length));
      setText("c-ems", formatNumber(lists.emsList.length));
      setText("c-le", formatNumber(lists.leList.length));
      setText("c-hospitals", formatNumber(lists.hospitalList.length));
      setText("c-health", formatNumber(lists.healthList.length));
      setText("c-treatment", formatNumber(lists.treatmentList.length));

      const highlightCity = params.get("city") || "";
      renderMunicipalities(totalCountyPop, "pop-desc", highlightCity);
      setupMuniSort(totalCountyPop, highlightCity);
      renderOpioidFunding(d.opioidFunding, currentCounty);
      renderAgencyGroups(lists);

      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = `Error loading county data: ${err.message}`;
      }
    }
  }

  function populateCountySwitcher(counties) {
    const select = document.getElementById("county-select");
    if (!select) return;

    select.innerHTML = counties
      .map((c) => `<option value="${escapeHtml(c.fips)}">${escapeHtml(c.fullName)} (${c.fips})</option>`)
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
        const isHighlighted = normHighlight && m.city.toLowerCase().includes(normHighlight);

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

  function renderOpioidFunding(opioidRows, county) {
    const container = document.getElementById("opioid-funding-section");
    if (!container) return;

    const match = opioidRows.find((r) => normalizeFips(r["FIPS"]) === county.fips);

    if (!match) {
      container.innerHTML = `
        <h2 id="opioid-heading">2025 Opioid Settlement Funding</h2>
        <p class="empty-note">No opioid settlement funding record found for ${escapeHtml(county.fullName)}.</p>
      `;
      return;
    }

    const activities = String(match["Funded Activities"] || "").trim();
    const card = (field, label) => `
        <div class="stat-card">
          <span class="stat-value">${formatCurrency(match[field])}</span>
          <span class="stat-label">${label}</span>
        </div>`;

    container.innerHTML = `
      <h2 id="opioid-heading">2025 Opioid Settlement Funding</h2>
      <div class="stats-grid">
        ${card("Start Balance", "Start Balance")}
        ${card("Funds Received", "Funds Received")}
        ${card("Expenditures", "Expenditures")}
        ${card("End Balance", "End Balance")}
      </div>
      <div class="agency-card" style="margin-top: 1rem;">
        <h3>Funded Activities</h3>
        <p>${activities ? escapeHtml(activities) : "No funded activities listed."}</p>
      </div>
    `;
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

  // "<strong>Name</strong> (City)" row used by most agency types
  function nameWithCity(nameCol, cityCol, fallback) {
    return (r) =>
      `<strong>${escapeHtml(r[nameCol] || fallback)}</strong>` +
      (r[cityCol] ? ` <span class="item-meta">(${escapeHtml(r[cityCol])})</span>` : "");
  }

  function renderAgencyGroups({ fireList, emsList, leList, hospitalList, healthList, treatmentList }) {
    const container = document.getElementById("agency-sections");
    if (!container) return;

    container.innerHTML = [
      renderAgencyCard("Fire Departments", fireList, nameWithCity("Agency", "City", "Unnamed Fire Dept")),
      renderAgencyCard("EMS Agencies", emsList, nameWithCity("Name", "City", "Unnamed EMS Agency")),
      renderAgencyCard("Law Enforcement Agencies", leList, nameWithCity("AGENCYNAME", "CITY", "Unnamed Agency")),
      renderAgencyCard("Hospitals", hospitalList, nameWithCity("Hospital", "City", "Unnamed Hospital")),
      renderAgencyCard("County Health Departments", healthList, (r) =>
        `<strong>${escapeHtml(r["Agency"] || "County Health Dept")}</strong>`
      ),
      renderAgencyCard("Treatment Facilities", treatmentList, (r) => {
        const name = [r["name1"], r["name2"]].filter(Boolean).join(" — ");
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
