var restify = require('restify');
var sqlite3 = require('sqlite3');
var fs = require('fs');
var ini = require('ini');

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
var knex = require('knex')({
    debug: config.debug == true,
    client: 'sqlite3',
    connection: {
        filename: config.dbFile
    }
});

var server = restify.createServer({
    name: 'overclockers',
    version: '1.0.0'
});
server.use(restify.queryParser());
server.use(
    function crossOrigin(req,res,next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'X-Requested-With');
        return next();
    }
);

server.get('/result/:id', function (req, res, next) {
    res.charSet('utf-8');
    var query = knex.select().from('results').where({id: req.params.id}).limit(1);
    query.exec(function(err, rows) {
        if (err) {
            console.log(err);
            res.send(500, err);
        } else {
            if (rows.length == 0) {
                res.send(404, "Not found");
            } else {
                res.send(rows[0]);
            }
        }
    });
    return next();
});

server.get('/result', function (req, res, next) {
    res.charSet('utf-8');
    var responseObject = {
        draw: parseInt(req.query.draw),
        recordsTotal: 0,
        recordsFiltered: 0,
        aaData: []
    };
    var queryCount = knex.select().from('results').count('id as cnt');
    queryCount.exec(function(err, rows) {
        if (err) {
            responseObject.error = err;
            res.send(500, responseObject);
        } else {
            responseObject.recordsTotal = rows[0].cnt;
            responseObject.recordsFiltered = rows[0].cnt;
        }
    });
    var query = knex
        .select(knex.raw('("oc-multiplier" * "oc-fsb") AS "oc-frequency", *'))
        .from('results');
    var filtered = false;
    for (var colNum in req.query.columns) {
        var column = req.query.columns[colNum];
        if (column.search.value) {
            query.where(column.data, column.search.value);
            queryCount.where(column.data, column.search.value);
            filtered = true;
        }
    }
    if (filtered) {
        queryCount.exec(function(err, rows) {
            if (err) {
                responseObject.error = err;
                res.send(500, responseObject);
            } else {
                responseObject.recordsFiltered = rows[0].cnt;
            }
        });
    }
    var limit = req.query.length ? req.query.length : 10;
    query.limit(limit);
    if (req.query.start) {
        query.offset(req.query.start);
    }
    var sortColumn = 'id', sortDirection = 'DESC';
    if (req.query.order) {
        sortColumn = req.query.columns[req.query.order[0].column].data;
        sortDirection = req.query.order[0].dir;
    }
    query.orderBy(sortColumn, sortDirection);
    query.exec(function(err, rows) {
        if (err) {
            console.log(err);
            responseObject.error = err;
            res.send(500, responseObject);
        } else {
            responseObject.aaData = rows;
            res.send(responseObject);
        }
    });
    return next();
});

server.get('/core', function (req, res, next) {
    res.charSet('utf-8');
    var query = knex.select('core').from('results').groupBy('core').orderBy('core', 'asc');
    query.exec(function(err, rows) {
        if (err) {
            console.log(err);
            res.send(500, err);
        } else {
            var cores = [];
            for (var i in rows) {
                cores.push(rows[i].core);
            }
            res.send(cores);
        }
    });
    return next();
});

server.listen(8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});
