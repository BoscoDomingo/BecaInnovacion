'use strict'
const passwordRegEx = /(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[\d\w!"·$%&/()=?¿¡ñç\*\+\-|@#~€¬]{8,}/;

function validatePassword() {
    let password = document.getElementById("password"),
        correctPassword = document.getElementById("correctPassword");

    if (passwordRegEx.test(password.value)) {
        correctPassword.innerHTML = "";
        correctPassword.style.display = "none";
    } else {
        correctPassword.innerHTML = "Password must contain 8 characters, one UPPER case letter, one lower case and one number (0-9)";
        correctPassword.style.display = "inline";
    }
}

function checkConfirm() {
    let password = document.getElementById("password"),
        confirmPassword = document.getElementById("confirmPassword"),
        validator = document.getElementById("validatePasswords");

    if (password.value === confirmPassword.value) {
        validator.innerHTML = "";
        validator.style.display = "none";
    } else {
        validator.innerHTML = "Passwords don't match";
        validator.style.display = "inline";
    }
}

function showPasswords() {
    var x = document.getElementById("password"),
        y = document.getElementById("confirmPassword");
    if (x.type === "password") {
        x.type = "text";
        y.type = "text";
    } else {
        x.type = "password";
        y.type = "password";
    }
}