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
        inmemoryBlockDuration: process.env.LOGIN_BLOCK_TIME //Number of seconds of of user blocking (memory stored instead of DB)
    }, (err) => {
        if (err) {// log error and/or exit process
            console.log("Error ocurred creating loginRateLimiter", err);
        }
    }),
    actionRateLimiter = new RateLimiterMySQL({
        storeClient: sessionPool,
        dbName: process.env.db_name,
        tableName: 'rate_limiter',
        points: parseInt(process.env.ACTION_ATTEMPTS), // Number of attempts
        duration: parseInt(process.env.ACTION_ATTEMPTS_RESET), // Number of seconds before consumed points are reset.
        blockDuration: process.env.ACTION_BLOCK_TIME, //Number of seconds of user blocking if attempts >= points (before they reset)
        inmemoryBlockOnConsumed: parseInt(process.env.ACTION_ATTEMPTS), //protection against DDoS, avoids checking with DB if points are consumed
        inmemoryBlockDuration: process.env.ACTION_BLOCK_TIME //Number of seconds of of user blocking (memory stored instead of DB)
    }, (err) => {
        if (err) {// log error and/or exit process
            console.log("Error ocurred creating actionRateLimiter", err);
        }
    });

const studentEmailRegExp = /^(?:[\w\d!#$%&'*+/=?^_`{|}~-ÑñÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸÇç]+(?:\.[A-Za-zñç\d!#$%&'*+/=?^_`{|}~-ÑñÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸÇç]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")+(@alumnos.upm.es)$/,
    passwordRegEx = /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\W\w\S]{8,}$/, //Has 1 uppercase, 1 lowercase, 1 number
    categories = ["Space And Universe", "Communication and Transport", "Computing and Robotics", "Energy And Power", "Industry and construction", "Sport Science", "Science News"];

//HELPERS
const convertToUPMEmail = (emailInput) => {
    //This removed anything after an '@', but was commented out to ensure proper emails are used. Left it anyways in case we want to use it again
    // let auxIndex = emailInput.indexOf("@");
    // if (auxIndex !== -1) {
    //     emailInput = emailInput.substring(0, auxIndex);
    // }
    // emailInput = emailInput + "@alumnos.upm.es";
    // return emailInput;
    return emailInput + "@alumnos.upm.es";
};
const arrayOfObjectsToObject = (array, keyField) =>//[{ activityID: "A1", questions: 5 }, { activityID: "A2", questions: 3 }] => {{ activityID: "A1", questions: 5 }, { activityID: "A2", questions: 3 }};
    array.reduce((obj, item) => {
        obj[item[keyField]] = item
        return obj
    }, {})
//source: https://medium.com/dailyjs/rewriting-javascript-converting-an-array-of-objects-to-an-object-ec579cafbfc7
const renameKeys = (newKeys, obj) => //renames an object's keys based on another object with the new names
    Object.keys(obj).reduce((acc, key) => ({ ...acc, ...{ [newKeys[key] || key]: obj[key] } }), {});
//source: https://www.freecodecamp.org/news/30-seconds-of-code-rename-many-object-keys-in-javascript-268f279c7bfa/

const isStudent = (session) => {
    return session.userType === "student" ? true : false;
};
const getYTVideoID = (url) => {//source: https://stackoverflow.com/a/27728417/9022642
    if (url.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/))
        return url.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/)[1];
};
const parseQuestionChoices = (choices) => { //choices: 'Answer1--Answer2--Answer3--Answer4'
    let choicesArr = choices.split('--'), //[Answer1, Answer2, Answer3, Answer4]
        choicesObj = {}, i;
    for (i = 0; i < choicesArr.length; i++) {
        choicesObj[i + 1] = choicesArr[i];
    }
    return choicesObj; //{1:'Answer1', 2:'Answer2', 3:'Answer3', 4:'Answer4'}
};
const parseTags = (tags) => { //tags: 'Tag1 ,Tag2,Tag3 , Tag4, '
    tags = tags.replace(/\s/g, '').split(",");
    if (tags[tags.length - 1].length === 0) {
        tags.pop();
    }
    return tags; //[Tag1,Tag2,Tag3,Tag4]
};
const makeObject1Indexed = (object) => { //gives an object with numbered keys, starting at one: {1 : ..., 2 : ..., 3:...}
    let newKeys = {};
    for (let i = 0; i < Object.keys(object).length; i++) {
        newKeys[i] = `${i + 1}`;
    }
    return renameKeys(newKeys, object);
};

const redirectIfNotLoggedIn = (req, res, next) => { //redirects non-auth requests, deleted accounts or non-validated teachers
    const user = req.session.user;
    if (!user || user.isDeleted === 1 || req.session.userType === "teacher" && user.isValidated === 0) {
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
const redirectIntruders = (req, res, next) => { //redirects students, non-auth requests or non-validated teachers
    if (!req.session.userType || isStudent(req.session) || req.session.userType === "teacher" && req.session.user.isValidated === 0) {
        return res.redirect('/');
    }
    next();
};
const redirectNonAdmins = (req, res, next) => {
    if (!req.session.userType || req.session.userType !== "admin") {
        return res.redirect('/');
    }
    next();
}

async function getActivity(activityID) { //returns an object with the desired Activity
    return new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities WHERE activityID = ?;", activityID, async (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else if (results.length > 0) {
                try {
                    await new Promise((resolve, reject) => {
                        studentPool.query("SELECT * FROM questions WHERE activityID = ?;", activityID, (err, questions, fields) => {
                            if (err) {
                                console.log("WARNING: Error ocurred during DB Query\n", err);
                                reject("Error during DB Query. Please contact an administrator");
                            } else {
                                results[0].activityLink = `/activity/${activityID}`; //so students can do it
                                results[0].summaryLink = `/activity-summary/${activityID}`; //so teachers can view it
                                results[0].questions = makeObject1Indexed(Object.assign({}, questions)); //adding the questions
                                results[0].tags = parseTags(results[0].tags);
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    reject(error)
                }
                resolve(results[0]);
            } else {
                reject("Error during DB Query. No activity found");
            }
        });
    });
};
async function getAllActivities() { //returns an object with ALL activities with questions
    return new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities;", async (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                let queryPromisesArray = [];
                for (let index in results) {
                    queryPromisesArray[index] = new Promise((resolve, reject) => { //waiting for 1 activity
                        studentPool.query("SELECT * FROM questions WHERE activityID = ?;", results[index].activityID, (err, questions, fields) => {
                            if (err || questions.length === 0) {
                                console.log("WARNING: Error ocurred during DB Query\n", err);
                                reject("Error during DB Query. Please contact an administrator");
                            } else {
                                results[index].activityLink = `/activity/${results[index].activityID}`; //so students can do it
                                results[index].summaryLink = `/activity-summary/${results[index].activityID}`; //so teachers can view it
                                results[index].tags = parseTags(results[index].tags);
                                results[index].questions = makeObject1Indexed(Object.assign({}, questions));//adding the questions to each activity
                                resolve();
                            }
                        });
                    });
                }
                Promise.all(queryPromisesArray).then(() => { resolve(arrayOfObjectsToObject(results, "activityID")) });//we wait untill ALL activities have been processed
            }
        });
    });
};
async function getCompletedActivities(studentID, activities) { //returns an object with data of activities COMPLETED by the user
    return new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM students_activities WHERE studentID = ?;", studentID, (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else if (results.length > 0) {
                results.forEach((element, index, array) => { //parsing the completedActivities so they can be shown
                    array[index].title = activities[element.activityID].title;
                    array[index].activityLink = activities[element.activityID].activityLink;
                    array[index].category = activities[element.activityID].category;
                    array[index].tags = activities[element.activityID].tags;
                    array[index].creatorName = activities[element.activityID].creatorName;
                });
                resolve(arrayOfObjectsToObject(results, "activityID"));
            } else resolve({});
        });
    });
};
function getOwnActivities(activities, teacherID) {//returns an object with data of activities CREATED by the user
    return arrayOfObjectsToObject(Object.values(activities).filter((activity => { return activity.teacherID === teacherID })), "activityID");
};

async function insertOrUpdateTable(tableName, args, action) {
    switch (tableName) {
        case "student_activities": {
            if (action === "insert") {
                teacherPool.query("INSERT INTO students_activities (studentID, activityID, groupID, grade, pointsAwarded) VALUES(?,?,?,?,?);", args, (err, res) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        Promise.reject("Error during DB Query. Please contact an administrator");
                    } else {
                        console.log("Successfully inserted student_activity");
                        teacherPool.query("UPDATE students SET totalPoints = totalPoints + ? WHERE studentID = ?;", [args[6], args[0]], (err, result) => {
                            if (err) {
                                console.log("WARNING: Error ocurred during DB Query\n", err);
                                Promise.reject("Error during DB Query. Please contact an administrator");
                            } else Promise.resolve(res);
                        });
                    }
                })
            } else if (action === "update") {
                teacherPool.query(`UPDATE students_activities SET grade = ${args[3]}, pointsAwarded = ${args[4]}, numberOfAttempts = ${args[5]} `
                    + `WHERE studentID = '${args[0]}' AND activityID = '${args[1]}';`, (err, res) => {
                        if (err) {
                            console.log("WARNING: Error ocurred during DB Query\n", err);
                            Promise.reject("Error during DB Query. Please contact an administrator");
                        } else {
                            console.log("Successfully updated student_activity");
                            teacherPool.query("UPDATE students SET totalPoints = totalPoints + ? WHERE studentID = ?;", [args[6], args[0]], (err, result) => {
                                if (err) {
                                    console.log("WARNING: Error ocurred during DB Query\n", err);
                                    Promise.reject("Error during DB Query. Please contact an administrator");
                                } else Promise.resolve(res);
                            });
                        }
                    })
            }
            break;
        }
        case "activities": {
            teacherPool.query("INSERT INTO activities (activityID, teacherID, title, pointsMultiplier, videoLink, numberOfAttempts, penalisationPerAttempt,"
                + " questionIDs, numberOfQuestions, category, tags, creatorName, penalisationLimit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args, (err, results, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        Promise.reject("Error during DB Query. Please contact an administrator");
                    } else {
                        console.log("Successfully inserted activity");
                        Promise.resolve();
                    }
                });
            break;
        }
        default: Promise.reject("Table not found");
            break;
    }
}

const generateNewID = function (prefix, numberOfDigits) {
    return prefix + Math.random().toString().slice(2, 2 + (numberOfDigits < 17 ? numberOfDigits : 16));//erases the 0. from Math.random()
};
function isValidActivityID(id, activities) {
    Object.values(activities).forEach((element, index, resultsArray) => {
        if (element.activityID === id) return false;
    });
    return true;
};
function isValidQuestionID(id) { //easier to ask DB than to load them all
    return new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM questions WHERE questionID = ?;", id, (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                resolve(results.length == 0 ? true : false);
            }
        });
    })
};

//SIGNUPS
function signUpStudent(req, res) {
    const email = req.body.email,
        password = req.body.password,
        name = req.body.name,
        surname = req.body.surname,
        studentID = req.body.studentID,
        teacherID = req.body.teacherID,
        groupID = req.body.groupID,
        includeInRankings = req.body.includeInRankings,
        storedIP = (loginRateLimiter.getKey(req.ip));
    //TODO: use process.env.ALLOWED_GROUP_NAMES or something of the sort to validate the group name
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                studentPool.query("INSERT INTO students (studentID, email, password, name, surname, teacherID, includeInRankings, groupID) VALUES (?,?,?,?,?,?,?,?);",
                    [studentID, email, password, name, surname, teacherID, includeInRankings, groupID], (err, results, fields) => {
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
                return res.status(429).send(`<p>Too Many Requests. Please try again in ${retrySecs}s</p><br>`);
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
                return res.status(429).send(`<p>Too Many Requests. Please try again in ${retrySecs}s</p><br>`);
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
                studentPool.query("SELECT * FROM students WHERE email = ?;", email, (err, results, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else if (results.length <= 0 || results[0].password !== password) {
                        console.log("Login failed");
                        reject("Wrong username or password. Please try again");
                    } else if (results[0].isDeleted === 1) {
                        console.log("Student is deleted");
                        reject("This account has been deleted. Please contact an administrator to restore your account");
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
                return res.status(429).send(`<p>Too Many Requests. Please try again in ${retrySecs}s</p><br>`);
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
                studentPool.query("SELECT * FROM teachers WHERE email = ?", email, (err, results, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else if (results.length <= 0 || results[0].password !== password) {
                        console.log("Teacher Login failed");
                        reject("Wrong username or password. Please try again");
                    } else if (results[0].isValidated == 0) {
                        console.log("Teacher Login failed");
                        reject("Account has not yet been validated. Please contact a fellow teacher or an administrator");
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
                return res.status(429).send(`<p>Too Many Requests. Please try again in ${retrySecs}s</p><br>`);
            });
    });
}
function checkAdminLogin(req, res) {
    const email = req.body.email,
        password = req.body.password,
        storedIP = (loginRateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
                studentPool.query("SELECT * FROM admins WHERE email = ?", email, (err, results, fields) => {
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
                return res.status(429).send(`<p>Too Many Requests. Please try again in ${retrySecs}s</p><br>`);
            });
    });
}

//ROUTES

//Common
router.get('/', (req, res, next) => {
    res.render('index', {
        title: "English For Professional and Academic Communication's extra credit page"
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
router.get('/logout', redirectIfNotLoggedIn, (req, res, next) => {
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
    if (!req.session.activities) {
        try {
            req.session.activities = await getAllActivities();
        } catch (error) {
            console.log(error);
        }
    }
    if (isStudent(req.session)) {
        if (!req.session.completedActivities) {
            try {
                req.session.completedActivities = await getCompletedActivities(res.locals.user.studentID, req.session.activities);
            } catch (error) {
                console.log(error);
            }
        }
        req.session.save((err) => {
            if (err) {
                console.log(err);
                res.redirect('/');
            } else res.render('student/dashboard', {
                title: 'Home Page',
                layout: 'NavBarLayoutS',
                activities: req.session.activities,
                completedActivities: req.session.completedActivities
            });
        });
    } else {//if teacher or admin
        if (!req.session.ownActivities && req.session.userType === "teacher") { //retrieve activities created by this teacher
            try {
                req.session.ownActivities = await getOwnActivities(req.session.activities, res.locals.user.teacherID);
            } catch (error) {
                console.log(error);
            }
        }
        req.session.save((err) => {
            if (err) {
                console.log(err);
                res.redirect('/');
            } else if (req.session.userType === "teacher") {
                res.render('teacher/dashboard', {
                    title: 'Teacher Home Page',
                    layout: 'NavBarLayoutT',
                    activities: req.session.activities,
                    ownActivities: req.session.ownActivities
                });
            } else {
                res.render('admin/dashboard', {
                    title: 'Admin Home Page',
                    layout: 'NavBarLayoutA',
                    activities: req.session.activities,
                });
            }
        });
    }
}).get('/dashboard/refresh-activities', redirectIfNotLoggedIn, async (req, res, next) => {
    const storedIP = (actionRateLimiter.getKey(req.ip));
    actionRateLimiter.consume(req.ip).then(async (rateLimiterRes) => { //blocking attempts from same IP
        try {
            req.session.activities = await getAllActivities();
            if (isStudent(req.session)) {
                req.session.completedActivities = await getCompletedActivities(res.locals.user.studentID, req.session.activities);
            } else {
                req.session.ownActivities = await getOwnActivities(req.session.activities, res.locals.user.teacherID);
            }
            req.session.save((err) => {
                if (err) {
                    console.log(err);
                    res.redirect('/');
                } else res.redirect('/dashboard');
            });
        } catch (error) {
            console.log(error);
        }
    }).catch((rej) => {// Blocked, no points left
        console.log("Not allowed from IP: " + storedIP);
        console.log(rej);
        const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(retrySecs));
        return res.status(429).send(`<p>Too Many Requests. Please try again in ${retrySecs}s</p><br><a href="/dashboard">Go Back</a>`);
    });
});
router.get('/ranking', redirectIfNotLoggedIn, async (req, res, next) => {
    if (isStudent(req.session)) {
        Promise.all([new Promise((resolve, reject) => {
            //bringing all students
            studentPool.query('SELECT studentID, groupID, totalPoints FROM students WHERE (includeInRankings = 1 OR studentID = ?) AND isDeleted = 0 ORDER BY totalPoints DESC;',
                res.locals.user.studentID, (err, res) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else {
                        resolve(arrayOfObjectsToObject(res, "studentID"));
                    }
                });
        }), new Promise((resolve, reject) => {
            //bringing groupmates
            studentPool.query('SELECT studentID, totalPoints FROM students WHERE (includeInRankings = 1 OR studentID = ?) AND isDeleted = 0 AND groupID =? ORDER BY totalPoints DESC;',
                [res.locals.user.studentID, res.locals.user.groupID], (err, res) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else {
                        resolve(arrayOfObjectsToObject(res, "studentID"));
                    }
                });
        })]).then((values) => {
            res.render('rankings', {
                title: 'Rankings',
                students: values[0],
                groupmates: values[1],
                groupID: res.locals.user.groupID,
                error: false,
                layout: 'NavBarLayoutS'
            });
        }).catch((err) => {
            console.log(err);
            res.render('rankings', {
                title: 'Rankings',
                error: true,
                layout: 'NavBarLayoutS'
            });
        })
    } else {
        try {
            var students = await new Promise((resolve, reject) => {
                teacherPool.query('SELECT studentID, groupID, totalPoints FROM students ORDER BY totalPoints DESC;', (err, res) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject("Error during DB Query. Please contact an administrator");
                    } else {
                        resolve(arrayOfObjectsToObject(res, "studentID"));
                    }
                });
            });
        } catch (error) {
            console.log(error);
            res.render('rankings', {
                title: 'Ranking',
                students: students,
                error: true,
                layout: 'NavBarLayoutT'
            });
        }
        res.render('rankings', {
            title: 'Ranking',
            students: students,
            error: false,
            isTeacher: true,
            layout: 'NavBarLayoutT'
        });
    }
});
router.get('/group', redirectIfNotLoggedIn, async (req, res, next) => {
    let group = {}, error;
    try {
        group = await new Promise((resolve, reject) => {
            studentPool.query('SELECT * FROM groupstable WHERE groupID = ?;', req.session.user.groupID, (err, results) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject("Error during DB Query. Please contact an administrator");
                } else {
                    resolve(results[0]);
                }
            });
        });
        group.averageGrade *= 10;
        res.render('student/group', {
            title: 'Your group',
            group: group,
            layout: 'NavBarLayoutS'
        });
    } catch (err) {
        error = err;
    }
    console.log(error ? error : group);
});
router.get('/groups', redirectIntruders, async (req, res, next) => {
    let groups = {}, error;
    try {
        groups = await new Promise((resolve, reject) => {
            teacherPool.query('SELECT * FROM groupstable;', (err, results) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject("Error during DB Query. Please contact an administrator");
                } else {
                    results.forEach((element, index, array) => {
                        array[index].averageGrade = element.averageGrade * 10;
                    })
                    resolve(arrayOfObjectsToObject(results, "groupID"));
                }
            });
        });
        res.render('teacher/groups', {
            groups: groups,
            layout: 'NavBarLayoutT'
        });
    } catch (err) {
        error = err;
    }
    console.log(error ? error : groups);
});
//Activities
router.get('/activity/:id', redirectIfNotLoggedIn, (req, res, next) => {
    const id = typeof req.params.id !== "string" ? req.params.id.toString() : req.params.id;
    if (!isStudent(req.session)) { //redirect teachers and admins to activity-summary
        return res.redirect(`/activity-summary/${id}`);
    }

    const activity = req.session.activities[id];
    if (req.session.completedActivities[id] && req.session.completedActivities[id].numberOfAttempts >= activity.numberOfAttempts) {
        res.redirect(`/activity/${id}/done`);
    }
    Object.values(activity.questions).forEach((question, index, arr) => {
        if (typeof question.questionChoices === 'string') {
            arr[index].questionChoices = parseQuestionChoices(question.questionChoices);
        }
    });

    if (activity) {
        res.render('student/activity', {
            layout: 'NavBarLayoutS',
            activityID: id,
            videoLink: `https://www.youtube.com/embed/${getYTVideoID(activity.videoLink)}`,
            questions: activity.questions,
        });
    } else {
        res.redirect('/dashboard', 404);
    }
}).post('/activity/:id', redirectIfNotLoggedIn, async (req, res, next) => {
    const currActivity = req.session.activities[req.params.id];
    let correctAnswers = 0,
        oldPoints = 0,
        DBAction = "update",
        doneActivity = req.session.completedActivities[currActivity.activityID];

    if (!doneActivity) { //first attempt
        DBAction = "insert";
        doneActivity = {
            studentID: req.session.user.studentID,
            activityID: currActivity.activityID,
            groupID: req.session.user.groupID,
            creatorName: currActivity.creatorName,
            grade: -1,
            pointsAwarded: 0,
            completedOn: new Date(), //only for the purpose of having the date here, DB doesn't need it
            numberOfAttempts: 0,
            title: currActivity.title,
            activityLink: currActivity.activityLink,
            category: currActivity.category,
            tags: currActivity.tags
        };
    } else {
        oldPoints = doneActivity.pointsAwarded;
    }

    Object.values(currActivity.questions).forEach(element => {//calculating the number of correct answers
        correctAnswers = req.body[element.questionID] === element.questionAnswer.toString() ? correctAnswers + 1 : correctAnswers;
    });
    let newGrade = correctAnswers / currActivity.numberOfQuestions,
        newPointsAwarded = newGrade * 10 * currActivity.pointsMultiplier * Math.max(currActivity.penalisationLimit / 100, (1 - ((currActivity.penalisationPerAttempt / 100) * (doneActivity.numberOfAttempts))));
    console.log(newPointsAwarded, newGrade, Math.max(currActivity.penalisationLimit / 100, (1 - ((currActivity.penalisationPerAttempt / 100) * (doneActivity.numberOfAttempts)))));
    if (newPointsAwarded >= oldPoints) { //we only update if results are better or insert if it's first attempt
        req.session.betterActivityResult = true;
        doneActivity.grade = newGrade;
        doneActivity.pointsAwarded = newPointsAwarded;
        doneActivity.completedOn = new Date();
    } else {
        req.session.betterActivityResult = false;
    }
    doneActivity.numberOfAttempts = doneActivity.numberOfAttempts + 1; //attempts done always go up
    let pointsForUpdate = newPointsAwarded - oldPoints; //calculate the points for DB
    try {
        await insertOrUpdateTable("student_activities", [doneActivity.studentID, doneActivity.activityID, doneActivity.groupID, doneActivity.grade,
        doneActivity.pointsAwarded, doneActivity.numberOfAttempts, pointsForUpdate], DBAction);
    } catch (error) {
        console.log(`Error on ${DBAction}; activity results from student ${req.session.user.studentID} on activity ${currActivity.activityID}: ${err}`);
    }
    req.session.completedActivities[doneActivity.activityID] = doneActivity;
    req.session.save((err) => {
        if (err) {
            console.log(err);
            res.redirect('/');
        } else res.redirect(`/activity/${req.params.id}/done`);
    });
});

router.get('/activity/:id/done', redirectIfNotLoggedIn, (req, res, next) => {
    const id = typeof req.params.id !== "string" ? req.params.id.toString() : req.params.id,
        complActivity = req.session.completedActivities[id],
        currActivity = req.session.activities[id];
    //Once the activity is done, show the results
    res.render('student/activityResults', {
        layout: 'NavBarLayoutS',
        betterActivityResult: req.session.betterActivityResult,
        attemptNumber: complActivity.numberOfAttempts,
        firstAttempt: complActivity.numberOfAttempts === 1,
        grade: complActivity.grade * 10,
        points: complActivity.pointsAwarded,
        numberOfQuestions: currActivity.numberOfQuestions,
        numberOfAttempts: currActivity.numberOfAttempts,
        canRetry: complActivity.numberOfAttempts < currActivity.numberOfAttempts && complActivity.grade < 1
    });
    req.session.betterActivityResult = null;
});

router.get('/activity/:id/retry', redirectIfNotLoggedIn, (req, res, next) => {
    const id = typeof req.params.id !== "string" ? req.params.id.toString() : req.params.id,
        complActivity = req.session.completedActivities[id];
    if (complActivity && complActivity.numberOfAttempts < req.session.activities[id].numberOfAttempts) {
        res.redirect(`/activity/${id}`);
    } else {
        res.redirect('/dashboard');
    }
});

router.get('/create-activity', redirectIntruders, async (req, res, next) => {
    res.render('teacher/createActivity', {
        layout: 'NavBarLayoutT',
        categories: categories,
        title: "Creating activity"
    });
}).post('/create-activity', redirectIntruders, async (req, res, next) => {
    req.body.questions = {};
    do {//Generates pseudo-random activityID (AXXXXXXXX), checks if it already exists. If it does, generates a new one. If it doesn't, inserts into DB
        req.body.activityID = generateNewID("A", process.env.ACTIVITY_ID_LENGTH - 1);
    } while (!isValidActivityID(req.body.activityID, req.session.activities));

    //we start by inserting questions into DB under the new activityID:
    let questionsInserted = new Promise(async (resolve, reject) => { //parse questions and insert them into DB, resolving with the string of the generated questionIDs 
        let generatedQuestionIDs = { ids: "" };  //so the changes remain outside the scope of the for loop
        for (let i = 1; i <= req.body.number_of_questions; i++) { //question by question
            let generatedQuestionID = { id: "" },
                isValid = false;

            do { //generate unique questionID for each
                try {
                    generatedQuestionID.id = generateNewID("Q", process.env.QUESTION_ID_LENGTH - 1);
                    isValid = await isValidQuestionID(generatedQuestionID.id);
                } catch (error) {
                    reject(error);
                }
            } while (!isValid);

            //Parse choices of current question into one string
            let choices = { choicesString: "" };
            if (req.body["question_type_" + i] === "test") {
                for (let j = (i - 1) * 4 + 1; j <= (i - 1) * 4 + 4; j++) { //assuming 4 choices per question, this will have to be changed when we want to introduce different number of answers
                    choices.choicesString += (req.body["choice_" + j] + "--");
                    delete req.body["choice_" + j]; //because we move them to another place
                }
                choices.choicesString = choices.choicesString.substring(0, choices.choicesString.length - 2); //erase the final 2 characters
            }

            try {
                await new Promise((resolve, reject) => {
                    teacherPool.query("INSERT INTO questions (activityID, questionID, questionText, questionAnswer, questionType, questionChoices) VALUES (?, ?, ?, ?, ?, ?)",
                        [req.body.activityID, generatedQuestionID.id, req.body["question_text_" + i], req.body["is_answer_" + i], req.body["question_type_" + i], choices.choicesString],
                        (err, results, fields) => {
                            if (err) {
                                console.log("WARNING: Error ocurred during DB Query\n", err);
                                reject("Error during DB Query. Please contact an administrator");
                            } else {
                                generatedQuestionIDs.ids += (generatedQuestionID.id + ", ");
                                resolve();
                            }
                        });
                });
                req.body.questions[i] = { //so the activity matches the format of the imported ones
                    question_number: i,
                    question_ID: generatedQuestionID.id,
                    question_text: req.body["question_text_" + i],
                    question_type: req.body["question_type_" + i],
                    question_answer: req.body["is_answer_" + i],
                    question_choices: choices.choicesString
                };
                delete req.body["question_text_" + i];
                delete req.body["question_type_" + i];
                delete req.body["is_answer_" + i];
            } catch (error) {
                reject(error);
            }
        }
        generatedQuestionIDs.ids = generatedQuestionIDs.ids.substring(0, generatedQuestionIDs.ids.length - 2); //take out the final 2 characters
        resolve(generatedQuestionIDs.ids);
    });

    try {
        req.body.questionIDs = await questionsInserted;
    } catch (error) {
        console.log(error);
    }

    //once questions are inserted, we can insert the new activity
    let activityInserted = new Promise((resolve, reject) => {
        let numberOfAttempts = req.body.number_of_attempts ? req.body.number_of_attempts : 3,
            penalisationPerAttempt = req.body.penalisation_per_attempt ? req.body.penalisation_per_attempt : 20,
            penalisation_limit = req.body.penalisation_limit ? req.body.penalisation_limit : 50,
            numberOfQuestions = req.body.number_of_questions ? req.body.number_of_questions : 5,
            pointsMultiplier = req.body.points_multiplier ? req.body.points_multiplier : 10;

        insertOrUpdateTable("activities", [req.body.activityID, req.session.user.teacherID, req.body.title, pointsMultiplier, req.body.video_link, numberOfAttempts,
            penalisationPerAttempt, req.body.questionIDs, numberOfQuestions, req.body.category, req.body.tags, res.locals.user.name + " " + res.locals.user.surname,
            penalisation_limit], "insert").then((res) => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
    });

    activityInserted.then(() => {
        getAllActivities().then(activities => {//we refresh the session activities, all with the same format
            req.session.activities = activities;
            req.session.save((err) => {
                if (err) {
                    console.log(err);
                    res.redirect('/dashboard');
                } else res.redirect(`/activity-summary/${req.body.activityID}`);
            });
        }).catch(err => {
            console.log("Error when fetching new activity" + err);
            res.redirect('/dashboard');
        });
    }).catch((error) => {
        console.log("Error when creating new activity" + error);
        res.redirect('/dashboard');
    })

});

router.get('/activity-summary/:id', redirectIntruders, async (req, res, next) => {
    try {
        let chosenActivity = req.session.activities[req.params.id] ? req.session.activities[req.params.id] : await getActivity(req.params.id);
        Object.values(chosenActivity.questions).forEach((question, index, arr) => {
            if (typeof question.questionChoices === 'string') {
                arr[index].questionChoices = parseQuestionChoices(question.questionChoices);
            }
        });
        res.render('teacher/activitySummary', {
            layout: 'NavBarLayoutT',
            videoLink: `https://www.youtube.com/embed/${getYTVideoID(chosenActivity.videoLink)}`,
            title: `Summary of activity ${chosenActivity.activityID}`,
            activity: chosenActivity
        });
    } catch (error) {
        console.log("Error fetching chosen activity: ", req.params.id, error);
        res.redirect('/dashboard');
    }
});

//Registration and Login
router.get('/student-sign-up', (req, res, next) => {
    res.render('student/signUp', {
        title: 'Sign up',
        errors: req.session.errors
    });
    req.session.errors = null; //to flush them on reload
}).post('/student-sign-up', (req, res, next) => {
    req.body.email = convertToUPMEmail(req.body.email);
    req.body.confirmEmail = convertToUPMEmail(req.body.confirmEmail);
    req.check('studentID', 'studentID is too long').isLength({ max: process.env.STUDENT_ID_LENGTH });
    req.check('teacherID', 'teacherID is too long').isLength({ max: process.env.TEACHER_ID_LENGTH });
    req.check('groupID', 'groupID is too long').isLength({ max: process.env.GROUP_ID_LENGTH });
    req.check('email', 'Invalid email address').matches(studentEmailRegExp);
    req.check('email', 'Emails don\'t match').equals(req.body.confirmEmail);
    req.check('password', 'Invalid password. Must contain at least 1 uppercase, 1 lowercase and 1 number').equals(req.body.confirmPassword).matches(passwordRegEx);
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
                res.redirect('/');
            }
            res.redirect('back');
        });
    } else {//info is correct, we insert into DB
        req.body.includeInRankings = req.body.includeInRankings === "on" ? true : false;
        req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64'); //hashing the password
        req.body.confirmPassword = crypto.createHash('sha256').update(req.body.confirmPassword).digest('base64');
        signUpStudent(req, res).then(() => {
            req.session.signUpSuccess = true;
            req.session.errors = null;
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.status(200).redirect('/student-login');
            });
        }).catch((error) => {
            console.log("There are errors on DB access (student sign up)\n");
            req.session.errors = { 1: { msg: error } };
            req.session.signUpSuccess = false;
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
    }
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
                console.log(err);
                res.locals.error = err;
                res.redirect('/');
            }
            res.redirect('back');
        });
    } else {    //There's no errors, we check DB
        req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64'); //hashing the password
        checkStudentLogin(req, res).then((response) => {
            req.session.errors = null;
            req.session.user = JSON.parse(JSON.stringify(response));
            req.session.userType = "student";
            req.session.save((err) => {
                if (err) {
                    console.log(err);
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/dashboard');
                return res.status(200).redirect('/dashboard');
            });
        }).catch((error) => {
            console.log("There are errors on DB access (student log in)");
            req.session.errors = { 1: { msg: error } };
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
    }
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
    req.check('teacherID', 'ID is too long').isLength({ max: process.env.TEACHER_ID_LENGTH });
    req.check('email', 'Invalid email address').isEmail();
    req.check('password', 'Passwords don\'t match').equals(req.body.confirmPassword);
    req.check('password', 'Invalid password').matches(passwordRegEx);
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on sign up: ", errors);
        req.session.errors = errors;
        req.session.signUpSuccess = false;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
                res.redirect('/');
            }
            res.redirect('back');
        });
    } else {//info is correct, we insert into DB
        req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64');
        req.body.confirmPassword = crypto.createHash('sha256').update(req.body.confirmPassword).digest('base64');
        signUpTeacher(req, res).then(() => {
            req.session.signUpSuccess = true;
            req.session.errors = null;
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.status(200).redirect('/teacher-login');
            });
        }).catch((error) => {
            console.log("There are errors on DB access (teacher sign up)\n");
            req.session.errors = { 1: { msg: error } };
            req.session.signUpSuccess = false;
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
    }
});

router.get('/teacher-login', redirectIfLoggedIn, (req, res, next) => {
    res.render('teacher/login', {
        title: 'Login',
        signUpSuccess: req.session.signUpSuccess,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.signUpSuccess = null;
}).post('/teacher-login', (req, res, next) => {
    req.check('email', 'Invalid email address').isEmail();
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
                res.redirect('/');
            }
            res.redirect('back');
        });
    } else {//There's no errors, we check DB
        req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64');
        checkTeacherLogin(req, res).then((response) => {
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
            req.session.errors = { 1: { msg: error } };
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
    }
});

router.get('/admin-login', redirectIfLoggedIn, (req, res, next) => {
    res.render('admin/login', {
        title: 'Admin Login',
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.errors = null;
    req.session.success = null;
}).post('/admin-login', (req, res, next) => {
    req.check('email', 'Invalid email address').isEmail();
    let errors = req.validationErrors();
    if (errors) {
        console.log("There are errors on log in: ", errors);
        req.session.errors = errors;
        req.session.save((err) => {
            if (err) {
                res.locals.error = err;
                res.redirect('/');
            }
            res.redirect('back');
        });
    } else {//There's no errors, we check DB
        req.body.password = crypto.createHash('sha256').update(req.body.password).digest('base64');
        checkAdminLogin(req, res).then((response) => {
            req.session.errors = null;
            req.session.user = JSON.parse(JSON.stringify(response));
            req.session.userType = "admin";
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('/dashboard');
            });
        }).catch((error) => {
            console.log("There are errors on DB access (admin log in)");
            req.session.errors = { 1: { msg: error } };
            req.session.save((err) => {
                if (err) {
                    res.locals.error = err;
                    return res.redirect('/');
                }
                return res.redirect('back');
            });
        });
    }
});

router.get('/admin/tools', redirectNonAdmins, (req, res, next) => {
    res.render('admin/tools', {
        title: 'Admin Tools',
        layout: 'NavBarLayoutA'
    })
})

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