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
        layout: 'signUpLayout',
        signUpSuccess: req.session.signUpSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.signUpSuccess = null;
});

router.post('/student-sign-up/submit', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail();
    let pssMatch = new RegExp('*'); //Proper validation to be added later on
    req.check('password', 'Invalid password').isLength({ min: 8 }).equals(req.body.confirmPassword).matches(pssMatch);
    let errors = req.validationErrors()
    if (errors) {
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        res.redirect('/student-sign-up');
    } else if (signUpModule("s", req.body.email, req.body.password, req.body.name, req.body.surname, req.body.ID)) {
        req.session.signUpSuccess = true;
        req.session.errors = null;
        res.redirect('/student-login');
    } else {
        req.session.errors = "Unable to write to database. Please contact an administrator or faculty";
        req.session.signUpSuccess = false;
        res.redirect('/student-sign-up');
    }
});

router.get('/student-login', function (req, res, next) {
    res.render('loginS', {
        title: 'Login',
        layout: 'loginLayout',
        signUpSuccess: req.session.signUpSuccess,
        logInSuccess: req.session.logInSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.logInSuccess = null;
    req.session.signUpSuccess = null;
});

router.post('/student-login/submit', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail();
    let hashPassword = crypto.sha256(req.body.password);
    req.check('password', 'Invalid password');
    let errors = req.validationErrors()
    if (errors) {
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        res.redirect('/student-login');
    } else {
        req.session.signUpSuccess = true;
        req.session.errors = null;
        res.redirect('/student-section');
    }
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


//Sources: https://o7planning.org/en/11959/connecting-to-mysql-database-using-nodejs
//https://appdividend.com/2018/08/25/how-to-connect-nodejs-application-to-mysql-database/

module.exports = router;