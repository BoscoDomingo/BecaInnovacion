'use strict';
let pool = require('mysql').createPool({
    connectionLimit: 100,
    waitForConnections: true,
    queueLimit: 10000,//0 for unlimited process in the queue waiting for connection
    host: 'localhost',
    port: '3306',
    user: process.env.db_user_S,
    password: process.env.db_pass_S,
    database: 'test-db'
});

module.exports = function checkLogin(type, email, password) {
    if (type === "s") {
        return new Promise((resolve, reject) => {
            pool.query("SELECT password FROM students WHERE email = ?;", email, (err, res, fields) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject();
                } else if (res.length <= 0 || res[0].password != password) {
                    console.log("Failed login");
                    reject();
                } else {
                    console.log("Login successful");
                    resolve();
                }
            });
        });
    } else if (type === "t") {
        return new Promise((resolve, reject) => {
            pool.query("SELECT teacherID, password FROM teachers WHERE email = ?", email, (err, res, fields) => {
                if (err) {
                    console.log("WARNING: Error ocurred during DB Query\n", err);
                    reject();
                } else if (res.length <= 0 || res[0].password != password) {
                    console.log("Failed login");
                    reject();
                } else {
                    console.log("Login successful");
                    resolve();
                }
            });
        });
    } else return "There was an error. Please, make sure the type of user is ok!";
};