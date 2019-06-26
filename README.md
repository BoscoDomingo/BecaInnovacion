BecaInnovacion2

Terminal (in project folder):
npm install => to install all dependencies

npm start => Starts the server
rs => Forces a restart once the server is up
ctrl + C => Stops the server

MySQL:
create a database with 2 users, one for student and one for teacher access (give the privileges you see fit for each)
Update the .env file. By default:

db_user_S = "studentConnector"
db_pass_S = "ab123"
db_user_T = "teacherConnector"
db_pass_T = "ab123"
db_port = '3306'
db_name = 'test-db'
db_host = 'localhost'

Other:
Alternative RegEx for the email: /^(?=.*[A-ZÑÁÉÍÓÚÜ])(?=.*[a-zñáéíóúü])(?=.*\d)[\w.!#$%&’*+/=?^_`{|}~\-ÑñáéíóúüÁÉÍÓÚÜ:;ÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸ¡¿çÇŒœßØøÅå ÆæÞþÐð""'.,&#@:?!()$\\/]{8,}$/
