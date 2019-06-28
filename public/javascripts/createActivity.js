'use strict'
let questionCounter = 5;
//Planned Stages:
/*  1st: Basic form, 5 test questions - DONE
    2nd: Allow to change number of questions => implement changeNumberOfQuestions() 
    3rd: allow different question types => implement changeQuestionType()*/

function changeNumberOfQuestions() {
    const numberOfQuestions = document.getElementById("number_of_questions").value,//the number of desired questions
        questionsContainer = document.getElementById("questions_container"),
        questionTemplate = document.getElementById("question_template");
    if (questionCounter < numberOfQuestions) {//adding new questions
        while (questionCounter < numberOfQuestions) {
            questionCounter++;
            questionsContainer.appendChild()
        }
        //we are adding questions
    } else if (questionCounter > numberOfQuestions) {//removing questions
    }
    questionCounter = numberOfQuestions;

    /* while (questionsContainer.firstChild) { //to clear the questions
        questionsContainer.removeChild(questionsContainer.firstChild);
    } */

}


let counter = 0;
function moreFields() {
    counter++;
    let newFields = document.getElementById("readroot").cloneNode(true);
    newFields.id = '';
    newFields.style.display = 'block';
    let newField = newFields.childNodes;
    for (let i = 0; i < newField.length; i++) {
        let theName = newField[i].name;
        if (theName)
            newField[i].name = theName + counter;
    }
    let insertHere = document.getElementById("writeroot");
    insertHere.parentNode.insertBefore(newFields, insertHere);
}
window.onload = moreFields;


function changeQuestionType(question) {
    const questionID = question.id.substring(13);
    console.log("Changing question with id: " + questionID);
    //TODO: allow for test and text questions
}

document.getElementById("activity-form").addEventListener("onsubmit", () => {
    //TODO: Possibly validate form
})