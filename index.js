const express = require('express')
const bodyParser = require('body-parser');
const pg = require('pg')
const path = require('path')
const url = require('url')
const PORT = process.env.PORT || 5000
const connectionString = process.env.DATABASE_URL || 'postgres://xixecnyvxikojr:74604844ba9a928bfd12c3d81d5e23df1cb4f92898b942e18dea2cd751b740b8@ec2-107-21-126-193.compute-1.amazonaws.com:5432/du5350tab150u';
const params = url.parse(connectionString);
const auth = params.auth.split(':');

const config = {
    user: auth[0],
    password: auth[1],
    host: params.hostname,
    port: params.port,
    database: params.pathname.split('/')[1],
    ssl: true
};

const pool = new pg.Pool(config);

var values = {
    username: null,
    password: null,
    usernameFound: false
}

express()
    .use(express.static(path.join(__dirname, 'public')))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    .get('/', function(request, response) {
        response.render('pages/index', values);
    })
    .post('/', function(request, response) {
        values.username = request.body.username;
        values.password = request.body.password;
        console.log(values.username);
        if (values.username == null) {
            response.render('pages/index', values);
        } else {
            getAccountByUsername(values.username, function(account) {
                if (account == null) {
                    response.render('pages/index', values)
                } else {
                    values.usernameFound = true;
                    response.render('pages/dashboard', values);
                }
            })
        }
    })
    .get('/dashboard', (req, res) => res.render('pages/dashboard'))
    .listen(PORT, () => console.log(`Listening on ${ PORT }`))

function getAccountByUsername(username, callbackFunction) {
    pool.connect(function(err, client, done) {
        if (err) {
            console.log("Can not connect to the DB" + err);
            callbackFunction(null);
            return;
        }
        var query = {
            name: 'fetch-username',
            text: 'SELECT id, username__c FROM salesforce.Account WHERE username__c = $1',
            values: [username]
        }
        client.query(query, function(err, result) {
            done();
            if (err) {
                console.log(err);
                callbackFunction(null);
                return;
            }
            if (result.rowCount > 0) {
                callbackFunction(result.rows[0]);
            } else {
                callbackFunction(null);
            }
            return;
        })
    })
}