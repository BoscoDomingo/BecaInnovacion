'use strict';
const createError = require('http-errors'),
    express = require('express'),
    path = require('path'),
    cookieParser = require('cookie-parser'),
    logger = require('morgan'),
    hbs = require('express-hbs'),
    expressValidator = require('express-validator'),
    session = require('express-session');
require('dotenv').config(); //loads .env file

const routes = require('./routes/routes.js'),
    app = express(),
    INPROD = process.env.NODE_ENV === "production";

// view engine setup
app.engine('hbs', hbs.express4({ layoutsDir: __dirname + "/views/layouts", defaultLayout: null })); //defaultLayout: __dirname + '/views/layouts/layout.hbs'
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

//Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(expressValidator());
app.use(express.static(path.join(__dirname, 'public'))); //serves static files from a certain dir under url .com/filename
//app.use('/static', express.static(path.join(__dirname, 'public')));//would serve them under the url .com/static/filename

app.use(session({
    secret: process.env.SESS_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        maxAge: process.env.SESS_LIFETIME,
        sameSite: true,
        secure: INPROD
    }
}));

app.use('/', routes); //defined above

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);

    // render the error page
    res.render('error');

    //redirect to main page
    //res.redirect('/');
});

//response headers
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

module.exports = app;