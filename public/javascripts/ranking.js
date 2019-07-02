'use strict'

function searchByID(choice) {
    // Declare variables
    if (!document.getElementById("error")) {
        if (choice === "group2") { //add more options if desired. Can use a switch too or use choice = choice ? choice += "_" : ""; var input = document.getElementById(choice +"searchbar"),...
            var input = document.getElementById("group_searchbar"),
                table = document.getElementById("ranking_table"),
                index = 1;
        } else if (choice === "group") { //add more options if desired. Can use a switch too or use choice = choice ? choice += "_" : ""; var input = document.getElementById(choice +"searchbar"),...
            var input = document.getElementById("group_searchbar"),
                table = document.getElementById("group_ranking_table"),
                index = 0;
        } else {
            var input = document.getElementById("searchbar"),
                table = document.getElementById("ranking_table"), index = 0;
        }
        var filter = input.value.toUpperCase(), //remove to make case sensitive
            tr = table.getElementsByTagName("tr"), td, txtValue;

        // Loop through all table rows, and hide those who don't match the search query
        for (let i = 0; i < tr.length; i++) {
            td = tr[i].getElementsByTagName("td")[index]; //index = 0 => 1st column, index = 1 => 2nd column...
            if (td) {
                txtValue = td.textContent || td.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        }
    }
}

function sortTable(n, choice) {
    if (!document.getElementById("error")) {
        if (choice === "group") { //add more options if desired. Can use a switch too or use choice = choice ? choice += "_" : ""; var table = document.getElementById(choice +"ranking_table");
            var table = document.getElementById("group_ranking_table");
        } else {
            var table = document.getElementById("ranking_table");
        }
        var switching = true,
            dir = "asc", switchcount = 0,
            i, x, y, shouldSwitch;

        // Make a loop that will continue until no switching has been done:
        while (switching) {
            switching = false;
            let rows = table.rows;
            for (i = 1; i < (rows.length - 1); i++) { // Loop through all table rows except the first (headers):
                shouldSwitch = false;
                x = rows[i].getElementsByTagName("TD")[n];// Get the two elements to compare, one from current row 
                y = rows[i + 1].getElementsByTagName("TD")[n];//and one from the next

                if (dir == "asc") {// Check if the two rows should switch place
                    if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                        shouldSwitch = true;// If so, mark as a switch and break the loop:
                        break;
                    }
                } else if (dir == "desc") {
                    if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                        shouldSwitch = true;// If so, mark as a switch and break the loop:
                        break;
                    }
                }
            }
            if (shouldSwitch) {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                switchcount++;
            } else {
                // If no switching has been done AND the direction is "asc", set the direction to "desc" and run the while loop again.
                if (switchcount == 0 && dir == "asc") {
                    dir = "desc";
                    switching = true;
                }
            }
        }
    }
}