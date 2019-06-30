/*
Simply input the new temporary password into the update() field, inside single (' ') or double(" ") quotes.
Then paste the result of running 'node passwordGenerator' inside the student's "password" field in the database and apply.

You can also use this generator to create the password by using update(generateOTP()) instead:*/
function generateOTP() {
    const string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var OTP = '',
        len = string.length;
    for (let i = 0; i < 8; i++) {
        OTP += string[Math.floor(Math.random() * len)];
    }
    console.log("\nThe password the user has to input is: " + OTP);
    return OTP;
}
console.log(`\nThe password to paste into DB is: ${require('crypto').createHash('sha256').update(generateOTP()).digest('base64')}\n`);