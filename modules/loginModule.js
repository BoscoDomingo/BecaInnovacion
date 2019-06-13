'use strict';
let studentPool = require('mysql').createPool({
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
        connectionLimit: 100,
        waitForConnections: true,
        queueLimit: 10000,//0 for unlimited process in the queue waiting for connection
        host: process.env.db_host,
        port: process.env.db_port,
        user: process.env.db_user_T,
        password: process.env.db_pass_T,
        database: process.env.db_name
    });

module.exports = function checkLogin(type, email, password) {
    if (type === "s") {
        return new Promise((resolve, reject) => {
            studentPool.query("SELECT password FROM students WHERE email = ?;", email, (err, res, fields) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject();
                } else if (res.length <= 0 || res[0].password != password) {
                    console.log("Login failed");
                    reject();
                } else {
                    console.log("Login successful");
                    resolve();
                }
            });
        });
    } else if (type === "t") {
        return new Promise((resolve, reject) => {
            teacherPool.query("SELECT teacherID, password FROM teachers WHERE email = ?", email, (err, res, fields) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject();
                } else if (res.length <= 0 || res[0].password != password) {
                    console.log("Login failed");
                    reject();
                } else {
                    console.log("Login successful");
                    resolve();
                }
            });
        });
    } else return "There was an error. Please, make sure user type is correct";
};