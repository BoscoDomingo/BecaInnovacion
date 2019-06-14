'use strict';
require('dotenv').config();
const express = require('express'),
    router = express.Router(),
    crypto = require('crypto'),
    mysql = require('mysql'),
    studentPool = mysql.createPool({ //source https://github.com/mysqljs/mysql#pooling-connections
        connectionLimit: parseInt(process.env.NUMBER_OF_STUDENT_CONNECTIONS),
        waitForConnections: true, //if no connections available, they wait for one
        queueLimit: 10000,//0 for unlimited processes in the queue waiting for connection
        host: process.env.db_host,
        port: process.env.db_port,
        user: process.env.db_user_S,
        password: process.env.db_pass_S,
        database: process.env.db_name
    }),
    teacherPool = mysql.createPool({
        connectionLimit: parseInt(process.env.NUMBER_OF_TEACHER_CONNECTIONS),
        waitForConnections: true, //if no connections available, they wait for one
        queueLimit: 10000,//0 for unlimited processes in the queue waiting for connection
        host: process.env.db_host,
        port: process.env.db_port,
        user: process.env.db_user_T,
        password: process.env.db_pass_T,
        database: process.env.db_name
    }),
    sessionPool = mysql.createPool({
        connectionLimit: parseInt(process.env.NUMBER_OF_SESSION_CONNECTIONS),
        waitForConnections: true,
        queueLimit: 10000,//0 for unlimited process in the queue waiting for connection
        host: process.env.db_host,
        port: process.env.db_port,
        user: process.env.db_session_user,
        password: process.env.db_session_pass
    }),
    { RateLimiterMySQL } = require('rate-limiter-flexible'),
    rateLimiter = new RateLimiterMySQL({
        storeClient: sessionPool,
        dbName: process.env.db_name,
        tableName: 'rate_limiter',
        points: parseInt(process.env.LOGIN_ATTEMPTS), // Number of attempts
        duration: parseInt(process.env.LOGIN_ATTEMPTS_RESET), // Number of seconds before consumed points are reset. 
        blockDuration: process.env.LOGIN_BLOCK_TIME, //Number of seconds of user blocking if attempts >= points (before they reset)
        inmemoryBlockOnConsumed: parseInt(process.env.LOGIN_ATTEMPTS), //protection against DDoS, avoids checking with DB if points are consumed
        inmemoryBlockDuration: process.env.LOGIN_BLOCK_TIME, //Number of seconds of of user blocking (memory stored instead of DB)
    }, (err) => {
        if (err) {// log or/and process exit
            console.log("Error ocurred creating rateLimiter", err);
        } else {// db and table checked/created
            console.log("Rate Limiter DB checked and usable");
        }
    });

const studentEmailRegExp = /^[\w.!#$%&’*+/=?^_`{|}~-ÑñÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸç]+(@alumnos.upm.es)$/, //accepted email characters
    passwordRegEx = /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\W\w\S]{8,}$/; //Has 1 uppercase, 1 lowercase, 1 number
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
const redirectIfNotLoggedIn = (req, res, next) => { //redirects non-auth requests
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};
const redirectIfLoggedIn = (req, res, next) => { //redirects if already authenticated
    if (req.session.studentID) {
        return res.redirect('/student-section');
    } else if (req.session.teacherID) {
        return res.redirect('/teacher-section');
    } else next();
};
const redirectIntruders = (req, res, next) => { //redirects both students and non-auth requests
    if (!req.session.teacherID) {
        return res.redirect('/');
    }
    next();
}

//SIGNUPS
function signUpStudent(req, res) {
    const email = req.body.email,
        password = req.body.password,
        name = req.body.name,
        surname = req.body.surname,
        studentID = req.body.studentID,
        teacherID = req.body.studentID,
        storedIP = (rateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        rateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                console.log("consumed from IP: " + storedIP);
                console.log(rateLimiterRes);
                studentPool.query("INSERT INTO students (studentID, email, password, name, surname, teacherID) VALUES (?, ?, ?, ?, ?, ?);",
                    [studentID, email, password, name, surname, teacherID], (err, results, fields) => {
                        if (err) {
                            console.log("WARNING: Error ocurred during DB Query\n", err);
                            reject("Error during DB Query. Please contact an administrator");
                        } else {
                            console.log("Successfully inserted student");
                            resolve();
                        }
                    });
            }).catch((rej) => {// Blocked, no points left
                console.log("Not allowed from IP: " + storedIP);
                console.log(rej);
                const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;
                res.set('Retry-After', String(retrySecs));
                return res.status(429).send('Too Many Requests');
            });
    });
}
function signUpTeacher(req, res) {
    const email = req.body.email,
        password = req.body.password,
        name = req.body.name,
        surname = req.body.surname,
        teacherID = req.body.teacherID,
        storedIP = (rateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        rateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force break-ins
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                console.log("consumed from IP: " + storedIP);
                console.log(rateLimiterRes);
                teacherPool.query("INSERT INTO teachers (teacherID, email, password, name, surname) VALUES (?, ?, ?, ?, ?)",
                    [teacherID, email, password, name, surname], (err, results, fields) => {
                        if (err) {
                            console.log("WARNING: Error ocurred during DB Query\n", err);
                            reject("Error during DB Query. Please contact an administrator");
                        } else {
                            console.log("Successfully inserted teacher");
                            rateLimiter.delete(req.ip); //successful sign up, we delete attempts
                            resolve();
                        }
                    });
            }).catch((rej) => {// Blocked, no points left
                console.log("Not allowed from IP: " + storedIP);
                console.log(rej);
                const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;
                res.set('Retry-After', String(retrySecs));
                return res.status(429).send('Too Many Requests');
            });
    });
}

//LOGINS
function checkStudentLogin(req, res) {
    const email = req.body.email,
        password = req.body.password,
        storedIP = (rateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        rateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force break-ins
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                console.log("consumed from IP: " + storedIP);
                console.log(rateLimiterRes);
                studentPool.query("SELECT * FROM students WHERE email = ?;", email, (err, results, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else if (results.length <= 0 || results[0].password !== password) {
                        console.log("Login failed");
                        reject("Wrong username or password. Please try again");
                    } else {
                        console.log("Login successful");
                        delete results[0].password;
                        rateLimiter.delete(req.ip); //successful login, we delete attempts
                        resolve(results[0]);
                    }
                });
            }).catch((rej) => {// Blocked, no points left
                console.log("Not allowed from IP: " + storedIP);
                console.log(rej);
                const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;
                res.set('Retry-After', String(retrySecs));
                return res.status(429).send('Too Many Requests');
            });
    })
};
function checkTeacherLogin(req, res) {
    const email = req.body.email,
        password = req.body.password,
        storedIP = (rateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        rateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                console.log("consumed from IP: " + storedIP);
                console.log(rateLimiterRes);
                studentPool.query("SELECT * FROM teachers WHERE email = ?", email, (err, results, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else if (results.length <= 0 || results[0].password !== password) {
                        console.log("Login failed");
                        reject("Wrong username or password. Please try again");
                    } else {
                        console.log("Login successful");
                        delete results[0].password;
                        rateLimiter.delete(req.ip); //successful login, we delete attempts
                        resolve(results[0]);
                    }
                });
            }).catch((rej) => {// Blocked, no points left
                console.log("Not allowed from IP: " + storedIP);
                console.log(rej);
                const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;
                res.set('Retry-After', String(retrySecs));
                return res.status(429).send('Too Many Requests');
            });
    });
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
    req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64'); //hashing the password
    signUpStudent(req, res)
        .then(() => {
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
        }).catch((error) => {
            console.log("There are errors on DB access (student sign up)\n");
            req.session.errors = {
                1: {
                    msg: error
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
    req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64'); //hashing the password
    checkStudentLogin(req, res)
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
        }).catch((error) => {
            console.log("There are errors on DB access (student log in)");
            req.session.errors = {
                1: {
                    msg: error
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
    req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64');
    signUpTeacher(req, res)
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
        }).catch((error) => {
            console.log("There are errors on DB access (teacher sign up)\n");
            req.session.errors = {
                1: {
                    msg: error
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
    req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64');
    checkTeacherLogin(req, res)
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
        }).catch((error) => {
            console.log("There are errors on DB access (teacher log in)");
            req.session.errors = {
                1: {
                    msg: error
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