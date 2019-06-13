'use strict';
require('dotenv').config();
const express = require('express'),
    router = express.Router(),
    loginModule = require('./../modules/loginModule'),
    signUpModule = require('./../modules/signUpModule'),
    crypto = require('crypto');

const studentEmailRegExp = /^[\w.!#$%&’*+/=?^_`{|}~-ÑñÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸç]+(@alumnos.upm.es)$/, //accepted email characters
    passwordRegEx = /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\W\w\S]{8,}$/;//Has 1 uppercase, 1 lowercase, 1 number
// /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\w.!#$%&’*+/=?^_`{|}~\-ÑñáéíóúüÁÉÍÓÚÜ:;ÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸ¡¿çÇŒœßØøÅå ÆæÞþÐð""'.,&#@:?!()$\\/]{8,}$/
// alternative passwordRegEx

//HELPERS
const convertToUPMEmail = (emailInput) => {
    let auxIndex = emailInput.indexOf("@");
    if (auxIndex !== -1) {
        emailInput = emailInput.substring(0, auxIndex);
    }
    emailInput = emailInput + "@alumnos.upm.es";
    return emailInput;
};
const redirectIfNotLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};
const redirectIfLoggedIn = (req, res, next) => {
    if (req.session.studentID) {
        return res.redirect('/student-section');
    } else if (req.session.teacherID) {
        return res.redirect('/teacher-section');
    } else next();
};
const redirectIntruders = (req, res, next) => {
    if (!req.session.teacherID) {
        return res.redirect('/');
    }
    next();
}

//ROUTES
router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'English For Professional and Academic Communication extra credit page'
    });
});

router.get('/student-sign-up', function (req, res, next) {
    res.render('student/signUp', {
        title: 'Sign up',
        errors: req.session.errors
    });
    req.session.errors = null; //to flush them on reload
}).post('/student-sign-up', function (req, res, next) {
    req.body.email = convertToUPMEmail(req.body.email);
    req.check('email', 'Invalid email address').isEmail().matches(studentEmailRegExp);
    //req.check('password', 'Invalid password').equals(req.body.confirmPassword).matches(passwordRegEx); //TODO: uncomment
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        req.session.save((err) => {
            if (err) {
                req.locals.error = err;
                return res.redirect('/');
            }
            return res.redirect('back');
        });
    }
    //if info is correct, we insert into DB
    const hash = crypto.createHash('sha256');
    signUpModule("s", req.body.email, hash.update(req.body.password).digest('base64'), req.body.name, req.body.surname, req.body.studentID, req.body.teacherID).then(() => {
        console.log("Inserted successfully\n");
        req.session.signUpSuccess = true;
        req.session.errors = null;
        req.session.save((err) => {
            if (err) {
                req.locals.error = err;
                return res.redirect('/');
            }
            return res.redirect('/student-login');
        });
    }).catch(() => {
        console.log("There are errors on DB access (sign up)\n");
        req.session.errors = {
            1: {
                msg: "Unable to write to database. Please contact an administrator or faculty"
            }
        };
        req.session.signUpSuccess = false;
        req.session.save((err) => {
            if (err) {
                req.locals.error = err;
                return res.redirect('/');
            }
            return res.redirect('back');
        });
    });
});

router.get('/student-login', redirectIfLoggedIn, function (req, res, next) {
    res.render('student/login', {
        title: 'Login',
        signUpSuccess: req.session.signUpSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.signUpSuccess = null;
}).post('/student-login', function (req, res, next) {
    req.body.email = convertToUPMEmail(req.body.email);
    req.check('email', 'Invalid email address').isEmail().matches(studentEmailRegExp);
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.save((err) => {
            if (err) {
                req.locals.error = err;
                return res.redirect('/');
            }
            res.redirect('back');
        });
    }
    //if there's no errors, we check DB
    const hash = crypto.createHash('sha256');
    loginModule("s", req.body.email, hash.update(req.body.password).digest('base64'))
        .then((response) => {
            console.log("Came back from checking DB successfully\n");
            req.session.errors = null;
            req.session.user = JSON.parse(JSON.stringify(response));
            req.session.studentID = response.studentID;
            req.session.save((err) => {
                if (err) {
                    req.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/student-section');
            });
        }).catch(() => {
            console.log("There are errors from DB access (log in)");
            req.session.errors = {
                1: {
                    msg: "Wrong email or password. Please try again"
                }
            };
            req.session.save((err) => {
                if (err) {
                    req.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        })
});

router.get('/teacher-sign-up', function (req, res, next) {
    res.render('teacher/signUp', {
        title: 'Sign up',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/teacher-sign-up', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail();
    //req.check('password', 'Invalid password').equals(req.body.confirmPassword).matches(passwordRegEx); //TODO: Uncomment
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        req.session.save((err) => {
            if (err) {
                req.locals.error = err;
                return res.redirect('/');
            }
            return res.redirect('back');
        });
    }
    //if info is correct, we insert into DB
    const hash = crypto.createHash('sha256');
    signUpModule("t", req.body.email, hash.update(req.body.password).digest('base64'), req.body.name, req.body.surname, null, req.body.teacherID)
        .then(() => {
            console.log("Inserted successfully\n");
            req.session.signUpSuccess = true;
            req.session.errors = null;
            req.session.save((err) => {
                if (err) {
                    req.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/teacher-login');
            });
        }).catch(() => {
            console.log("There are errors on DB access (sign up)\n");
            req.session.errors = {
                1: {
                    msg: "Unable to write to database. Please contact an administrator or faculty"
                }
            };
            req.session.signUpSuccess = false;
            req.session.save((err) => {
                if (err) {
                    req.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
});

router.get('/teacher-login', redirectIfLoggedIn, function (req, res, next) {
    res.render('teacher/login', {
        title: 'Login',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/teacher-login', function (req, res, next) {
    req.check('email', 'Invalid email address').isEmail();
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.save((err) => {
            if (err) {
                req.locals.error = err;
                return res.redirect('/');
            }
            return res.redirect('back');
        });
    }
    //if there's no errors, we check DB
    const hash = crypto.createHash('sha256');
    loginModule("t", req.body.email, hash.update(req.body.password).digest('base64'))
        .then((response) => {
            console.log("Came back from checking DB successfully");
            req.session.errors = null;
            req.session.user = JSON.parse(JSON.stringify(response));
            req.session.teacherID = response.teacherID;
            req.session.save((err) => {
                if (err) {
                    req.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/teacher-section');
            });
        }).catch(() => {
            console.log("There are errors from DB access (log in)");
            req.session.errors = {
                1: {
                    msg: "Wrong email or password. Please try again"
                }
            };
            req.session.save((err) => {
                if (err) {
                    req.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        })
});

router.get('/student-section', redirectIfNotLoggedIn, function (req, res, next) {
    res.render('student/homePage', {
        title: 'Home Page',
        layout: 'NavBarLayoutS'
    });
});

router.get('/teacher-section', redirectIntruders, function (req, res, next) {
    res.render('teacher/homePage', {
        title: 'Teacher Home Page',
        layout: 'NavBarLayoutT'
    });
});

router.get('/help', redirectIfNotLoggedIn, function (req, res, next) {
    res.render('student/help', {
        title: 'Need help?',
        layout: 'NavBarLayoutS'
    });
});
router.get('/profile', redirectIfNotLoggedIn, function (req, res, next) {
    const { user } = res.locals;
    res.render('student/profile', {
        title: 'Profile page',
        layout: 'NavBarLayoutS',
        user: user
    });
});

router.get('/teacher-help', redirectIntruders, function (req, res, next) {
    res.render('teacher/help', {
        title: 'Need help?',
        layout: 'NavBarLayoutT'
    });
});
router.get('/teacher-profile', redirectIntruders, function (req, res, next) {
    const { user } = res.locals;
    res.render('teacher/profile', {
        title: 'Profile page',
        layout: 'NavBarLayoutT',
        user: user
    });
});

router.post('/logout', redirectIfNotLoggedIn, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            req.locals.error = err;
            return res.redirect('/');
        }
        res.clearCookie(process.env.SESS_NAME);
        res.redirect('/');
    });
})

module.exports = router;