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

TO ACCESS HANDLEBARS VARIABLES IN JAVASCRIPT:
Can't use an external JS file, script must be written directly onto .hbs file. Examples:

//in routes.js
res.render('teacher/groups', {
            encodedGroups: encodeURIComponent(JSON.stringify(groups)),
            groups: groups,
            layout: 'NavBarLayoutT'
        });

//in teacher/groups.hbs:
<script>
    let decodedJson = decodeURIComponent("{{{encodedGroups}}}"),
        groups = JSON.parse(decodedJson);
    console.log(groups);
    Object.values(groups).forEach((element, index, array) => {
        console.log(element);
    });
</script>

{{#each groups as |group|}}
    <script>
        console.log("{{group.groupID}}")
    </script>
{{/each}}
