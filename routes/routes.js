'use strict';
const express = require('express'),
    router = express.Router(),
    loginModule = require('./../modules/loginModule'),
    signUpModule = require('./../modules/signUpModule'),
    crypto = require('crypto');
require('dotenv').config();

const studentEmailRegExp = /^[\w.!#$%&’*+/=?^_`{|}~-ÑñÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸç]+(@alumnos.upm.es)$/, //accepted email characters
    passwordRegEx = /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\W\w\S]{8,}$/;//Has 1 uppercase, 1 lowercase, 1 number
// /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\w.!#$%&’*+/=?^_`{|}~\-ÑñáéíóúüÁÉÍÓÚÜ:;ÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸ¡¿çÇŒœßØøÅå ÆæÞþÐð""'.,&#@:?!()$\\/]{8,}$/
// alternative passwordRegEx

// router.all('/student-section/*', requireAuthentication, loadUser);
// router.all('/teacher-section/*', requireAuthentication, loadUser);

/* GET home page. */
//HELPERS
function convertToUPMEmail(emailInput) {
    let auxIndex = emailInput.indexOf("@");
    if (auxIndex !== -1) {
        emailInput = emailInput.substring(0, auxIndex);
    }
    emailInput = emailInput + "@alumnos.upm.es";
    return emailInput;
}

//ROUTES
router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'English For Professional and Academic Communication extra credit page'
    });
});

router.get('/student-sign-up', function (req, res, next) {
    res.render('signUpS', {
        title: 'Sign up',
        errors: req.session.errors
    });
    //to flush them on reload
    req.session.errors = null;
}).post('/student-sign-up', function (req, res, next) {
    console.log("POST received on signup", req.body); //DELETE BEFORE DELIVERY
    req.body.email = convertToUPMEmail(req.body.email);

    req.check('email', 'Invalid email address').isEmail().matches(studentEmailRegExp);
    //req.check('password', 'Invalid password').equals(req.body.confirmPassword).matches(passwordRegEx);

    let errors = req.validationErrors(),
        hash = crypto.createHash('sha256');
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        return res.redirect('/student-sign-up');
    }
    //if info is correct, we insert into DB
    signUpModule("s", req.body.email, hash.update(req.body.password).digest('base64'), req.body.name, req.body.surname, req.body.studentID, req.body.teacherID).then(() => {
        console.log("Inserted successfully\n");
        req.session.signUpSuccess = true;
        req.session.errors = null;
        return res.redirect('/student-login');
    }).catch(() => {
        console.log("There are errors on DB access (sign up)\n");
        req.session.errors = {
            1: {
                msg: "Unable to write to database. Please contact an administrator or faculty"
            }
        };
        req.session.signUpSuccess = false;
        return res.redirect('back');
    });
});

router.get('/student-login', function (req, res, next) {
    res.render('loginS', {
        title: 'Login',
        signUpSuccess: req.session.signUpSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.signUpSuccess = null;
}).post('/student-login', function (req, res, next) {
    req.body.email = convertToUPMEmail(req.body.email);
    req.check('email', 'Invalid email address').isEmail().matches(studentEmailRegExp);

    let errors = req.validationErrors(),
        hash = crypto.createHash('sha256');

    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        return res.redirect('/student-login');
    }
    //if there's no errors, we check DB
    loginModule("s", req.body.email, hash.update(req.body.password).digest('base64')).then(() => {
        console.log("Came back from checking successfully");
        req.session.errors = null;
        return res.redirect('/student-section');
    }).catch(() => {
        console.log("There are errors from DB access (log in)");
        req.session.errors = {
            1: {
                msg: "Wrong email or password. Please try again"
            }
        };
        return res.redirect('back');
    })
});

router.get('/teacher-sign-up', function (req, res, next) {
    res.render('signUpT', {
        title: 'Sign up',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/teacher-sign-up', function (req, res, next) {
    console.log("POST received on teacher signup", req.body); //DELETE BEFORE DELIVERY

    req.check('email', 'Invalid email address').isEmail();
    //req.check('password', 'Invalid password').equals(req.body.confirmPassword).matches(passwordRegEx);

    let errors = req.validationErrors(),
        hash = crypto.createHash('sha256');

    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        return res.redirect('/teacher-sign-up');
    }
    //if info is correct, we insert into DB
    signUpModule("t", req.body.email, hash.update(req.body.password).digest('base64'), req.body.name, req.body.surname, req.body.teacherID).then(() => {
        console.log("Inserted successfully\n");
        req.session.signUpSuccess = true;
        req.session.errors = null;
        return res.redirect('/teacher-login');
    }).catch(() => {
        console.log("There are errors on DB access (sign up)\n");
        req.session.errors = {
            1: {
                msg: "Unable to write to database. Please contact an administrator or faculty"
            }
        };
        req.session.signUpSuccess = false;
        return res.redirect('back');
    });
});

router.get('/teacher-login', function (req, res, next) {
    res.render('loginT', {
        title: 'Login',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/teacher-login', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail();

    let errors = req.validationErrors(),
        hash = crypto.createHash('sha256');

    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        return res.redirect('/teacher-login');
    }
    //if there's no errors, we check DB
    loginModule("t", req.body.email, hash.update(req.body.password).digest('base64')).then(() => {
        console.log("Came back from checking successfully");
        req.session.errors = null;
        return res.redirect('/teacher-section');
    }).catch(() => {
        console.log("There are errors from DB access (log in)");
        req.session.errors = {
            1: {
                msg: "Wrong email or password. Please try again"
            }
        };
        return res.redirect('back');
    })
});

router.get('/student-section', function (req, res, next) {
    res.render('homePageS', {
        title: 'Home Page',
        layout: 'menuLayout'
    });
});

router.get('/teacher-section', function (req, res, next) {
    res.render('homePageT', {
        title: 'Teacher Home Page',
        layout: 'menuLayout'
    });
});

router.get('/profile', function (req, res, next) {
    res.render('profile', {
        title: 'Profile page',
        layout: 'menuLayout'
    });
});

router.get('/help', function (req, res, next) {
    res.render('help', {
        title: 'Need help?',
        layout: 'menuLayout'
    });
});

module.exports = router;