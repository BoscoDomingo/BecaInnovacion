'use strict';
let mysql = require('mysql');

async function checkStudentLogin(email, password) {
    let success = false;
    let connection = mysql.createConnection({
        host: 'localhost',
        port: '3306',
        user: process.env.db_user_S,
        password: process.env.db_pass_S,
        database: 'test-db'
    });
    await connection.connect((err) => {
        if (err) console.log(err);
        else console.log("Connected to DB for checking logins");
    });
    await connection.query("SELECT password FROM students WHERE email = ?", email, (err, res, fields) => {
        if (err) {
            console.log("error ocurred accessing DB on login", error);
        } else {
            if (res.length > 0 && res[0].password == password) {
                success = true;
                // res.send({
                //     "code": 200,
                //     "success": "Login sucessful",
                //     "studentID": res[0].studentID
                // });
            }
            // else {
            //     res.send({
            //         "code": 204,
            //         "success": "Login unsuccessful"
            //     });
            // }
        }
    });
    console.log("Ending login connection");
    await connection.end();
    console.log("Connection ended");
    return success;
};
//TO-DO Check this so it matches the student one but is suited to the teacher
async function checkTeacherLogin(email, password) {
    let connection = mysql.createConnection({
        host: 'localhost',
        port: '3306',
        user: process.env.db_user_S,
        password: process.env.db_pass_S,
        database: 'test-db'
    });
    await connection.connect((err) => {
        if (err) console.log(err);
        else console.log("Connected to DB for checking logins");
    });
    await connection.query("SELECT teacherID, password FROM teachers WHERE email = ?", email, (err, results, fields) => {
        if (err) {
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
    await connection.end();
};

module.exports = async function checkLogin(type, email, password) {
    if (type === "s") {
        return await checkStudentLogin(email, password);
    } else if (type === "t") return await checkTeacherLogin(email, password);
    else return "There was an error. Please, make sure the type of user is ok!";
};