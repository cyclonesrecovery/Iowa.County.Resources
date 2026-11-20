# Iowa County Resources Directory

A free, open index of publicly available civic, emergency, health, and demographic information across all **99 counties in Iowa**.

## About This Project

This repository brings together public datasets by Iowa county so residents, researchers, planners, and community members can explore local resources in one place without paywalls or account requirements. Rather than creating new primary data, this project indexes and organizes information already published by public agencies and reference sources—pairing department and facility counts with 2024 city and county population estimates and municipal population shares.

The site is built as a static web application hosted on **GitHub Pages**, reading directly from CSV and GeoJSON files in the repository.

https://cyclonesrecovery.github.io/Iowa.County.Resources/

## What's Indexed

* **Demographics & Population Shares**: 2024 city and county population estimates (`IACityCountyPopulation2024.csv`) and county FIPS reference codes (`IACountyFIPS.csv`) to calculate each municipality's share of total county population.
* **Emergency & Public Safety Services**: Fire departments (`FireDeptsByCounty.csv`), EMS agencies (`EMSByCounty.csv`), and law enforcement agencies (`LEAgenciesByCounty.csv`).
* **Health & Treatment Infrastructure**: County public health departments (`IACountyHealthDepts.csv`), hospitals (`IAHospitalsByCounty.csv`), and treatment facilities (`IATreatmentFacilities.csv`).
* **Geographic Boundaries**: County (`County.geojson`), municipal limit (`City_Limit_Boundaries_for_the_State_of_Iowa.geojson`), and township (`Political_Township.geojson`) boundary files.
* **Source Attribution**: Reference links for underlying datasets in `DataSources.csv`.

## Public Data Sources

All underlying records come from publicly available sources listed in data/DataSources.csv, including:

    Hospitals: Iowa Department of Health and Human Services (HHS)

    EMS Agencies: Iowa Department of Public Health / AMANDA Portal

    Fire Departments: Data.iowa.gov (Dataset 1294)

    Law Enforcement Agencies: NACJD / ICPSR

    Treatment Facilities: SAMHSA National Directory

    City & County Population: Data.iowa.gov (Dataset 705, 2024 estimates)

    County Health Departments: NACCHO Local Health Department Directory

    PSAPS & FIPS Codes: FCC / U.S. Department of Transportation reference datasets

Notes & Accuracy

Because this directory aggregates existing public files, coverage, naming conventions, and reporting dates depend on each underlying source. Some datasets include out-of-state or unmapped entries (such as non-Iowa EMS rows or multi-county split cities marked (pt.)), which are filtered or handled carefully when aggregating county-level totals.
Contributing & Feedback

Spot a missing department, outdated link, or CSV formatting issue? Feel free to open an issue or submit a pull request with updated public source details.

## Repository Structure

```text
├── index.html                                         # Statewide overview, search, map, and 99-county directory
├── county.html                                        # Individual county breakdown and municipal population shares
├── County.geojson                                     # Iowa county boundary geometry
├── Political_Township.geojson                         # Iowa political township geometry
├── css/
│   └── styles.css                                     # Site styling
├── js/
│   ├── index.js                                       # Loads datasets for the main directory and map
│   └── county.js                                      # Computes county metrics, agency lists, and city pop. %
└── data/
    ├── City_Limit_Boundaries_for_the_State_of_Iowa.geojson
    ├── DataSources.csv
    ├── EMSByCounty.csv
    ├── FireDeptsByCounty.csv
    ├── IACityCountyPopulation2024.csv
    ├── IACountyFIPS.csv
    ├── IACountyHealthDepts.csv
    ├── IAHospitalsByCounty.csv
    ├── IATreatmentFacilities.csv
    └── LEAgenciesByCounty.csv

