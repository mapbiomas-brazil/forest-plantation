// Set the path to the temporal_spatial_filters.js script you copied to your GEE account:
var filters = require('users/your_username/repository:utils/temporal_spatial_filters.js');

var temporal = filters.temporal;
var spatial = filters.spatial;

// set the input path to the raw classification result:
var input = 'users/your_username/MAPBIOMAS/C6/FOREST_PLANTATION/RESULTS/RAW';

// set the path for the filtered result:
var output = 'users/your_username/MAPBIOMAS/C6/FOREST_PLANTATION/RESULTS/TEMPORAL_SPATIAL_FILTERED';

var add = ee.Geometry.Polygon(
  [[[-43.55611927267485, -2.771066486650524],
  [-43.55611927267485, -13.371738608730073],
  [-37.22799427267485, -13.371738608730073],
  [-37.22799427267485, -2.771066486650524]]], null, false)

var geometry = ee.Geometry.Polygon(
  [[[-74.74844337202919, 5.676986563126004],
  [-74.74844337202919, -34.11108145272765],
  [-34.40664649702919, -34.11108145272765],
  [-34.40664649702919, 5.676986563126004]]], null, false)

var collection = ee.ImageCollection(input)

collection = ee.List.sequence(1985, 2019)
  .map(function (year) {
    var yearlyMosaic = collection
      .filterMetadata('year', 'equals', year)
      .or()
      .set('year', year);

    return yearlyMosaic
  })

collection = ee.ImageCollection(collection)

// define masks
var brasil = ee.Image('projects/mapbiomas-workspace/AUXILIAR/ESTATISTICAS/COLECAO5/country-raster')
var ESTADOS = ee.FeatureCollection('users/agrosatelite_mapbiomas/REGIONS/ibge_estados_2019')

var regions = ESTADOS
  .filter(ee.Filter.inList('SIGLA_UF', ['PA', 'TO', 'AP', 'MA', 'CE', 'MT', 'RS']))
  .merge(add)

var mask = ee.Image(1).clip(regions)


// get regions to filter
var collection_w5t2 = collection.map(function (image) {
  return image.updateMask(mask).updateMask(brasil)
})

var collection_w5t3 = collection.map(function (image) {
  return image.updateMask(brasil)
})

// filter a

var filtersToApply = [
  spatial.build(spatial.minConnnectedPixels(6)),

  temporal.build(temporal.getMovingWindow(1986, 1986, 3), temporal.thresholdFilter(2)), // 3 years window, 1986 only
  temporal.build(temporal.getMovingWindow(1987, 2019, 5), temporal.thresholdFilter(2)), // 7 years window, 1988 to 2017

  spatial.build(spatial.minConnnectedPixels(6)),
]

var filteredCollection__w5t2 = filters.applyFilters(filtersToApply, collection_w5t2);


// filter b

var filtersToApply = [
  spatial.build(spatial.minConnnectedPixels(6)),

  temporal.build(temporal.getMovingWindow(1986, 1995, 3), temporal.thresholdFilter(2)),
  temporal.build(temporal.getMovingWindow(1995, 2017, 5), temporal.thresholdFilter(3)),
  temporal.build(temporal.getMovingWindow(2018, 2020, 3), temporal.thresholdFilter(1)),

  spatial.build(spatial.minConnnectedPixels(6)),
]

var filteredCollection__w5t3 = filters.applyFilters(filtersToApply, collection_w5t3);



var filteredCollection = filteredCollection__w5t2.merge(filteredCollection__w5t3)

var filteredCollection = ee.List.sequence(1985, 2020).getInfo().map(function (year) {
  var result = filteredCollection.filterMetadata('year', 'equals', year).max()
  var merged = result.unmask().rename('classification').set('year', year)
  return merged
}).sort('year')

filteredCollection = ee.ImageCollection(filteredCollection)


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
  .map(function (image) {
    return image.or(setToForestPlantation_1).set('year', image.getNumber('year'))
  })

filteredCollection = filteredCollection
  .filterMetadata('year', 'not_greater_than', 2015)
  .merge(last5Year).sort('year')


// filled

var filteredCollection = filteredCollection
  .merge(ee.ImageCollection([
    ee.Image(0).rename('classification').set('year', 1984),
    ee.Image(0).rename('classification').set('year', 2021)
  ]))
  .sort('year')

var filled = ee.List.sequence(1985, 2020).getInfo().map(function (year) {
  var before = filteredCollection.filterMetadata('year', 'less_than', year).sum()
  var thisYear = filteredCollection.filterMetadata('year', 'equals', year).first().unmask()
  var after = filteredCollection.filterMetadata('year', 'greater_than', year).sum()

  return thisYear.or(before.and(after)).set('year', year)
})

filled = ee.ImageCollection(filled)


// to bands
var raw = filters.toBandsByYear(collection).byte().updateMask(brasil)
var filtered = filters.toBandsByYear(filled).byte().updateMask(brasil)

var visYear = 2019

Map.addLayer(raw.selfMask(), { bands: 'b' + visYear, palette: ['RED'] }, 'Raw ' + visYear)
Map.addLayer(filtered.selfMask(), { bands: 'b' + visYear, palette: ['BLUE'] }, 'Filtered ' + visYear)

Export.image.toAsset({
  image: filtered.unmask().byte(),
  description: 'FOREST_PLANTATION_TEMPORAL_SPATIAL_FILTER',
  assetId: output,
  region: geometry,
  scale: 30,
  maxPixels: 10e10
})
