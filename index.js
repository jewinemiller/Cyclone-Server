const express = require('express');
const fs = require('fs'); 
var cors = require('cors')
const Path = require('path');

require('./fetcher.js')();

const app = express()
app.use(cors())

const port = 8080

const deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file, index) => {
        const curPath = Path.join(path, file);
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };

populateAllData = () => {
    console.log("Populating Storm Data");
    deleteFolderRecursive(__dirname + "/storms");
    populateCurrentData();
    populateOutlooks();
}

populateAllData();

setInterval(function() {
    populateAllData();
}, 60 * 60 * 1000); 

app.get('/outlooks/:region', (req,res) => {
  let fileExists = fs.existsSync(__dirname + "/outlooks/" + req.params["region"] + ".geojson");
    if(fileExists){
        res.header("Content-Type",'application/json');
        res.sendFile(__dirname + "/outlooks/" + req.params["region"] + ".geojson")
    } else {
        res.sendStatus(404);
    }
});

app.get('/storms', (req,res) => {
    res.header("Content-Type",'application/json');
    res.sendFile(__dirname + '/storms/active.json');
});

app.get('/storms/:storm', (req,res) => {
    let fileExists = fs.existsSync(__dirname + "/storms/" + req.params["storm"] + "/info.json");
    if(fileExists){
        res.header("Content-Type",'application/json');
        res.sendFile(__dirname + "/storms/" + req.params["storm"] + "/info.json")
    } else {
        res.sendStatus(404);
    }
})

app.get('/storms/:storm/products/:product', (req, res) => {
    let fileExists = fs.existsSync(__dirname + "/storms/" + req.params["storm"] + "/" + req.params["product"] + ".geojson");
    if(fileExists){
        res.header("Content-Type",'application/json');
        res.sendFile(__dirname + "/storms/" + req.params["storm"] + "/" + req.params["product"] + ".geojson")
    } else {
        res.sendStatus(404);
    }
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})