'use strict';
require('dotenv').config(); //loads .env file
const createError = require('http-errors'),
    routes = require('./routes/routes.js'),
    express = require('express'),
    expressValidator = require('express-validator'),
    session = require('express-session'),
    path = require('path'),
    cookieParser = require('cookie-parser'),
    logger = require('morgan'), //For request method logging
    hbs = require('express-hbs'),
    MySQLStore = require('express-mysql-session')(session);

const app = express(),
    INPROD = (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "PROD");

// view engine setup
app.engine('hbs', hbs.express4({ layoutsDir: __dirname + "/views/layouts", defaultLayout: null })); //defaultLayout: __dirname + '/views/layouts/layout.hbs'
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.set('env', process.env.NODE_ENV);
app.set('x-powered-by', false);

//Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(expressValidator());
app.use(express.static(path.join(__dirname, 'public'))); //serves static files from a certain dir under url .com/filename
//app.use('/static', express.static(path.join(__dirname, 'public')));//would serve them under the url .com/static/filename
app.use(session({
    name: process.env.SESS_NAME,
    secret: process.env.SESS_SECRET,
    saveUninitialized: false, //empty sessions aren't saved
    resave: false, //unaltered sessions aren't saved
    store: new MySQLStore({ //sessions are stored in DB, not in browser memory
        connectionLimit: 40,
        host: process.env.db_host,
        port: process.env.db_port,
        user: process.env.db_session_user,
        password: process.env.db_session_pass,
        database: process.env.db_name,
        clearExpired: true
    }),
    cookie: {
        maxAge: parseInt(process.env.SESS_LIFETIME), //ms before expiration after last request
        sameSite: true, //cookies only work in our domain
        //secure: INPROD //they will require HTTPS
    }
}));

//Limiting number of requests per IP
/* Would require a new rateLimiterByRequest = new MySQLRateLimiter({...})) here, as well as new env variables such as MAX_REQUESTS and MAX_REQUEST_RESET_TIME
It would overlap with the login one, which would have to be changed to a user-based/email block. Might be too much of a hassle for something that may never be needed
sources: https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example
        https://github.com/animir/node-rate-limiter-flexible/wiki/API-methods
*/
/* app.use((req, res, next) => {
    rateLimiterByRequest.consume(req.ip)
        .then((rateLimiterRes) => {
            console.log("Successful request by IP: " + req.ip);
            console.log(rateLimiterRes);
            next();
        })
        .catch((rejection) => {
            console.log("Blocked request by IP: " + req.ip);
            console.log(rejection);
            res.status(429).send('Too Many Requests');
        });
}) */

//if user is logged in, we move him to locals
app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.user = req.session.user;
        res.locals.userType = req.session.userType;
    }
    next();
});
app.use('/', routes); //defined above

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    if (!INPROD) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = !INPROD ? err : {}; //res.locals.error = req.app.get('env') === 'development' ? err : {};
        res.status(err.status || 500);

        res.render('error');

    //redirect to main page
    //res.redirect('/');
    }else{
        res.render('errorProd');
    }
});

//response headers
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

module.exports = app;