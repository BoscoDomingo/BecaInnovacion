'use strict'

function searchByID() {
    // Declare variables
    if (!document.getElementById("error")) {
        let input = document.getElementById("searchbar"),
            filter = input.value.toUpperCase(),
            table = document.getElementById("ranking_table"),
            tr = table.getElementsByTagName("tr"), td, txtValue;

        // Loop through all table rows, and hide those who don't match the search query
        for (let i = 0; i < tr.length; i++) {
            td = tr[i].getElementsByTagName("td")[0];
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