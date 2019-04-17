let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
let hbs = require('express-hbs');

let routes = require('./routes/routes.js');

let app = express();

// view engine setup
app.engine('hbs', hbs.express4({ defaultLayout: __dirname + '/views/layouts/layout.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); //serves static files from a certain dir under url .com/filename
//app.use('/static', express.static(path.join(__dirname, 'public')));//serves them under the url .com/static/filename

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

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;