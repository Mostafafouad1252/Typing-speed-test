const authSectionEl = document.getElementById("auth-section");
const typingSectionEl = document.getElementById("typing-section");
const authMessageEl = document.getElementById("auth-message");
const welcomeEl = document.getElementById("welcome");

const registerFormEl = document.getElementById("register-form");
const loginFormEl = document.getElementById("login-form");
const logoutBtnEl = document.getElementById("logout-btn");

const sampleTextEl = document.getElementById("sample-text");
const typingInputEl = document.getElementById("typing-input");
const timerEl = document.getElementById("timer");
const wpmEl = document.getElementById("wpm");
const accuracyEl = document.getElementById("accuracy");
const resetBtn = document.getElementById("reset-btn");
const difficultyEl = document.getElementById("difficulty");
const testTimeEl = document.getElementById("test-time");

let selectedText = "";
let testDurationSeconds = 60;
let timeLeft = 60;
let timerId = null;
let hasStarted = false;

function setAuthMessage(message, success = false) {
  authMessageEl.textContent = message;
  authMessageEl.classList.toggle("success", success);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function updateTimerDisplay() {
  timerEl.textContent = `${timeLeft}s`;
}

function renderText() {
  sampleTextEl.innerHTML = "";
  for (const char of selectedText) {
    const span = document.createElement("span");
    span.textContent = char;
    sampleTextEl.appendChild(span);
  }
  const firstChar = sampleTextEl.querySelector("span");
  if (firstChar) firstChar.classList.add("current");
}

function stopTest() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  timeLeft = Math.max(timeLeft, 0);
  updateTimerDisplay();
  typingInputEl.disabled = true;
  difficultyEl.disabled = false;
  testTimeEl.disabled = false;
}

function tickTimer() {
  timeLeft -= 1;
  updateTimerDisplay();
  if (timeLeft <= 0) stopTest();
}

function startTest() {
  if (hasStarted) return;
  hasStarted = true;
  difficultyEl.disabled = true;
  testTimeEl.disabled = true;
  timerId = setInterval(tickTimer, 1000);
}

function calculateMetrics(typedText) {
  const elapsedSeconds = testDurationSeconds - timeLeft;
  const elapsedMinutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
  let correctChars = 0;

  const allSpans = sampleTextEl.querySelectorAll("span");
  allSpans.forEach((span, index) => {
    const typedChar = typedText[index];
    span.classList.remove("correct", "incorrect", "current");

    if (typedChar == null) {
      if (index === typedText.length) span.classList.add("current");
      return;
    }

    if (typedChar === span.textContent) {
      span.classList.add("correct");
      correctChars += 1;
    } else {
      span.classList.add("incorrect");
    }

    if (index === typedText.length) span.classList.add("current");
  });

  const typedChars = typedText.length;
  const accuracy = typedChars > 0 ? (correctChars / typedChars) * 100 : 100;
  const wpm = elapsedMinutes > 0 ? Math.round(correctChars / 5 / elapsedMinutes) : 0;

  accuracyEl.textContent = `${Math.max(0, Math.round(accuracy))}%`;
  wpmEl.textContent = String(Math.max(0, wpm));

  if (typedText.length >= selectedText.length) stopTest();
}

async function resetTest() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  testDurationSeconds = Number(testTimeEl.value);
  if (!Number.isFinite(testDurationSeconds) || testDurationSeconds < 15) testDurationSeconds = 15;
  if (testDurationSeconds > 300) testDurationSeconds = 300;
  testTimeEl.value = String(testDurationSeconds);

  const difficulty = difficultyEl.value;
  const textData = await api(`/api/text?difficulty=${encodeURIComponent(difficulty)}`);
  selectedText = textData.text;

  timeLeft = testDurationSeconds;
  hasStarted = false;
  typingInputEl.value = "";
  typingInputEl.disabled = false;
  difficultyEl.disabled = false;
  testTimeEl.disabled = false;
  wpmEl.textContent = "0";
  accuracyEl.textContent = "100%";
  updateTimerDisplay();
  renderText();
  typingInputEl.focus();
}

async function refreshAuthState() {
  try {
    const data = await api("/api/me", { method: "GET" });
    if (data.logged_in) {
      authSectionEl.classList.add("hidden");
      typingSectionEl.classList.remove("hidden");
      welcomeEl.textContent = `Logged in as ${data.username}`;
      await resetTest();
    } else {
      typingSectionEl.classList.add("hidden");
      authSectionEl.classList.remove("hidden");
      setAuthMessage("");
    }
  } catch {
    setAuthMessage("Failed to load session.");
  }
}

registerFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;

  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setAuthMessage(data.message + " You can now login.", true);
    registerFormEl.reset();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    loginFormEl.reset();
    setAuthMessage("");
    await refreshAuthState();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

logoutBtnEl.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  await refreshAuthState();
});

typingInputEl.addEventListener("input", () => {
  if (!hasStarted && typingInputEl.value.length > 0) startTest();
  calculateMetrics(typingInputEl.value);
});

resetBtn.addEventListener("click", async () => {
  try {
    await resetTest();
  } catch (error) {
    alert(error.message);
  }
});

refreshAuthState();
