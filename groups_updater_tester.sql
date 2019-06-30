#THE UPDATE QUERY ITSELF
UPDATE groupstable AS t1 SET
	numberOfStudents = IFNULL((SELECT numOfStudents FROM (SELECT groupID, COUNT(studentID) as numOfStudents FROM students WHERE isDeleted = 0 GROUP BY groupID) t2
						WHERE t2.groupID = t1.groupID), 0),
	averageGrade = IFNULL((SELECT avgGrade FROM (SELECT groupID, TRUNCATE(AVG(grade),3) as avgGrade FROM students_activities
											WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
											GROUP BY groupID) t3
					WHERE t3.groupID = t1.groupID), 0),
	averagePoints = IFNULL((SELECT avgPoints FROM (SELECT groupID, TRUNCATE(AVG(pointsAwarded),2) as avgPoints FROM students_activities
											WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
											GROUP BY groupID) t4
					WHERE t4.groupID = t1.groupID), 0),
	highestPoints = IFNULL((SELECT maxPoints FROM (SELECT groupID, MAX(totalPoints) as maxPoints FROM students WHERE isDeleted = 0 GROUP BY groupID) t5
					WHERE t5.groupID = t1.groupID), 0),
	totalPoints = IFNULL((SELECT total FROM (SELECT groupID, SUM(totalPoints) AS total FROM students WHERE isDeleted = 0 GROUP BY groupID) t6
					WHERE t6.groupID = t1.groupID), 0);
/* #TO CHECK THE DATA
SELECT * FROM groupstable t1
JOIN (SELECT groupID, TRUNCATE(AVG(grade),3),TRUNCATE(AVG(pointsAwarded),2)
		FROM students_activities WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
		GROUP BY groupID) t2 ON t1.groupID = t2.groupID
JOIN (SELECT groupID, MAX(totalPoints) FROM students WHERE isDeleted = 0 GROUP BY groupID) t3 ON t3.groupID = t1.groupID;
*/

/* #INDIVIDUAL QUERIES
SELECT groupID, COUNT(studentID) FROM students WHERE isDeleted = 0 GROUP BY groupID;

SELECT groupID, TRUNCATE(AVG(grade),3) FROM students_activities
WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
GROUP BY groupID;

SELECT groupID, TRUNCATE(AVG(pointsAwarded),2) FROM students_activities
WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1)
GROUP BY groupID;

SELECT groupID, MAX(totalPoints) FROM students
WHERE isDeleted = 0
GROUP BY groupID;
*/


/*#IN CASE YOU SWITCH TO A DIFFERENT SQL DATABASE, THIS MIGHT BECOME USEFUL
	JOIN (SELECT groupID, COUNT(studentID) as numberOfStudents, MAX(totalPoints) as maxPoints FROM students WHERE isDeleted = 0 GROUP BY groupID) t2 ON t2.groupID = t1.groupID
	JOIN (SELECT groupID, TRUNCATE(AVG(grade),3) as avgGrade,TRUNCATE(AVG(pointsAwarded),2) as avgPoints FROM students_activities WHERE studentID NOT IN (SELECT studentID FROM students WHERE isDeleted = 1) GROUP BY groupID) t3
	ON t3.groupID = t2.groupID*/