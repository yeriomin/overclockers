#!/usr/bin/env node

var fs = require('fs');
var ini = require('ini');
var iconv = require('iconv-lite');
var sqlite3 = require('sqlite3');
var argv = require('yargs').argv;
var cheerio = require('cheerio'), $;

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

if (argv.file) {
    // Getting file from fs if it exists
    if (fs.existsSync(argv.file)) {
        console.log('Reading "' + argv.file + '"');
        fs.readFile(argv.file, function(err, data) {
            if (err) throw err;
            parseOverclockersPage(data);
        });
    } else {
        console.log('File "' + argv.file + '" not found');
        process.exit(1);
    }
} else {
    // Otherwise downloading the whole db
    var http = require('http');
    console.log('Downloading from ' + config.url);
    callback = function(response) {
        var len = parseInt(response.headers['content-length'], 10);
        var bytesReceived = 0;
        var responseText = ''
        response.on('data', function (chunk) {
            bytesReceived += chunk.length;
            process.stdout.write("\r" + Math.round(bytesReceived / 1048576) + " Mb received");
            responseText += chunk;
        });
        response.on('end', function () {
            console.log();
            console.log('Download complete');
            parseOverclockersPage(responseText);
        });
    }
    var req = http.get(config.url, callback);
    req.end();
}

function initDb(db) {
    // Creating db and indexes
    var queryCreate = 'CREATE TABLE IF NOT EXISTS results (\
"author-name" VARCHAR(100), \
"author-mail" VARCHAR(100), \
"core" VARCHAR(100), \
"batch" VARCHAR(100), \
"reference-frequency" INT, \
"reference-fsb" INT, \
"oc-fsb" INT, \
"oc-multiplier" REAL, \
"screenshot-id" INT, \
"vcore" REAL, \
"date" INT, \
"motherboard" VARCHAR(100), \
"bios-version" VARCHAR(100), \
"cooler" VARCHAR(100), \
"max-temperature" REAL, \
"id" INT PRIMARY KEY, \
"comment" TEXT\
)';
    db.exec(queryCreate);
    db.exec('CREATE INDEX IF NOT EXISTS index_author_name ON results ("author-name")');
    db.exec('CREATE INDEX IF NOT EXISTS index_core ON results ("core")');
    db.exec('CREATE INDEX IF NOT EXISTS index_date ON results ("date")');
    db.exec('PRAGMA journal_mode=OFF');
}

function parseOverclockersPage(html) {
    console.log('Initializing db');
    var db = new sqlite3.Database(config.dbFile);
    initDb(db)

    console.log('Converting to utf-8');
    var utf8String = iconv.decode(html, 'win1251');

    console.log('Parsing');
    $ = cheerio.load(utf8String);

    console.log('Getting raw results');
    var resultNodes = $('#hypercontext').find('table');
    var resultCount = resultNodes.length;

    console.log('Filtering results');
    var realResultNodes = [];
    for (var i = 0; i < resultCount; i++) {
        if ($(resultNodes[i]).hasClass('tsmall')
            || $(resultNodes[i]).attr('cellpadding') == '2'
            || resultNodes[i].parentNode.tagName == 'b'
        ) {
            continue;
        }
        realResultNodes.push(resultNodes[i]);
    }

    var realResultCount = realResultNodes.length;
    var queryInsert = 'REPLACE INTO results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    var stmt = db.prepare(queryInsert);

    console.log('Walking ' + realResultCount + ' result tables and inserting');
    var time1 = new Date().getTime(), time2 = 0, done = 0;
    for (var i = 0; i < realResultCount; i++) {
        stmt.run(parseResult(realResultNodes[i]), function() {
            done++;
            time2 = new Date().getTime();
            if (time2 - time1 > 500) {
                time1 = time2;
                var percent = Math.round(done / realResultCount * 100);
                process.stdout.write("\rExecuting transaction... " + percent + "%");
            }
            if (done == realResultCount) {
                process.stdout.write("\r");
                console.log('Executing transaction... Done');
            }
        });
        time2 = new Date().getTime();
        if (time2 - time1 > 500) {
            time1 = time2;
            var percent = Math.round(i / realResultCount * 100);
            process.stdout.write("\rPreparing transaction... " + percent + "%");
        }
    }
    process.stdout.write("\r");
    console.log('Preparing transaction... Done');

    stmt.finalize();
    db.close(function() { console.log('All done'); });
}

function parseResult(resultTable) {
    // Parsing one result and filling the array to be inserted into db
    var resultObject = {
        'author-name': '',
        'author-mail': '',
        'core': '',
        'batch': '',
        'reference-frequency': 0,
        'reference-fsb': 0,
        'oc-fsb': 0,
        'oc-multiplier': 0,
        'screenshot-id': 0,
        'vcore': 0,
        'date': 0,
        'motherboard': '',
        'bios-version': '',
        'cooler': '',
        'max-temperature': 0,
        'id': 0,
        'comment': ''
    };
    var count = 0;
    var trNodes = $(resultTable).find('tr').get(), trCount = trNodes.length;
    for (var i = 0; i < trCount; i++) {
        var trNode = trNodes[i];
        if ($(trNode).hasClass('th2')) {
            continue;
        }
        var tdNodes = $(trNode).find('td').get(), tdCount = tdNodes.length;
        for (var j = 0; j < tdCount; j++) {
            var tdNode = $(tdNodes[j]);
            switch (count) {
                case 0:
                    resultObject = getAuthor(tdNode, resultObject);
                    break;
                case 1:
                    resultObject = getCore(tdNode, resultObject);
                    break;
                case 2:
                    resultObject = getBatch(tdNode, resultObject);
                    break;
                case 3:
                    resultObject = getReferenceFrequency(tdNode, resultObject);
                    break;
                case 4:
                    resultObject = getOcFrequency(tdNode, resultObject);
                    break;
                case 8:
                    resultObject = getVcore(tdNode, resultObject);
                    break;
                case 12:
                    resultObject = getSubmitDate(tdNode, resultObject);
                    break;
                case 13:
                    resultObject = getMotherboard(tdNode, resultObject);
                    break;
                case 14:
                    resultObject = getBiosVersion(tdNode, resultObject);
                    break;
                case 15:
                    resultObject = getCooler(tdNode, resultObject);
                    break;
                case 16:
                    resultObject = getTemperature(tdNode, resultObject);
                    break;
                case 17:
                    resultObject = getId(tdNode, resultObject);
                    break;
                case 19:
                    resultObject = getComment(tdNode, resultObject);
                    break;
            }
            count++;
        }
    }
    var bind = [];
    for (var key in resultObject) {
        bind.push(resultObject[key]);
    }
    return bind;
}

function getAuthor(node, result) {
    var aNodes = node.find('a').get();
    if (aNodes.length == 0) {
        result['author-name'] = node.text().trim();
    } else {
        var a = $(aNodes[0]);
        result['author-name'] = a.text().trim();
        var mail = a.attr('href');
        var mailto = 'mailto:';
        result['author-mail'] = mail.indexOf(mailto) >= 0
            ? mail.substr(mailto.length)
            : mail
        ;
    }
    return result;
}

function getCore(node, result) {
    result['core'] = node.text()
    return result;
}

function getBatch(node, result) {
    result['batch'] = node.text();
    return result;
}

function getReferenceFrequency(node, result) {
    var parts = node.text().split(' ');
    result['reference-frequency'] = parseInt(parts[0].trim());
    result['reference-fsb'] = parseInt(parts[1].trim().substr(1));
    return result;
}

function getOcFrequency(node, result) {
    var parts = node.text().split(' ');
    result['oc-fsb'] = parseInt(parts[1].trim().substr(1));
    result['oc-multiplier'] = parseFloat(parts[3].trim().match(/[0-9\.]*/)[0]);
    var tdNodes = node.find('td').get(), tdCount = tdNodes.length;
    if (tdCount > 1) {
        var aNodes = $(tdNodes[1]).find('a');
        if (aNodes.length > 0) {
            var aNode = $(aNodes.get(0));
            var href = aNode.attr('href');
            result['screenshot-id'] = parseInt(href.match(/([0-9]+)/)[0]);
        }
    }
    return result;
}

function getVcore(node, result) {
    result['vcore'] = parseFloat(node.text());
    return result;
}

function getSubmitDate(node, result) {
    var parts = node.text().split('.');
    var date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 0, 0, 0, 0);
    result['date'] = date.getTime();
    return result;
}

function getMotherboard(node, result) {
    result['motherboard'] = node.text();
    return result;
}

function getBiosVersion(node, result) {
    result['bios-version'] = node.text();
    return result;
}

function getCooler(node, result) {
    result['cooler'] = node.text();
    return result;
}

function getTemperature(node, result) {
    result['max-temperature'] = parseInt(node.text());
    return result;
}

function getId(node, result) {
    result['id'] = parseInt(node.text());
    return result;
}

function getComment(node, result) {
    result['comment'] = node.text();
    return result;
}
