'use strict';
let mysql = require('mysql');

let connection = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: process.env.db_user_S,
    password: process.env.db_pass_S,
    database: 'test-db'
});

function checkStudentLogin(email, password) {
    connection.connect((err) => {
        if (err) console.log(err);
        else console.log("Connected to DB for checking logins");
    });
    connection.query("SELECT password FROM students WHERE email = ?", email, (err, res, fields) => {
        if (error) {
            console.log("error ocurred", error);
            res.send({
                "code": 400,
                "failed": "There was an error"
            });
        } else {
            if (results.length > 0) {
                if (results[0].password == password) {
                    res.send({
                        "code": 200,
                        "success": "Login sucessful",
                        "studentID": results[0].studentID
                    });
                }
                else {
                    res.send({
                        "code": 204,
                        "success": "Login unsuccessful"
                    });
                }
            }
            else {
                res.send({
                    "code": 204,
                    "success": "Login unsuccessful"
                });
            }
        }
    });
    connection.end();
};

function checkTeacherLogin(email, password) {
    connection.connect((err) => {
        if (err) console.log(err);
        else console.log("Connected to DB for checking logins");
    });
    connection.query("SELECT studentID, password FROM teacher WHERE email = ?", email, (err, res, fields) => {
        if (error) {
            console.log("error ocurred", error);
            res.send({
                "code": 400,
                "failed": "There was an error retrieving from database"
            });
        } else {
            if (results.length > 0) {
                if (results[0].password == password) {
                    res.send({
                        "code": 200,
                        "success": "Login sucessful",
                        "teacherID": results[0].teacherID
                    });
                }
                else {
                    res.send({
                        "code": 204,
                        "success": "Login unsuccessful"
                    });
                }
            }
            else {
                res.send({
                    "code": 204,
                    "success": "Login unsuccessful"
                });
            }
        }
    });
    connection.end();
};

module.exports = function checkLogin(type, email, password) {
    if (type === "s") {
        return checkStudentLogin(email, password);
    } else if (type === "t") return checkTeacherLogin(email, password);
    else return "There was an error. Please, make sure the type of user is ok!";
};