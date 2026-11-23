
function checkAnswer(button, correct) {
    const result = document.getElementById("quiz-result");
    const buttons = document.querySelectorAll(".quiz-option");

    buttons.forEach(function(btn) {
        btn.disabled = true;
    });

    if (correct) {
        result.textContent = "Correct! Great job!";
        result.style.color = "green";
    } else {
        result.textContent = "Incorrect! Try learning HTML and try again next time.";
        result.style.color = "red";
    }
}


