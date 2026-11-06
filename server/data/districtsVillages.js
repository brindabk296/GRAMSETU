const path = require('path');

const censusDirectory = require(path.join(
  __dirname,
  '../../client/public/locations/jharkhandCensus2011.json'
));

module.exports = censusDirectory.districts;
