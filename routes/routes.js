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
    loginRateLimiter = new RateLimiterMySQL({
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
const isStudent = (session) => {
    return session.userType === "student" ? true : false;
}
const redirectIfNotLoggedIn = (req, res, next) => { //redirects non-auth requests
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};
const redirectIfLoggedIn = (req, res, next) => { //redirects if already authenticated
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};
const redirectIntruders = (req, res, next) => { //redirects both students and non-auth requests
    if (!req.session.userType || isStudent(req.session)) {
        return res.redirect('/');
    }
    next();
};
async function loadAllActivities(req, res) { //returns an object with ALL activities
    return await new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities;", (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                let parsedActivities = Object.assign({}, results); //Object of objects instead of array of objects
                Object.values(parsedActivities).forEach((element, index, resultsArray) => {
                    studentPool.query("SELECT * FROM questions WHERE activityID = ?;", element.activityID, (err, questions, fields) => {
                        if (err) {
                            console.log("WARNING: Error ocurred during DB Query\n", err);
                            reject("Error during DB Query. Please contact an administrator");
                        } else {
                            resultsArray[index].questions = Object.assign({}, questions); //adding the questions to each activity
                        }
                    });
                });
                resolve(parsedActivities);
            }
        });
    });
}
async function loadCompletedStudentActivities(req, res) { //returns an object with data of activities COMPLETED by the user
    const user = res.locals.user;
    return await new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM students_activities WHERE studentID = ?;", user.studentID, (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                resolve(Object.assign({}, Object.values(results)));
            }
        });
    });
};
async function loadOwnActivities(req, res) {//returns an object with data of activities CREATED by the user
    const user = res.locals.user;
    return await new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities WHERE teacherID = ?;", user.teacherID, (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                resolve(Object.assign({}, Object.values(results)));
            }
        });
    });
};
const generateNewActivityID = function () {
    return "A" + Math.random().toString().slice(2, 11); //A + 9 random digits
};
function isValidActivityID(id, activities) {
    console.log("\nEntering isValidActivityID", id);
    console.log(activities);
    Object.values(activities).forEach((element, index, resultsArray) => {
        if (element.activityID === id) return false;
    });
    return true;
}

//SIGNUPS
function signUpStudent(req, res) {
    const email = req.body.email,
        password = req.body.password,
        name = req.body.name,
        surname = req.body.surname,
        studentID = req.body.studentID,
        teacherID = req.body.studentID,
        includeInRankings = req.body.includeInRankings,
        storedIP = (loginRateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                console.log("consumed from IP: " + storedIP);
                console.log(rateLimiterRes);
                studentPool.query("INSERT INTO students (studentID, email, password, name, surname, teacherID, includeInRankings) VALUES (?, ?, ?, ?, ?, ?,?);",
                    [studentID, email, password, name, surname, teacherID, includeInRankings === "on" ? true : false], (err, results, fields) => {
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
        storedIP = (loginRateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force break-ins
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
                            loginRateLimiter.delete(req.ip); //successful sign up, we delete attempts
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
        storedIP = (loginRateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force break-ins
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
                        loginRateLimiter.delete(req.ip); //successful login, we delete attempts
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
        storedIP = (loginRateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
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
                        loginRateLimiter.delete(req.ip); //successful login, we delete attempts
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

//Common
router.get('/', (req, res, next) => {
    res.render('index', {
        title: 'English For Professional and Academic Communication extra credit page'
    });
});
router.get('/about', (req, res, next) => {
    res.render('about', {
        title: 'About us'
    });
});
router.get('/contact', (req, res, next) => {
    res.render('contact', {
        title: 'Contact us'
    });
});
router.post('/logout', redirectIfNotLoggedIn, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            res.locals.error = err;
            return res.redirect('/');
        }
        res.clearCookie(process.env.SESS_NAME);
        res.redirect('/');
    });
});
router.get('/dashboard', redirectIfNotLoggedIn, async (req, res, next) => {
    if (!req.session.activities) { //TODO: Button to check for new activities from DB which will have a max of 3 attempts/min using rate-limiter
        req.session.activities = await loadAllActivities(req, res);
        // console.log(req.session.activities[1]);//this is the way to access them
    }//TODO: Finish showcasing all activities so teachers and students can be taken to them
    if (isStudent(req.session)) {
        if (!req.session.completedActivities) {//if student, we retrieve completed activities from DB
            req.session.completedActivities = await loadCompletedStudentActivities(req, res);
        }
        console.log(req.session.activities);
        console.log(req.session.completedActivities);
        res.render('student/dashboard', {
            title: 'Home Page',
            layout: 'NavBarLayoutS',
            activities: req.session.activities,
            completedActivities: req.session.completedActivities
        });
    } else {//if teacher or admin
        if (!req.session.ownActivities) { //retrieve activities created by this teacher
            req.session.ownActivities = await loadOwnActivities(req, res); //TODO: MARK THE ACTIVITIES WHOSE TEACHERID == USER.TEACHERID, no need to retrieve
        }
        res.render('teacher/dashboard', {
            title: 'Teacher Home Page',
            layout: 'NavBarLayoutT',
            activities: req.session.activities,
            ownActivities: req.session.ownActivities
        });
    }
});
router.get('/ranking', redirectIfNotLoggedIn, async (req, res, next) => {
    if (res.locals.userType === "student") {
        //retrieve only students who want to be seen in ranking
        //TODO:
    } else {
        //retrieve all students
        //TODO:
    }
    res.render('ranking', {
        ranking: {} //TODO:fill this with the studentIDs and their points
    });
})

//Activities
router.get('/activity/:id', redirectIfNotLoggedIn, async (req, res, next) => {
    console.log(req.params.id);
    console.log(req.session.activities);
    console.log(res.locals.user);
    const id = typeof req.params.id !== "string" ? req.params.id.toString() : req.params.id;
    if (req.session.activities[id]) {
        res.render('student/activity', {
            layout: 'NavBarLayoutS',
            activityID: id,
            questions: req.session.activities[req.params.id].questions,
        });
    } else {
        res.redirect('/dashboard', 404);
    }
}).post('/activity/:id', redirectIfNotLoggedIn, async (req, res, next) => {
    //TODO: We check the answers and insert or update into student_activities
    res.redirect(req.baseUrl + '/done');//TODO: check in docs if this is the way: `/activity${res.locals.activity.id}/done`;
});

router.get('/activity:id/done', redirectIfNotLoggedIn, async (req, res, next) => {
    //Once the activity is done, show the results
    res.render('student/results', {
        layout: 'NavBarLayoutS',
        grade: 0,//TODO: use the response
        points: 0//TODO: award the correct points (grade*multiplier)
    });
});

router.get('/create-activity', redirectIntruders, async (req, res, next) => {
    res.render('teacher/createActivity', {
        layout:'NavBarLayoutT'
    });
}).post('/create-activity', redirectIntruders, async (req, res, next) => {
    //Generates pseudo-random ID (aXXXXXXXX), checks if it already exists. If it does, generates a new one. If it doesn't, inserts into DB
    const newActivity = {};
    do {
        newActivity.id = generateNewActivityID();
    } while (!isValidActivityID(newActivity.id, req.session.activities));
    console.log(req.body);//TODO: insert questions, answers, numberOfAttempts, penalisation, etc... into newActivity and that into DB

    await new Promise((resolve,reject)=>{
        resolve("we entering for now");
    });
    res.redirect(`/activity-created/${newActivity.id}`);
})
//Registration and Login
router.get('/student-sign-up', (req, res, next) => {
    res.render('student/signUp', {
        title: 'Sign up',
        errors: req.session.errors
    });
    req.session.errors = null; //to flush them on reload
}).post('/student-sign-up', (req, res, next) => {
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
                res.locals.error = err;
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
                    res.locals.error = err;
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
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
});

router.get('/student-login', redirectIfLoggedIn, (req, res, next) => {
    res.render('student/login', {
        title: 'Login',
        signUpSuccess: req.session.signUpSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.signUpSuccess = null;
}).post('/student-login', (req, res, next) => {
    req.body.email = convertToUPMEmail(req.body.email);
    req.check('email', 'Invalid email address').isEmail().matches(studentEmailRegExp);
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
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
            req.session.userType = "student";
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/dashboard');
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
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        })
});

router.get('/teacher-sign-up', (req, res, next) => {
    res.render('teacher/signUp', {
        title: 'Sign up',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/teacher-sign-up', (req, res, next) => {
    req.check('email', 'Invalid email address').isEmail();
    //req.check('password', 'Invalid password').equals(req.body.confirmPassword).matches(passwordRegEx); //TODO: Uncomment
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
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
                    res.locals.error = err;
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
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
});

router.get('/teacher-login', redirectIfLoggedIn, (req, res, next) => {
    res.render('teacher/login', {
        title: 'Login',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/teacher-login', (req, res, next) => {
    req.check('email', 'Invalid email address').isEmail();
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
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
            req.session.userType = "teacher";
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/dashboard');
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
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        })
});

//Help and profile
router.get('/help', redirectIfNotLoggedIn, (req, res, next) => {
    res.render('student/help', {
        title: 'Need help?',
        layout: 'NavBarLayoutS'
    });
});
router.get('/profile', redirectIfNotLoggedIn, (req, res, next) => {
    const { user } = res.locals;
    res.render('student/profile', {
        title: 'Profile page',
        layout: 'NavBarLayoutS',
        user: user
    });
});

router.get('/teacher-help', redirectIntruders, (req, res, next) => {
    res.render('teacher/help', {
        title: 'Need help?',
        layout: 'NavBarLayoutT'
    });
});
router.get('/teacher-profile', redirectIntruders, (req, res, next) => {
    const { user } = res.locals;
    res.render('teacher/profile', {
        title: 'Profile page',
        layout: 'NavBarLayoutT',
        user: user
    });
});

module.exports = router;