/**
 * @name
 *      FOREST PLANTATION SPATIAL-TEMPORAL FILTERS C9 
 * 
 * @description
 *      Filter for Mapbiomas Collection 9 Forest Plantation class.
 * 
 * @author
 *      Remap
 *      mapbiomas@remapgeo.com
 *
 * @version
 *  MapBiomas Collection 9.0
 * 
 */
 
 
var filters = require('users/your_user/your_path_to:utils/temporal_spatial_filters.js');

var temporal = filters.temporal; 
var spatial = filters.spatial;


// set the input path to the raw classification result:
var input = 'users/your_username/MAPBIOMAS/C9/FOREST_PLANTATION/RESULTS/RAW';

// set the path for the filtered result:
var output = 'users/your_username/MAPBIOMAS/C9/FOREST_PLANTATION/RESULTS/TEMPORAL_SPATIAL_FILTERED';

var collection = ee.ImageCollection(input)



// define masks
var brasil = ee.Image('projects/mapbiomas-workspace/AUXILIAR/ESTATISTICAS/COLECAO5/country-raster')
var ESTADOS = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/estados-2016')


var regions = ESTADOS.filter(ee.Filter.or(
                ee.Filter.equals('SIGLA_UF', 'PA'),
                ee.Filter.equals('SIGLA_UF', 'TO'),
                ee.Filter.equals('SIGLA_UF', 'AP'),
                ee.Filter.equals('SIGLA_UF', 'MA'),
                ee.Filter.equals('SIGLA_UF', 'CE'),
                ee.Filter.equals('SIGLA_UF', 'MT'),
                ee.Filter.equals('SIGLA_UF', 'RS')
                ))
                
                
var mask = ee.Image(1).clip(regions)



// get regions to filter
var collection_w5t2 = collection.map(function(image) {
  return image.updateMask(mask).updateMask(brasil)
})

var collection_w5t3 = collection.map(function(image) {
  return image.updateMask(brasil)
})




// filter a

var filtersToApply = [
  spatial.build(spatial.minConnnectedPixels(6)),
  
  temporal.build(temporal.getMovingWindow(1986, 1986, 3), temporal.thresholdFilter(2)), // 3 years window, 1986 only
  temporal.build(temporal.getMovingWindow(1987, 2020, 5), temporal.thresholdFilter(2)), // 7 years window, 1988 to 2017


  spatial.build(spatial.minConnnectedPixels(6)),
]

var filteredCollection__w5t2 = filters.applyFilters(filtersToApply, collection_w5t2);


// filter b

var filtersToApply = [
  spatial.build(spatial.minConnnectedPixels(6)),
  
  temporal.build(temporal.getMovingWindow(1986, 1995, 3), temporal.thresholdFilter(2)), 
  temporal.build(temporal.getMovingWindow(1995, 2017, 5), temporal.thresholdFilter(3)), 
  temporal.build(temporal.getMovingWindow(2019, 2021, 3), temporal.thresholdFilter(1)), 


  spatial.build(spatial.minConnnectedPixels(6)),
]

var filteredCollection__w5t3 = filters.applyFilters(filtersToApply, collection_w5t3);

var filteredCollection = filteredCollection__w5t2.merge(filteredCollection__w5t3).map(function(img){return img.cast({'classification':'byte'})})

// print (filteredCollection)
// Map.addLayer(filteredCollection)


var filteredCollection = ee.ImageCollection(
  ee.List.sequence(1985, 2021).map(function(ano){
  var result = filteredCollection.filter(ee.Filter.eq(ee.String('year'), ee.Number(ano))).max()
  var merged = result.rename(ee.String('classification')).set(ee.String('year'), ee.Number(ano))
  return merged.cast({'classification':'byte'})
  })
)



// copy 1986 to 1985
var firstYear = filteredCollection.filterMetadata('year', 'equals', 1986).first();
filteredCollection = filteredCollection
  .filter(ee.Filter.inList('year', [1985]).not())
  .merge(ee.ImageCollection([
    firstYear.set('year', 1985)
  ]))
  .sort('year')
  
  
// set years greather than 2015 as forest plantation 
var setToForestPlantation_1 = filteredCollection.filter(ee.Filter.inList('year', [2013, 2014, 2015])).and()

var last5Year = filteredCollection
  .filterMetadata('year', 'greater_than', 2015)
  .map(function(image) {
    return image.or(setToForestPlantation_1).set('year', image.getNumber('year'))
  })

var filteredCollection = filteredCollection
  .filterMetadata('year', 'not_greater_than', 2015)
  .merge(last5Year).sort('year')


// filled

var filteredCollection = filteredCollection
  .merge(ee.ImageCollection([
    ee.Image(0).rename('classification').set('year', 1984),
    ee.Image(0).rename('classification').set('year', 2022)
  ]))
  .sort('year')

var filled = ee.List.sequence(1985, 2021).map(function(year) {
  var before = filteredCollection.filterMetadata('year', 'less_than', year).sum()
  var thisYear = filteredCollection.filterMetadata('year', 'equals', year).first().unmask()
  var after = filteredCollection.filterMetadata('year', 'greater_than', year).sum()
  
  return thisYear.or(before.and(after)).set('year', year)
})

filled = ee.ImageCollection(filled)

// print (filled)

// to bands
var filtered = filters.toBandsByYear(filled).updateMask(brasil)


// print (filtered)

var year = 2010

Map.addLayer(filtered.selfMask(), { bands: 'b' + year, palette: ['BLUE']}, 'Filtered')


Export.image.toAsset({
  image: filtered.unmask().byte(), 
  description: 'FOREST_PLANTATION_TEMPORAL_SPATIAL_FILTER', 
  assetId: output,
  region: brasil.geometry(), 
  scale: 30, 
  maxPixels: 10e10
})
