// Single source of truth for data file locations.
// Loaded before common.js and the page scripts on every page.
window.IA_CONFIG = {
  files: {
    fips: "data/IACountyFIPS.csv",
    population: "data/IACityCountyPopulation2024.csv",
    fire: "data/FireDeptsByCounty.csv",
    ems: "data/EMSByCounty.csv",
    le: "data/LEAgenciesByCounty.csv",
    health: "data/IACountyHealthDepts.csv",
    hospitals: "data/IAHospitalsByCounty.csv",
    treatment: "data/IATreatmentFacilities.csv",
    sources: "data/DataSources.csv",
    countyGeoJson: "County.geojson"
  }
};
