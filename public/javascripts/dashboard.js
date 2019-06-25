document.addEventListener("DOMContentLoaded", () => {
    const ownActivityListContainer = document.getElementById('own_activity_list'),
        completedActivityListContainer = document.getElementById('completed_activity_list');

    var listOptions = {
        valueNames: ['title', 'id', 'author', 'category', 'tags'],
    };

    var activityList = new List('activity_list', listOptions);
    /* to search a specific column, use activityList.search(document.getElementByID('activity_search', [column1, column2]));
    and implement a function that searches on keyup, for example. Source: https://listjs.com/api/#search */
    if (completedActivityListContainer) {
        var completedActivityList = new List(completedActivityListContainer, listOptions);
    } else if (ownActivityListContainer) {
        var ownActivityList = new List(ownActivityListContainer, listOptions);
    }
});

