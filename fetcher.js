var fs = require('fs'),
    http = require('http');
    https = require('https');

var parseString = require('xml2js').parseString;

const fstream = require('fstream');
const JSZip = require('JSZip');
const tj = require('@mapbox/togeojson');
const DOMParser = require('xmldom').DOMParser;

module.exports = function(){

    this.populateCurrentData = () => {
        const request = https.get("https://www.nhc.noaa.gov/gis/kml/nhc_active.kml", (res) => {
            var body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                parseActiveData(body);
            });
        });
    }

    this.populateOutlooks = () => {
        let outlookDir = __dirname + "/outlooks/";
        let url = "https://www.nhc.noaa.gov/xgtwo/gtwo_";
        let regions = ['atl', 'pac', 'cpac'];

        regions.forEach(element => {
            console.log(element);
            downloadKMZ(url + element + ".kmz", outlookDir + element);
        });

    }

    var parseActiveData = (sourceData) => {
        parseString(sourceData, function (err, result) {
            processActiveData(result);
        });
    }

    var processActiveData = (data) => {

        // Array to hold the active cyclones
        var activeCyclones = []; 

        // Get the overall KML Document
        var Document = data.kml.Document; 
        Document.forEach(element => {
            // Loop through the Document and get its Folders
            var Folder = element.Folder;
            Folder.forEach(element => {
                // Get the data in the Folder
                var FolderData = element;
                // Ignore Wind Speed Probabilities (for now)
                if(FolderData.$.id !== "wsp"){
                    var cycloneData = populateCycloneData(FolderData);
                    var cyclone = {
                        id: cycloneData.atcfID,
                        name: cycloneData.name,
                        dir: "/storms/" + cycloneData.atcfID + "/info.json"
                    }
                    // These are the current Topical Cyclones
                    activeCyclones.push(cyclone);
                }
            }); 
        });

        // Write the list of active storms
        fstream.Writer({ path: __dirname + "/storms/active.json"
                , mode: 0755
                })
        .write(JSON.stringify(activeCyclones));
    }

    var populateCycloneData = (cycloneData) => { 
        
        var cyclone = {
            products: []
        };

        // Set the Name
        cyclone.name = cycloneData.name[0];

        // Set more info about the storm
        cycloneData.ExtendedData.forEach(element => {
            if(element['tc:type']){
                cyclone.type = element['tc:type'][0];
                cyclone.wallet = element['tc:wallet'][0];
                cyclone.atcfID = element['tc:atcfID'][0];
                cyclone.centerLat = element['tc:centerLat'][0];
                cyclone.centerLon = element['tc:centerLon'][0];
                cyclone.dateTime = element['tc:dateTime'][0];
                cyclone.movement = element['tc:movement'][0];
                cyclone.minimumPressure = element['tc:minimumPressure'][0];
                cyclone.maxSustainedWind = element['tc:maxSustainedWind'][0];
            }
        })

        // Create the Directory to Store Cyclone Information and the shell for the Cyclone main info
        fstream.Writer({ path: __dirname + "/storms/" + cyclone.atcfID + "/info.json"
                , mode: 0755
                })
        .write("");

        // Get Path, Track, Cone, Winds, and Watches/Warnings
        cycloneData.NetworkLink.forEach(element => {
            var data = getLinkedData(element, cyclone.atcfID);
            cyclone.products.push(data); 
        })

         // Create the Directory to Store Cyclone Information and the shell for the Cyclone main info
        fstream.Writer({ path: __dirname + "/storms/" + cyclone.atcfID + "/info.json"
                , mode: 0755
                })
        .write(JSON.stringify(cyclone));
        return cyclone;
    }

    var getLinkedData = (link, storm) => {
        var linkData = {};
        linkData.product = link.$.id;
        linkData.dir = "/storms/" + storm + "/products/" + linkData.product; 

        // Download and create GeoJSON files for the products
        var href = link.Link[0].href[0];
        downloadKMZ(href, __dirname + '/storms/' + storm + "/" + linkData.product);

        return linkData;
    }

    var downloadKMZ = (link, directory) => {
        const request = https.get(link, (res) => {
            const initialStream = fs.createWriteStream(directory + '.zip');
            initialStream.on('open', () =>{
                let stream = res.pipe(initialStream);

                stream.on('finish', () => {
                    var new_zip = new JSZip();
                    // more files !
                    fs.readFile(directory + '.zip', function(err, data) {
                        if (err) throw err;
                        new_zip.loadAsync(data).then(function (zip) {
                            extractKML(zip, directory);
                        });
                    });
                });
            });
            
        });
    }

    var extractKML = (zip, directory) => {
        zip.forEach(element => {
            if(element.indexOf(".kml") > -1){
                zip.file(element).async("string").then(data => {
                    convertToGeoJSON(data, directory);
                })
            }
        });
    }

    var convertToGeoJSON = (kml, directory) => {
        var domKML = new DOMParser().parseFromString(kml);
        var geojson = tj.kml(domKML);

        fstream.Writer({ path: directory + ".geojson"
                , mode: 0755
                })
        .write(JSON.stringify(geojson));

        // Clean up Zip File
        fs.unlinkSync(directory + ".zip");
    }
}

