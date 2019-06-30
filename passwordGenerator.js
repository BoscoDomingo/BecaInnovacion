/*
Simply input the new temporary password into the update() field, inside single (' ') or double(" ") quotes.
Then paste the result of running 'node passwordGenerator' inside the student's "password" field in the database and apply
*/
console.log(require('crypto').createHash('sha256').update('Student6').digest('base64'));