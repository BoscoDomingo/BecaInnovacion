let mysql = require('mysql'),
    crypto = require('crypto');

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

function studentSignUp(email, password, name, surname, ID) {
    connection.query("INSERT INTO students VALUES studentID = ?, email = ?, password = ?, name = ?, surname = ?", ID, email, password, name, surname, (err, res, fields) => {
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

function teacherSignup(email, password, name, surname, ID) {
    connection.query("INSERT INTO teachers VALUES teacherID = ?, email = ?, password = ?, name = ?, surname = ?", ID, email, password, name, surname, (err, res, fields) => {
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

module.exports = function signUp(type, email, password, name, surname, ID) {
    if (type === "s") {
        studentSignUp(email, password, name, surname, ID);
    } else if (type === "t") {
        teacherSignup(email, password, name, surname, ID);
    } else return "There was an error. Please, make sure the type of user is ok!";
}