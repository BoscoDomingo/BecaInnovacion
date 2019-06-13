'use strict';
const studentPool = require('mysql').createPool({
    connectionLimit: 100,
    waitForConnections: true,
    queueLimit: 10000,//0 for unlimited process in the queue waiting for connection
    host: process.env.db_host,
    port: process.env.db_port,
    user: process.env.db_user_S,
    password: process.env.db_pass_S,
    database: process.env.db_name
}),
    teacherPool = require('mysql').createPool({
        connectionLimit: 40,
        waitForConnections: true,
        queueLimit: 10000,//0 for unlimited process in the queue waiting for connection
        host: process.env.db_host,
        port: process.env.db_port,
        user: process.env.db_user_T,
        password: process.env.db_pass_T,
        database: process.env.db_name
    });
//source https://github.com/mysqljs/mysql#pooling-connections

module.exports = function signUp(type, email, password, name, surname, studentID, teacherID) {
    if (type === "s") {
        return new Promise((resolve, reject) => {
            studentPool.query("INSERT INTO students (studentID, email, password, name, surname, teacherID) VALUES (?, ?, ?, ?, ?, ?);",
                [studentID, email, password, name, surname, teacherID],
                (err, res, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject();
                    } else {
                        console.log("Successfully inserted student");
                        resolve();
                    }
                });
        });
    } else if (type === "t") {
        return new Promise((resolve, reject) => {
            teacherPool.query("INSERT INTO teachers (teacherID, email, password, name, surname) VALUES (?, ?, ?, ?, ?)",
                [teacherID, email, password, name, surname],
                (err, res, fields) => {
                    if (err) {
                        console.log("WARNING: Error ocurred during DB Query\n", err);
                        reject();
                    } else {
                        console.log("Successfully inserted teacher");
                        resolve();
                    }
                });
        });
    } else {
        console.log("There was an error. Please, make sure the type of user is ok!");
        return false;
    }
}