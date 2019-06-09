'use strict';
let mysql = require('mysql'),
    crypto = require('crypto');

let pool = mysql.createPool({
    connectionLimit: 100,
    waitForConnections: true,
    queueLimit: 10000,//0 for unlimited process in the queue waiting for connection
    host: 'localhost',
    port: '3306',
    user: process.env.db_user_S,
    password: process.env.db_pass_S,
    database: 'test-db'
});
//source https://github.com/mysqljs/mysql#pooling-connections

module.exports = function signUp(type, email, password, name, surname, studentID, teacherID) {
    if (type === "s") {
        let promise = new Promise((resolve, reject) => {
            pool.query("INSERT INTO students (studentID, email, password, name, surname, teacherID) VALUES (?, ?, ?, ?, ?, ?);",
                [studentID, email, password, name, surname, teacherID],
                (err, res, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query!\n", err);
                        reject();
                    } else {
                        console.log("Successfully inserted student");
                        resolve();
                    }
                });
        });
        return promise;
    } else if (type === "t") {
        let promise = new Promise((resolve, reject) => {
            pool.query("INSERT INTO teachers (teacherID, email, password, name, surname) VALUES (?, ?, ?, ?, ?)",
                [teacherID, email, password, name, surname],
                (err, res, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query!\n", err);
                        reject();
                    } else {
                        console.log("Successfully inserted teacher");
                        resolve();
                    }
                });
        });
        return promise;
    } else {
        console.log("There was an error. Please, make sure the type of user is ok!");
        return false;
    }
}