var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'English For Professional and Academic Communication extra credit page',
    layout: null
  });
});

router.get('/loginStudent', function (req, res, next) {
  res.render('loginS', {
    title: 'Login',
    layout: null
  });
});

router.get('/loginTeacher', function (req, res, next) {
  res.render('loginT', {
    title: 'Login',
    layout: null
  });
});

//URL: localhost:port/users/
/* GET users listing. */
// router.get('/', function (req, res, next) {
//   res.send('respond with a resource');
// });


module.exports = router;