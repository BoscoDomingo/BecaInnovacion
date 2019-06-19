'use strict';
//TODO: CHECK ALL console.log() and see which ones to delete
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
const arrayToObject = (array, keyField) =>
    array.reduce((obj, item) => {
        obj[item[keyField]] = item
        return obj
    }, {})

const isStudent = (session) => {
    return session.userType === "student" ? true : false;
};

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

async function getActivity(activityID) { //returns an object with the desired Activity
    return new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities WHERE activityID = ?;", activityID, async (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else if (results.length > 0) {
                let parsedActivity = results[0];
                try {
                    await new Promise((resolve, reject) => {
                        studentPool.query("SELECT * FROM questions WHERE activityID = ?;", activityID, (err, questions, fields) => {
                            if (err) {
                                console.log("WARNING: Error ocurred during DB Query\n", err);
                                reject("Error during DB Query. Please contact an administrator");
                            } else {
                                parsedActivity.questions = Object.assign({}, questions);
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    reject(error)
                }
                resolve(parsedActivity);
            } else {
                reject("Error during DB Query. No activity found");
            }
        });
    });
};

async function getAllActivities() { //returns an object with ALL activities with questions
    return await new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities;", async (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                let parsedActivities = arrayToObject(results, "activityID"); // Turn results into an Object of Objects from Array of Objects
                Object.values(parsedActivities).forEach((element, index, resultsArray) => { //for each activity
                    studentPool.query("SELECT * FROM questions WHERE activityID = ?;", element.activityID, (err, questions, fields) => {
                        if (err) {
                            console.log("WARNING: Error ocurred during DB Query\n", err);
                            reject("Error during DB Query. Please contact an administrator");
                        } else {
                            resolve(resultsArray[index].questions = Object.assign({}, questions)); //adding the questions to each activity
                        }
                    });
                });
                resolve(parsedActivities);
            }
        });
    });
};
async function getCompletedActivities(studentID) { //returns an object with data of activities COMPLETED by the user without questions
    return await new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM students_activities WHERE studentID = ?;", studentID, (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else if (results.length > 0) {
                resolve(arrayToObject(results, "activityID"));
            } else resolve({});
        });
    });
};
async function getOwnActivities(teacherID) {//returns an object with data of activities CREATED by the user without questions
    return await new Promise((resolve, reject) => {
        studentPool.query("SELECT * FROM activities WHERE teacherID = ?;", teacherID, (err, results, fields) => {
            if (err) {
                console.log("WARNING: Error ocurred during DB Query\n", err);
                reject("Error during DB Query. Please contact an administrator");
            } else {
                resolve(arrayToObject(results, "activityID"));
            }
        });
    });
};

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
        teacherID = req.body.studentID,
        includeInRankings = req.body.includeInRankings,
        storedIP = (loginRateLimiter.getKey(req.ip));
    return new Promise((resolve, reject) => {
        loginRateLimiter.consume(req.ip) //blocking attempts from same IP to avoid brute force
            .then((rateLimiterRes) => {// Allowed, consumed 1 point
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
        try {
            req.session.activities = await getAllActivities();// req.session.activities[1] is the way to access them
        } catch (error) {
            throw new Error(error);
        }

    }
    //TODO: delete
    console.log("Current session's activities: ");
    console.log(req.session.activities);
    // console.log("First activity's questions: ");
    // console.log(Object.values(req.session.activities)[0].questions);

    if (isStudent(req.session)) {
        if (!req.session.completedActivities) {//if student, we retrieve completed activities from DB
            try {
                req.session.completedActivities = await getCompletedActivities(res.locals.user.studentID);
            } catch (error) {
                throw new Error(error);
            }
        }
        console.log(req.session.completedActivities);
        res.render('student/dashboard', {
            title: 'Home Page',
            layout: 'NavBarLayoutS',
            activities: req.session.activities,
            completedActivities: req.session.completedActivities
        });
    } else {//if teacher or admin
        if (!req.session.ownActivities) { //retrieve activities created by this teacher
            try {
                req.session.ownActivities = await getOwnActivities(res.locals.user.teacherID); //TODO: MARK THE ACTIVITIES WHOSE TEACHERID == USER.TEACHERID INSTEAD, and avoid retrieving from DB
            } catch (error) {
                throw new Error(error);
            }
        }
        res.render('teacher/dashboard', {
            title: 'Teacher Home Page',
            layout: 'NavBarLayoutT',
            activities: req.session.activities,
            ownActivities: req.session.ownActivities
        });
    }
});

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
        layout: 'NavBarLayoutT',
        title: "Creating activity"
    });
}).post('/create-activity', redirectIntruders, async (req, res, next) => {
    req.body.questions = {};
    do {//Generates pseudo-random activityID (AXXXXXXXX), checks if it already exists. If it does, generates a new one. If it doesn't, inserts into DB
        req.body.activityID = generateNewID("A", 9);
    } while (!isValidActivityID(req.body.activityID, req.session.activities));

    //we start by inserting questions into DB under the new activityID:
    let questionsInserted = new Promise(async (resolve, reject) => { //parse questions and insert them into DB, resolving with the string of the generated questionIDs 
        let generatedQuestionIDs = { ids: "" };  //so the changes remain outside the scope of the for loop
        for (let i = 1; i <= req.body.number_of_questions; i++) { //question by question
            let generatedQuestionID = { id: "" },
                isValid = false;

            do { //generate unique questionID for each
                try {
                    generatedQuestionID.id = generateNewID("Q", 9);
                    isValid = await isValidQuestionID(generatedQuestionID.id);
                } catch (error) {
                    reject(error);
                }
            } while (!isValid);

            //Parse choices of current question into one string
            let choices = { choicesString: "" };
            if (req.body["question_type_" + i] === "test") {
                for (let j = (i - 1) * 4 + 1; j <= (i - 1) * 4 + 4; j++) { //assuming 4 choices per question
                    choices.choicesString += (req.body["choice_" + j] + "--");
                    delete req.body["choice_" + j]; //because we move them to another place
                }
                choices.choicesString = choices.choicesString.substring(0, choices.choicesString.length - 2) //erase the final 2 characters
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
        generatedQuestionIDs.ids = generatedQuestionIDs.ids.substring(0, generatedQuestionIDs.ids.length - 2) //take out the final 2 characters
        resolve(generatedQuestionIDs.ids);
    });

    try {
        req.body.questionIDs = await questionsInserted;
    } catch (error) {
        throw new Error(error);
    }

    //once questions are inserted, we can insert the new activity
    let activityInserted = new Promise((resolve, reject) => {
        let numberOfAttempts = req.body.number_of_attempts ? req.body.number_of_attempts : 3,
            penalisationPerAttempt = req.body.penalisation_per_attempt ? req.body.penalisation_per_attempt : 0;

        teacherPool.query("INSERT INTO activities (activityID, teacherID, title, videoLink, numberOfAttempts, penalisationPerAttempt, questionIDs, numberOfQuestions, category, tags)"
            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [req.body.activityID, req.session.user.teacherID, req.body.title, req.body.video_link, numberOfAttempts, penalisationPerAttempt, req.body.questionIDs, req.body.number_of_questions, req.body.category, req.body.tags],
            (err, results, fields) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject("Error during DB Query. Please contact an administrator");
                } else {
                    console.log("Successfully inserted activity");
                    resolve();
                }
            });
    });

    activityInserted.then(() => {
        getAllActivities().then(activities => {
            console.log("\nNew activities\n")
            console.log(activities)
            req.session.activities = activities;//we refresh the session activities
        }).catch(err => { 
            console.log("Error when fetching new activity" + err);
            res.redirect('/dashboard');
        });
        res.redirect(`/activity-summary/${req.body.activityID}`);
    }).catch((error) => {
        console.log("Error when creating new activity" + error);
        res.redirect('/dashboard');
    })

});

router.get('/activity-summary/:id', redirectIntruders, async (req, res, next) => {
    try {
        let chosenActivity = req.session.activities[req.params.id] ? req.session.activities[req.params.id] : await getActivity(req.params.id);
        res.render('teacher/activitySummary', {
            layout: 'NavBarLayoutT',
            title: `Summary of activity ${chosenActivity.activityID}`,
            activity: chosenActivity
        });
    } catch (error) {
        console.log("Error fetching chosen activity: ", req.params.id, error);
        res.redirect('/dashboard');
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
    req.body.includeInRankings = req.body.includeInRankings === true ? 1 : 0; //because MySQL doesn't accept boolean values
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