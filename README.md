# BecaInnovacion2

## Terminal (in project folder):
- `npm install` => to install all dependencies
- `npm start` => Starts the server
- `rs`=> Forces a restart once the server is up
- ctrl + C => Stops the server

## MySQL:
create a database with 3 users, one for student and one for teacher access as well as a "session keeper" (give the privileges you see fit for each)
Update the .env file. By default:

```
db_user_S = "studentConnector"
db_pass_S = "ab123"
db_user_T = "teacherConnector"
db_pass_T = "ab123"
db_session_user = "sessionConnector"
db_session_pass = "secret"
db_port = '3306'
db_name = 'beca_innovacion_upm'
db_host = 'localhost'
```

- Turn on event_scheduler with on MySQL CLC or Workbench: `SET GLOBAL event_scheduler = ON;`

- And check with: `SHOW PROCESSLIST`

- Then execute: `groups_updater.sql` (open the file on MySQL Workbench and run it). Instructions available at https://dev.mysql.com/doc/refman/8.0/en/create-event.html & https://dev.mysql.com/doc/refman/8.0/en/alter-event.html


## Other:
Alternative RegEx for the email:
```
/^(?=._[A-ZÑÁÉÍÓÚÜ])(?=._[a-zñáéíóúü])(?=._\d)[\w.!#\$%&’_+/=?^\_`{|}~\-ÑñáéíóúüÁÉÍÓÚÜ:;ÀÈÌÒÙàèìòùÁÉÍÓÚÝáéíóúýÂÊÎÔÛâêîôûÃÕãõÄËÏÖÜŸäëïöüŸ¡¿çÇŒœßØøÅåÆæÞþÐð""'.,&#@:?!()$\\/]{8,}$/
```

### TO ACCESS HANDLEBARS VARIABLES IN JAVASCRIPT:
Can't use an external JS file, script must be written directly onto .hbs file. Examples:

```
//in routes.js
res.render('teacher/groups', {
            encodedGroups: encodeURIComponent(JSON.stringify(groups)),
            groups: groups,
            layout: 'NavBarLayoutT'
        });
```
```
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
```
