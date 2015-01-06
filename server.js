var restify = require('restify');
var sqlite3 = require('sqlite3');
var fs = require('fs');
var ini = require('ini');

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
var knex = require('knex')({
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
    var query = knex.select().from('results');
    var limit = req.query.limit ? req.query.limit : 10;
    query.limit(limit);
    if (req.query.offset) {
        query.offset(req.query.offset);
    }
    if (req.query.sort) {
        var direction = req.query.direction == 'ASC' ? req.query.direction : 'DESC';
        query.orderBy(req.query.sort, direction);
    }
    query.exec(function(err, rows) {
        if (err) {
            console.log(err);
            res.send(500, err);
        } else {
            res.send(rows);
        }
    });
    return next();
});

server.listen(8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});
