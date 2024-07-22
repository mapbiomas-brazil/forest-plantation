/**
 * @name
 *      FOREST PLANTATION CLASSIFICATION C9
 * 
 * @description
 *      Classification script for Mapbiomas Collection 9 Forest Plantation class.
 * 
 * @author
 *      Remap
 *      mapbiomas@remapgeo.com
 *
 * @version
 *  MapBiomas Collection 9.0
 *   
 */


// Set the path to the scripts you copied to your GEE account:
//Indexes
  var index = require('users/your_user/your_path_to:utils/indexes.js');
//Normalization
  var getNormalizedCollection = require("users/your_user/your_path_to:utils/normalization.js").getNormalizedCollection;
//Cloud Mask
  var cloudLib = require("users/your_user/your_path_to:utils/cloud.js");

// ============================================================================
//                                  IMPORTS
// ============================================================================

// Landsat Grid Collection (with peak vegetation month as a property) 
var gridCollection = ee.FeatureCollection("users/mapbiomas1/PUBLIC/GRIDS/BRASIL_COMPLETO_PEAK")

// Subtiles for stratified sampling
var SubTile = ee.FeatureCollection("users/mapbiomas1/PUBLIC/GRIDS/SUBTILES")



// ============================================================================
//                                  INPUTS
// ============================================================================

var outputCollection = 'users/your_username/MAPBIOMAS/C9/FOREST_PLANTATION/RESULTS/RAW/'

var years = [2014]

var cloudCover = 80
var indexes = ['MNDWI', 'EVI2', 'LAI']

var bands = ["BLUE", "GREEN", "RED", "NIR", "SWIR1", "SWIR2"]
var imagesLimit = 10

var max_error = 30

var trainingSamplesNumber = 10000
var randomForestTrees = 100

var tiles = [[215,68]]



var featureSpace = [

    'P1_BLUE_stdDev', 'P1_GREEN_stdDev', 'P1_RED_stdDev', 'P1_NIR_stdDev', 'P1_SWIR1_stdDev', 'P1_SWIR2_stdDev',
    'P1_EVI2_stdDev', 'P1_MNDWI_stdDev', 'P1_LAI_stdDev',

    'P1_BLUE_median', 'P1_GREEN_median', 'P1_RED_median', 'P1_NIR_median', 'P1_SWIR1_median', 'P1_SWIR2_median',
    'P1_EVI2_median', 'P1_MNDWI_median', 'P1_LAI_median',

    'P1_BLUE_p80', 'P1_GREEN_p80', 'P1_RED_p80', 'P1_NIR_p80', 'P1_SWIR1_p80', 'P1_SWIR2_p80',
    'P1_EVI2_p80', 'P1_MNDWI_p80', 'P1_LAI_p80',

    'P1_BLUE_qmo', 'P1_GREEN_qmo', 'P1_RED_qmo', 'P1_NIR_qmo', 'P1_SWIR1_qmo', 'P1_SWIR2_qmo', 
    'P1_EVI2_qmo', 'P1_MNDWI_qmo', 'P1_LAI_qmo',



    'P2_BLUE_stdDev', 'P2_GREEN_stdDev', 'P2_RED_stdDev', 'P2_NIR_stdDev', 'P2_SWIR1_stdDev', 'P2_SWIR2_stdDev',
    'P2_EVI2_stdDev', 'P2_MNDWI_stdDev', 'P2_LAI_stdDev',

    'P2_BLUE_median', 'P2_GREEN_median', 'P2_RED_median', 'P2_NIR_median', 'P2_SWIR1_median', 'P2_SWIR2_median',
    'P2_EVI2_median', 'P2_MNDWI_median', 'P2_LAI_median',

    'P2_BLUE_p80', 'P2_GREEN_p80', 'P2_RED_p80', 'P2_NIR_p80', 'P2_SWIR1_p80', 'P2_SWIR2_p80',
    'P2_EVI2_p80', 'P2_MNDWI_p80', 'P2_LAI_p80',

    'P2_BLUE_qmo', 'P2_GREEN_qmo', 'P2_RED_qmo', 'P2_NIR_qmo', 'P2_SWIR1_qmo', 'P2_SWIR2_qmo', 
    'P2_EVI2_qmo', 'P2_MNDWI_qmo', 'P2_LAI_qmo',

]

// ============================================================================
//                                  FUNCTIONS
// ============================================================================


function addSuffix(sufix) {
  return function (bandName) {
    return ee.String(bandName).cat(sufix)
  }
}

function getMosaic(collection) {
  
    var bandNames = collection.first().bandNames()
    
    var qmo = collection.qualityMosaic("EVI2")
    .rename(bandNames.map(addSuffix("_qmo")))

   var reducers = (
        ee.Reducer.median()
        .combine(ee.Reducer.mean(), null, true)
        .combine(ee.Reducer.max(), null, true)
        .combine(ee.Reducer.min(), null, true)
        .combine(ee.Reducer.stdDev(), null, true)
        .combine(ee.Reducer.percentile([80]), null, true)
    )

   var mosaic = (
        ee.ImageCollection(collection)
        .reduce(reducers)
        .addBands(qmo)
        .multiply(10000)
        .toInt16()
    )

    return mosaic
}



function filterCollection(collection, spacecraft) {
  return collection
    .filterMetadata('SPACECRAFT_ID', 'equals', spacecraft)
    .limit(imagesLimit, "CLOUD_COVER_LAND")
}

function get_collection(image){
    var cloud_mask = image.select("QA_SCORE").eq(1)
    var res_img = image.select(bands).updateMask(cloud_mask)

    return index.calculateIndexes(res_img, indexes);
}


function calcArea(geom, image) {
  return image.multiply(ee.Image.pixelArea()).multiply(0.0001).reduceRegions({
    collection: geom,
    reducer: ee.Reducer.sum(),
    scale: 30,
  });
}



// ============================================================================
//                                  MOSAIC
// ============================================================================


var periods = {
    'P1': [year+"-01-01",year+"-07-01"],
    'P2': [year+"-07-01",(year+1)+"-01-01"],
    }

var Landsat8 = ee.ImageCollection("LANDSAT/LC08/C01/T1_TOA");
var Landsat7 = ee.ImageCollection("LANDSAT/LE07/C01/T1_TOA");
var Landsat5 = ee.ImageCollection("LANDSAT/LT05/C01/T1_TOA");


years.forEach(function (year) {
    
  tiles.forEach(function (tile) {
    
    var path = tile[0];
    var row = tile[1];

    var roi = gridCollection
      .filterMetadata('PATH', "equals", path)
      .filterMetadata('ROW', "equals", row)
      
    var geometry = roi.geometry(max_error)
    var centroid = geometry.centroid(30)
    
    Map.centerObject(roi)

  // create Mosaic

    var full_mosaic = [];

        for (var period in periods) {
        
          var dates = periods[period];
        
          var startDate = dates[0]
          var endDate = dates[1]

          var collection = ee.ImageCollection(getNormalizedCollection(centroid, startDate, endDate, cloudCover, bands, true))

          collection = collection.map(get_collection)
          
          var mosaic = null
      
          var L8Mosaic = getMosaic(filterCollection(collection, 'LANDSAT_8'))
          var L7Mosaic = getMosaic(filterCollection(collection, 'LANDSAT_7'))
          var L5Mosaic = getMosaic(filterCollection(collection, 'LANDSAT_5'))

          if (year >= 2013) {
            mosaic = L8Mosaic.unmask(L7Mosaic)
          } else 
          if (year == 2012) {
            mosaic = L7Mosaic
          } else
          if (year >= 2003 && year < 2012) {
            mosaic = L5Mosaic.unmask(L7Mosaic)
          } else
          if (year >= 2000 && year < 2003) {
            mosaic = L7Mosaic.unmask(L5Mosaic)
          } else
          if (year < 2000) {
            mosaic = L5Mosaic
          }
        
          mosaic = mosaic.rename(
          ee
            .Image(mosaic)
            .bandNames()
            .map(function (band) {
              return ee.String(period).cat("_").cat(band);
            })
        );
        
        full_mosaic.push(mosaic);
        
        }
        var final_mosaic = ee.Image.cat(full_mosaic).clip(roi);

  
    // ============================================================================
    //                        STRARTIFIED SAMPLING
    // ============================================================================
        // Reference map for sampling
            // **NOTE: the reference map used for MapBiomas forest plantation is not public.
            //         The MapBiomas classification is used here as an example. 
        var refMap = ee.Image('projects/mapbiomas-workspace/public/collection6/mapbiomas_collection60_integration_v1')
                                .select('classification_'+year)
                                .remap([9], [1]) // Forest Plantation

                                
        var areaRoi = ee.Number(geometry.area()).divide(1e4)

        var subtile_roi = SubTile.filterBounds(roi)  

        var reference_roi = refMap.unmask().clip(roi)

        var nonsilv = reference_roi.eq(0)
        var silv = reference_roi.eq(1)

        var silv_area = calcArea(subtile_roi, silv)
        var nonsilv_area = calcArea(subtile_roi, nonsilv)

        var area_silv = silv_area.select(["Id", "sum"], ["Id", "silv"])
        var area_nonsilv = nonsilv_area.select(["Id", "sum"], ["Id", "others"])
        
        /////////////////
        var sumAreas = subtile_roi.map(function(ft){
          var id_filter = ee.Filter.eq('Id', ft.get('Id'))
        
          ft = ft.set('others', area_nonsilv.filter(id_filter).first().get('others'),
                    'silv', area_silv.filter(id_filter).first().get('silv')
          
                    )
        
          return ft.set('total', ft.getNumber('others')
                          .add(ft.getNumber('silv')))

      })
      
    

      /////////////////
      var percent_area_subtile = sumAreas
        .map(function (feature) {
          var feat_silv = feature.set(
            "percentual_silv",
            ee
              .Number(feature.get("silv"))
              .divide(ee.Number(feature.get("total")))
              .add(0.10)
          );
          var feat_others = feat_silv.set(
            "percentual_others",
            ee
              .Number(feat_silv.get("others"))
              .divide(ee.Number(feat_silv.get("total")))
              .subtract(0.10)
          );
          var new_total = feat_others.set(
            "percentual_tile",
            ee
              .Number(feat_others.get("total"))
              .divide(ee.Number(areaRoi))
          );
          return new_total;
        })
        
    
      
      // Samples //

      var train = final_mosaic
        .unmask()
        .addBands(reference_roi.select([0], ["class"]).unmask());

      var trainingSamples = percent_area_subtile
        .map(function (subtile) {
          var areas = ee.Dictionary({
            others: subtile.get("percentual_others"),
            silv: subtile.get("percentual_silv"),
          });

          var trainingSamplesSubTile = ee
            .Number(trainingSamplesNumber)
            .multiply(ee.Number(subtile.get("percentual_tile")));
          var others = ee.Number(areas.get("others"));
          var silv = ee.Number(areas.get("silv"));
        
          var sample = ee.Number(trainingSamplesSubTile);

          var samples = train.stratifiedSample({
            numPoints: 1,
            classBand: "class",
            region: subtile.geometry(),
            scale: 30,
            seed: 11,
            classValues: [0, 1],
            classPoints: [
              sample.multiply(others).int(),
              sample.multiply(silv).int(),
            ],
            tileScale: 4,
            geometries: true,
          });
          return samples;
        })
        .flatten();

      var training = trainingSamples
      
  // ============================================================================
  //                                  CLASSIFICATION
  // ============================================================================
    
      var classifier = ee.Classifier
        .smileRandomForest(randomForestTrees)
        .train(training, 'class', final_mosaic.bandNames());
      
      var classified = final_mosaic.classify(classifier)
        .set('year', year)
        .rename(['classification'])


      // Visualization //
      var filename = year + '_' + path + '_' + row;
      
      Map.addLayer(final_mosaic, {bands: ['P1_NIR_median', 'P1_SWIR1_median', 'P1_RED_median'], min: 0, max: 5000}, 'Mosaic ' + filename, false);
      Map.addLayer(classified.selfMask(), {"opacity":1,"bands":["classification"],"min":0,"max":3,"palette":["ffffff","ff826e","16ff7e","5008ff"]}, 'Classification ' + filename, false);
      Map.addLayer(training, {}, 'Samples ' + filename, false);
      Map.addLayer(reference_roi.selfMask(),{},'Mapa de Referência '+ filename, false);
    
      var filename = path+''+row+'_'+year
    
      // Exporting Results //
      Export.image.toAsset({
        image: classified.byte().set('year',year), 
        description: 'SILVICULTURE_RAW' + filename, 
        assetId: outputCollection + filename, 
        region: roi, 
        scale: 10, 
        maxPixels: 1.0E13
      })
        
  })
})