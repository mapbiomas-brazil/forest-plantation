<div>
    <img src='./assets/logo.png' height='auto' width='200' align='right'>
    <h1>Forest Plantation</h1>
</div>

Developed by ***Agrosatélite Geotecnologia Aplicada Ltda***.

## About

This folder contains the scripts to classify and post-process the **Forest Plantation** theme. 

We recommend that you read the [Forest Plantation Appendix of the Algorithm Theoretical Basis Document (ATBD)](https://mapbiomas.org/download-dos-atbds), since important informations about the forest plantation classification methodology can be found in there. 

## How to use

First, you need to copy these scripts (including those in [utils folder](./utils)) to your Google Earth Engine (**GEE**) account.

Then, in your **GEE** account, go to the **Assets tab**, create the following directory structure:

 - MAPBIOMAS/C7/FOREST_PLANTATION/RESULTS

and create one **Image Collections**:

 - MAPBIOMAS/C7/FOREST_PLANTATION/RESULTS/**RAW**

### Classification

To run the classification, follow these steps:

1. Open the script **forest_plantation/01_classification.js**;

2. On **line 20** (variable `index`), set the path to the [index.js](./utils/index.js) script you copied to your GEE account

3. On **line 22** (variable `getNormalizedCollection`), set the path to the [normalization.js](./utils/normalization.js) script you copied to your GEE account

4. On **line 24** (variable `cloudLib`), set the path to the [cloud.js](./utils/cloud.js) script you copied to your GEE account

5. On **line 42** (variable `outputCollection`), set the output path for the classification results;

6. On **line 44** (variable `years`), set the years you want to classify;
    
7. On **line 46** (variable `tiles`), set the WRS (path and row) you want to classify;
    
8. On **line 160** (variable `periods`), set the periods for the region you want to classify (more information about that you can read on the [ATBD Forest Plantation Appendix](https://mapbiomas.org/download-dos-atbds));
    
9. On **line 244** (variable `reference`), set the path to your reference map that will be used for sampling;
  
10. Run the script.

### Post-processing

To apply the temporal and spatial filters, follow these steps: 

1. Open the script **forest_plantation/02_spatial_temporal_filter.js**;

2. On **line 18** (variable `filters`), set the path to the [temporal_spatial_filters.js](../utils/temporal_spatial_filters.js) script you copied to your GEE account;

3. On **line 25** (variable `input`), set the path to the raw classification result;

4. On **line 28** (variable `output`), set the path for the filtered result;

5. Run the script.
