'use strict';
let express = require('express'),
    router = express.Router(),
    loginModule = require('./../modules/loginModule'),
    signUpModule = require('./../modules/signUpModule'),
    crypto = require('crypto');
require('dotenv').config();

// router.all('/student-section/*', requireAuthentication, loadUser);
// router.all('/teacher-section/*', requireAuthentication, loadUser);

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'English For Professional and Academic Communication extra credit page'
    });
});

router.get('/student-sign-up', function (req, res, next) {
    res.render('signUpS', {
        title: 'Sign up',
        signUpSuccess: req.session.signUpSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.signUpSuccess = null;
});

router.post('/student-sign-up', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail()//.matches(/[\w]*@alumnos.upm.es/);
    console.log("POST received on signup", req.body);
    //let pssMatch = new RegExp('.*'); //Proper validation to be added later on
    //req.check('password', 'Invalid password').isLength({ min: 8 }).equals(req.body.confirmPassword).matches(pssMatch);//TO-DO
    let errors = req.validationErrors(),
        hash = crypto.createHash('sha256');
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        return res.redirect('/student-sign-up');
    }
    signUpModule("s", req.body.email, hash.update(req.body.password).digest('base64'), req.body.name, req.body.surname, req.body.studentID, req.body.teacherID).then(() => {
        console.log("Came back from inserting successfully\n");
        req.session.signUpSuccess = true;
        req.session.errors = null;
        return res.redirect('/student-login');
    }).catch(() => {
        console.log("There are errors on DB access (sign up)\n");
        req.session.errors = "Unable to write to database. Please contact an administrator or faculty";
        req.session.signUpSuccess = false;
        return res.redirect('/student-sign-up');
    });
});

router.get('/student-login', function (req, res, next) {
    res.render('loginS', {
        title: 'Login',
        signUpSuccess: req.session.signUpSuccess,
        logInSuccess: req.session.logInSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.logInSuccess = null;
    req.session.signUpSuccess = null;
});

router.post('/student-login', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail()//.matches(/[\w]*@alumnos.upm.es/);
    let errors = req.validationErrors(),
        hash = crypto.createHash('sha256');
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.logInSuccess = false;
        return res.redirect('/student-login');
    } else if (loginModule("s", req.body.email, hash.update(req.body.password).digest('base64'))) {
        console.log("Came back from checking successfully");
        req.session.logInSuccess = true;
        req.session.errors = null;
        return res.redirect('/student-section');
    } else {
        console.log("There are errors on DB access (sign up)");
        req.session.errors = "Unable to write to database. Please contact an administrator or faculty";
        req.session.logInSuccess = false;
        return res.sendStatus(404);
    }
});

router.get('/teacher-sign-up', function (req, res, next) {
    res.render('signUpT', {
        title: 'Sign up',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
});

router.get('/teacher-login', function (req, res, next) {
    res.render('loginT', {
        title: 'Login',
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


//Sources: https://o7planning.org/en/11959/connecting-to-mysql-database-using-nodejs
//https://appdividend.com/2018/08/25/how-to-connect-nodejs-application-to-mysql-database/

module.exports = router;