// Shared utilities for index.js and county.js.
// Exposes a single global: window.IA
(function (global) {
  "use strict";

  const IA = {};

  /**
   * Normalize a FIPS value to a 5-digit Iowa code ("19xxx"), or "" if invalid.
   * By default 1-3 digit county-only codes are padded ("1" -> "19001").
   * Pass { allowShort: false } to accept only full 5-digit 19xxx codes
   * (recommended for any dataset that isn't IACountyFIPS.csv).
   */
  IA.normalizeFips = function (raw, opts) {
    if (raw === null || raw === undefined) return "";
    const allowShort = !opts || opts.allowShort !== false;
    const cleaned = String(raw).trim().replace(/\.0$/, "");
    if (/^19\d{3}$/.test(cleaned)) return cleaned;
    if (allowShort && /^\d{1,3}$/.test(cleaned)) return `19${cleaned.padStart(3, "0")}`;
    return "";
  };

  /** Parse "$1,234.50" / "1,234" / 12 into a finite number (0 if unparseable). */
  IA.parseNumber = function (val) {
    const n = Number(String(val ?? "0").replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  IA.formatNumber = function (num) {
    return Number(num || 0).toLocaleString("en-US");
  };

  IA.formatCurrency = function (val) {
    return IA.parseNumber(val).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  IA.escapeHtml = function (str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /** Return the trimmed URL if it is http(s), otherwise "". Blocks javascript: etc. */
  IA.safeUrl = function (raw) {
    const url = String(raw ?? "").trim();
    return /^https?:\/\//i.test(url) ? url : "";
  };

  IA.setText = function (id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  /** Parse one CSV (URL) into an array of row objects. */
  IA.parseCsv = function (url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data || []),
        error: (err) => reject(new Error(`Failed to load ${url}: ${err.message || err}`))
      });
    });
  };

  /**
   * Load several CSVs in parallel from a config file map.
   *   const d = await IA.loadCsvs(CFG.files, ["fips", "population"]);
   *   d.fips, d.population -> row arrays
   */
  IA.loadCsvs = async function (fileMap, keys) {
    const rows = await Promise.all(keys.map((k) => IA.parseCsv(fileMap[k])));
    return Object.fromEntries(keys.map((k, i) => [k, rows[i]]));
  };

  global.IA = IA;
})(window);
