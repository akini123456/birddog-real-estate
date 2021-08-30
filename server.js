// Node JS Imports
const path = require("path");
const fetch = require("node-fetch");
const Excel = require("exceljs");

// Imports SEO JSON
const seo = require("./src/seo.json");

// Imports the stateinfo json
const stateinfo = require("./src/stateinfo.json");

// Sets up the fastify requirements
const fastify = require("fastify")({
  logger: false
});

fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public"),
  prefix: "/"
});

fastify.register(require("fastify-formbody"));

fastify.register(require("point-of-view"), {
  engine: {
    handlebars: require("handlebars")
  }
});

// Zillow Urls
const zillowBaseUrl = "https://www.zillow.com";

// Request Options
const options = {
  method: "GET",
  headers: {
    "User-Agent":
      "Mozilla: Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.3 Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/43.4"
  },
  body: null,
  redirect: "follow",
  signal: null,
  follow: 20,
  compress: true,
  size: 0,
  agent: null,
  highWaterMark: 16384,
  insecureHTTPParser: false
};

// Homepage Request
fastify.get("/", function(request, reply) {
  // Sends SEO Data
  let params = { seo: seo };

  // Returns Homepage
  reply.view("/src/pages/index.hbs", params);
});

// Home Data Request
fastify.post("/", async function(request, reply) {
  // SEO Params
  let params = { seo: seo };

  // User Selected State
  let state = request.body.selectstate;

  // Request Homes JSON
  var zillowSearchUrl =
    'https://www.zillow.com/search/GetSearchPageState.htm?searchQueryState={"pagination":{},"usersSearchTerm":"' +
    state +
    '","mapBounds":{"west": ' +
    stateinfo[state].west.toString() +
    ',"east":' +
    stateinfo[state].east.toString() +
    ',"south":' +
    stateinfo[state].south.toString() +
    ',"north":' +
    stateinfo[state].north.toString() +
    '},"mapZoom":' +
    stateinfo[state].mapZoom.toString() +
    ',"category":"cat2","regionSelection":[{"regionId":' +
    stateinfo[state].regionId.toString() +
    ',"regionType":' +
    stateinfo[state].regionType.toString() +
    '}],"isMapVisible":true,"filterState":{"price":{"min":0,"max":300000},"beds":{"min":2},"baths":{"min":1.5},"isForSaleForeclosure":{"value":false},"isApartment":{"value":false},"isMultiFamily":{"value":false},"monthlyPayment":{"min":0,"max":729},"isAllHomes":{"value":true},"isAuction":{"value":false},"isNewConstruction":{"value":false},"isLotLand":{"value":false},"isManufactured":{"value":false},"isComingSoon":{"value":false},"isForSaleByAgent":{"value":false}},"isListVisible":true}&wants={"cat2":["mapResults"]}&requestId=2';
  var homes = await fetch(zillowSearchUrl, options);
  homes = await homes.json();

  // Select Data Within JSON
  homes = homes.cat2;
  homes = homes.searchResults;
  homes = homes.mapResults;

  // Loops through the homes for data
  var homesInformation = [];

  for (let home of homes) {
    var homeZillowUrl = zillowBaseUrl + home["detailUrl"];
    var homeAddress = home["detailUrl"].split("/")[2];
    var homePrice = home["price"];
    var homeBedrooms = home["beds"];
    var homeBathrooms = home["baths"];

    homesInformation.push([homeAddress, homePrice, homeBedrooms, homeBathrooms, homeZillowUrl, "", "", ""]);
  }

  // Creates Excel Workbook
  let workbook = new Excel.Workbook();

  // Creates Excel Worksheet
  let worksheet = workbook.addWorksheet("Available Homes");

  // Creates Excel Column
  worksheet.columns = [
    { header: "Address", key: "address", width: 45 },
    { header: "Price", key: "price", width: 10 },
    { header: "Bedrooms", key: "bedrooms", width: 9 },
    { header: "Bathrooms", key: "bathrooms", width: 10 },
    { header: "Zillow URL", key: "zillowurl", width: 20 },
    { header: "Contact", key: "contact", width: 35 },
    { header: "Contacted?", key: "contacted", width: 10 },
    { header: "Notes", key: "notes", width: 65 }
  ];

  // Writes the rows of home information
  worksheet.addRows(homesInformation);

  // Sets Headers
  var fileName = state + ".xlsx";

  reply.headers({
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": "attachment; filename=" + fileName
  });

  // Returns the Xcel file
  const buffer = await workbook.xlsx.writeBuffer()
  reply.send(buffer)
});

// Run the server and report out to the logs
fastify.listen(process.env.PORT, function(err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
  fastify.log.info(`server listening on ${address}`);
});
