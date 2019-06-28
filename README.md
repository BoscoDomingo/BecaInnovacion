# Beca Innovación UPM - Proyecto PIE gamificación

# Instructions

## Terminal (in project folder):
- `npm install` => to install all dependencies
- `npm start` => Starts the server
- `rs`=> Forces a restart once the server is up
- ctrl + C => Stops the server

## MySQL:
Create a database with 3 users, 1 for student and 1 for teacher access as well as a "session keeper" (give the privileges you see fit for each)

Update `/.env`. By default:

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

- Then execute: `groups_updater.sql` (open the file on MySQL Workbench and run it). Documentation available at https://dev.mysql.com/doc/refman/8.0/en/create-event.html & https://dev.mysql.com/doc/refman/8.0/en/alter-event.html


## Miscellaneous:

### Project structure:

Main file is `/app.js`, which contains all the server setup and different node modules used. The second most important (and the one developers will be working on the most) is the `/routes/routes.js` file, in which every single route is handled. If a route doesn't exist, it won't redirect unless implemented. All other routes require a callback function receiving`(req,res,next)` as parameters. The documentation for the aforementioned is available at https://expressjs.com/en/4x/api.html#express.


Alternative RegEx for email validation:
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
