'use strict'
const passwordRegEx = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z\d]{8,}$/g;

function validatePassword() {
    // let password = document.getElementById("password"),
    //     correctPassword = document.getElementById("correctPassword");

    // if (passwordRegEx.test(password.value)) {
    //     correctPassword.innerHTML = "";
    //     correctPassword.style.display = "none";
    // } else {
    //     correctPassword.innerHTML = "Password must contain 8 characters, one UPPER case letter, one lower case and one number";
    //     correctPassword.style.display = "inline";
    // }
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

// document.addEventListener("DOMContentLoaded", () => {
// });