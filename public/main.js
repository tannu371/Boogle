// Hide server-side messages after 3 seconds
document.addEventListener("DOMContentLoaded", () => {
  const msg = document.getElementById("message");
  if (msg && msg.textContent.trim() !== "") {
    setTimeout(() => {
      msg.style.display = "none";
    }, 3000);
  }
});

$("input[type='password']").click(() => {
  $(".left img").attr("src", "images/cover.png");
});

$(".hi").click(() => {
  $(".left img").attr("src", "images/welcome.png");
});

function validatePasswords() {
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const message = document.getElementById("message");

  if (password !== confirmPassword) {
    message.textContent = "❌ Passwords do not match!";
    message.style.color = "red";
    return false;
  }
  message.textContent = "✅ Passwords match!";
  message.style.color = "green";
  return true;
}

function renderImg(event, id) {
  document
    .getElementById(id + "Img")
    .setAttribute("src", URL.createObjectURL(event.target.files[0]));
}

var standard_message = $("#text-area").val();
$("#text-area").focus(function () {
  if ($(this).val() == standard_message) $(this).val("");
});
$("#text-area").blur(function () {
  if ($(this).val() == "") $(this).val(standard_message);
});

function generateMsg(e, x) {
  e.preventDefault();
  const msgElem = document.getElementById("msg");
  msgElem.style.display = "block";
  if (x == 0) {
    msgElem.textContent = "Please LogIn to Create your own blog!";
  } else if (x == 1) {
    msgElem.textContent = "Please LogIn to Save blogs and watch them later!";
  }
  setTimeout(() => {
    msgElem.textContent = "";
    msgElem.style.display = "none";
  }, 3000);
}

function changeColor(id) {
  document
    .getElementById(id)
    .querySelectorAll("svg path")
    .forEach((elem) => {
      elem.style.fill = "orange";
    });
}
