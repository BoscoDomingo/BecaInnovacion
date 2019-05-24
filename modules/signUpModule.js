'use strict';
let mysql = require('mysql'),
    crypto = require('crypto');

let connection = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: process.env.db_user_S,
    password: process.env.db_pass_S,
    database: 'test-db'
});


async function studentSignUp(email, password, name, surname, studentID, teacherID) {
    let connection = await mysql.createConnection({
        host: 'localhost',
        port: '3306',
        user: process.env.db_user_S,
        password: process.env.db_pass_S,
        database: 'test-db'
    });
    await connection.connect((err) => {
        if (err) console.log(err);
        else console.log("Connected to DB for signing up");
    });
    let success = false;
    await connection.query("INSERT INTO students (studentID, email, password, name, surname, teacherID) VALUES (?, ?, ?, ?, ?, ?);",
        [studentID, email, password, name, surname, teacherID],
        (err, res, fields) => {
            if (err) {
                console.log("error ocurred", err);
                success = false;
                // res.send({
                //     "code": 400,
                //     "failed": "There was an error"
                // });
            } else {
                success = true;
                console.log("Successfully inserted");
                // res.send({
                //     "code": 200,
                //     "success": "Sign Up Sucessful"
                // });
            }
        });
    console.log("Ending connection, success: ", true);
    await connection.end();
    console.log("connection ended");
    return success;
}

function teacherSignup(email, password, name, surname, teacherID) {
    let connection = mysql.createConnection({
        host: 'localhost',
        port: '3306',
        user: process.env.db_user_S,
        password: process.env.db_pass_S,
        database: 'test-db'
    });
    connection.connect((err) => {
        if (err) console.log(err);
        else console.log("Connected to DB for signing up");
    });
    connection.query("INSERT INTO teachers (teacherID, email, password, name, surname) VALUES (?, ?, ?, ?, ?)", [teacherID, email, password, name, surname], (err, res, fields) => {
        if (err) {
            console.log("error ocurred", err);
            res.send({
                "code": 400,
                "failed": "There was an error"
            });
        } else {
            res.send({
                "code": 200,
                "success": "Sign Up Sucessful"
            });
        };
    });
    connection.end();
}

module.exports = async function signUp(type, email, password, name, surname, studentID, teacherID) {
    if (type === "s") {
        await studentSignUp(email, password, name, surname, studentID, teacherID);
    } else if (type === "t") {
        await teacherSignup(email, password, name, surname, teacherID);
    } else return "There was an error. Please, make sure the type of user is ok!";
}