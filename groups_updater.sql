/*IF RUNNING FOR THE FIRST TIME: (Source: https://dev.mysql.com/doc/refman/8.0/en/create-event.html)*/

CREATE EVENT IF NOT EXISTS beca_innovacion_upm.group_updater
ON SCHEDULE EVERY 1 minute
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Updates the group table'
DO
	UPDATE groupstable AS t1 SET
	numberOfStudents = (SELECT numOfStudents FROM (SELECT groupID, COUNT(studentID) as numOfStudents FROM students WHERE isDeleted = 0 GROUP BY groupID) t2
						WHERE t2.groupID = t1.groupID),
	averageGrade = (SELECT avgGrade FROM (SELECT groupID, TRUNCATE(AVG(grade),3) as avgGrade FROM students_activities
											WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
											GROUP BY groupID) t3
					WHERE t3.groupID = t1.groupID),
	averagePoints = (SELECT avgPoints FROM (SELECT groupID, TRUNCATE(AVG(pointsAwarded),2) as avgPoints FROM students_activities
											WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
											GROUP BY groupID) t4
					WHERE t4.groupID = t1.groupID),
	highestPoints = (SELECT maxPoints FROM (SELECT groupID, MAX(totalPoints) as maxPoints FROM students WHERE isDeleted = 0 GROUP BY groupID) t5
					WHERE t5.groupID = t1.groupID),
	totalPoints = (SELECT total FROM (SELECT groupID, SUM(totalPoints) AS total FROM students WHERE isDeleted = 0 GROUP BY groupID) t6
					WHERE t6.groupID = t1.groupID);

#ELSE (Source: https://dev.mysql.com/doc/refman/8.0/en/alter-event.html)
/*
ALTER EVENT beca_innovacion_upm.group_updater
DO
	UPDATE groupstable AS t1 SET
	numberOfStudents = (SELECT numOfStudents FROM (SELECT groupID, COUNT(studentID) as numOfStudents FROM students WHERE isDeleted = 0 GROUP BY groupID) t2
						WHERE t2.groupID = t1.groupID),
	averageGrade = (SELECT avgGrade FROM (SELECT groupID, TRUNCATE(AVG(grade),3) as avgGrade FROM students_activities
											WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
											GROUP BY groupID) t3
					WHERE t3.groupID = t1.groupID),
	averagePoints = (SELECT avgPoints FROM (SELECT groupID, TRUNCATE(AVG(pointsAwarded),2) as avgPoints FROM students_activities
											WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
											GROUP BY groupID) t4
					WHERE t4.groupID = t1.groupID),
	highestPoints = (SELECT maxPoints FROM (SELECT groupID, MAX(totalPoints) as maxPoints FROM students WHERE isDeleted = 0 GROUP BY groupID) t5
					WHERE t5.groupID = t1.groupID),
	totalPoints = (SELECT total FROM (SELECT groupID, SUM(totalPoints) AS total FROM students WHERE isDeleted = 0 GROUP BY groupID) t6
					WHERE t6.groupID = t1.groupID);
*/
