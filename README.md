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
