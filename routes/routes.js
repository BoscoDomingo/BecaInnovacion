var express = require('express');
var router = express.Router();
require('dotenv').config();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'English For Professional and Academic Communication extra credit page',
        layout: null
    });
});

router.get('/student-sign-up', function (req, res, next) {
    res.render('signUpS', {
        title: 'Sign up',
        layout: 'signUpLayout',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
});

router.post('/student-sign-up/submit', function (req, res, next) {
    req.check('password', 'Invalid password').isLength({ min: 8 }).equals(req.body.confirmPassword);
    req.check('email', 'Invalid email address').isEmail();
    let errors = req.validationErrors()
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
    }
    res.redirect('/student-login');

});

router.get('/student-login', function (req, res, next) {
    res.render('loginS', {
        title: 'Login',
        layout: 'loginLayout',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
});

router.post('/student-login/submit', function (req, res, next) {
    req.check('password', 'Invalid password').isLength({ min: 8 }).equals(req.body.confirmPassword);
    req.check('email', 'Invalid email address').isEmail();
    let errors = req.validationErrors()
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
    }
    res.redirect('/student-section');
});

router.get('/teacher-sign-up', function (req, res, next) {
    res.render('signUpT', {
        title: 'Sign up',
        layout: 'signUpLayout',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
});

router.get('/teacher-login', function (req, res, next) {
    res.render('loginT', {
        title: 'Login',
        layout: 'loginLayout',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
});

router.get('/student-section', function (req, res, next) {
    res.render('homePageS', {
        title: 'Home Page',
        layout: 'menuLayout'
    });
});
//URL: localhost:port/users/
/* GET users listing. */
// router.get('/users', function (req, res, next) {
//     res.render(...);
//     res.redirect('url path');
// });

let mysql = require('mysql');

let connection = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: process.env.db_user_S,
    password: process.env.db_pass_S,
    database: 'test-db'
});

connection.connect((err) => {
    if (err) console.log(err);
})

connection.query('SELECT * FROM students', function (err, rows, fields) {
    if (err) throw err;
    console.log('The solution is: ', rows[0])
})

connection.end()

//Sources: https://o7planning.org/en/11959/connecting-to-mysql-database-using-nodejs
//https://appdividend.com/2018/08/25/how-to-connect-nodejs-application-to-mysql-database/

module.exports = router;