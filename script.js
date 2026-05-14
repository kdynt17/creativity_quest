const weights = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  weight: 10,
  zone: "bank",
}));

const hints = [
  "처음에는 3개와 3개를 비교해 보자. 어느 쪽이 가벼우면 그 3개 안에 정답이 있다.",
  "3개와 3개가 같다면 남은 2개 중 하나가 가벼운 추다.",
  "후보가 3개라면 1개와 1개를 비교하자. 같으면 남은 1개가 정답이다.",
  "후보가 2개라면 1개와 1개를 비교하면 바로 결정된다.",
];

const zones = Array.from(document.querySelectorAll("[data-zone]"));
const scaleWrap = document.querySelector(".scale-wrap");
const resultCard = document.querySelector("#resultCard");
const usesLeft = document.querySelector("#usesLeft");
const weighButton = document.querySelector("#weighButton");
const answerButton = document.querySelector("#answerButton");
const restartButton = document.querySelector("#restartButton");
const hintButton = document.querySelector("#hintButton");
const hintList = document.querySelector("#hintList");
const toast = document.querySelector("#toast");
const confettiCanvas = document.querySelector("#confetti");
const confettiContext = confettiCanvas.getContext("2d");

let secretId = 1;
let weighCount = 0;
let revealedHints = 0;
let gameOver = false;
let dragged = null;
let confettiPieces = [];
let confettiFrame = 0;

function startGame() {
  secretId = Math.floor(Math.random() * 8) + 1;
  weighCount = 0;
  revealedHints = 0;
  gameOver = false;
  weights.forEach((weight) => {
    weight.zone = "bank";
    weight.weight = weight.id === secretId ? 9 : 10;
  });
  renderWeights();
  renderHints();
  resetScaleTilt();
  updateUses();
  resultCard.textContent = "먼저 같은 개수의 추를 양쪽 접시에 올려 보자.";
  weighButton.disabled = false;
  answerButton.disabled = false;
  showToast("새 문제가 시작됐다. 이번에도 3번 안에 찾을 수 있다.");
}

function renderWeights() {
  document.querySelectorAll(".weight").forEach((element) => element.remove());
  weights.forEach((weight) => {
    const element = document.createElement("div");
    element.className = "weight";
    element.draggable = false;
    element.dataset.id = weight.id;
    element.textContent = weight.id;
    element.addEventListener("pointerdown", beginDrag);
    document.querySelector(`[data-zone="${weight.zone}"]`).appendChild(element);
  });
}

function renderHints() {
  hintList.innerHTML = "";
  hints.slice(0, revealedHints).forEach((hint) => {
    const item = document.createElement("li");
    item.textContent = hint;
    hintList.appendChild(item);
  });
  if (revealedHints === 0) {
    const item = document.createElement("li");
    item.textContent = "막히면 힌트를 열어 보자. 틀릴 때마다 힌트가 하나씩 추가된다.";
    hintList.appendChild(item);
  }
}

function updateUses() {
  usesLeft.textContent = Math.max(0, 3 - weighCount);
  weighButton.disabled = gameOver || weighCount >= 3;
}

function beginDrag(event) {
  if (gameOver) return;
  resetScaleTilt();
  const element = event.currentTarget;
  const id = Number(element.dataset.id);
  dragged = { element, id };
  element.classList.add("dragging");
  moveDrag(event);
  element.setPointerCapture(event.pointerId);
  element.addEventListener("pointermove", moveDrag);
  element.addEventListener("pointerup", endDrag, { once: true });
  element.addEventListener("pointercancel", endDrag, { once: true });
}

function moveDrag(event) {
  if (!dragged) return;
  dragged.element.style.left = `${event.clientX}px`;
  dragged.element.style.top = `${event.clientY}px`;
}

function endDrag(event) {
  if (!dragged) return;
  const target = findDropZone(event.clientX, event.clientY);
  const weight = weights.find((item) => item.id === dragged.id);
  weight.zone = target || "bank";
  dragged.element.classList.remove("dragging");
  dragged.element.style.left = "";
  dragged.element.style.top = "";
  dragged.element.removeEventListener("pointermove", moveDrag);
  dragged = null;
  renderWeights();
  resultCard.textContent = "추를 다시 배치했다. 측정을 눌러 저울의 기울기를 확인하자.";
}

function findDropZone(x, y) {
  const target = zones.find((zone) => {
    const rect = zone.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  return target?.dataset.zone;
}

function getWeightsIn(zone) {
  return weights.filter((weight) => weight.zone === zone);
}

function resetScaleTilt() {
  scaleWrap.classList.remove("tilt-left-light", "tilt-right-light");
}

function tiltScale(direction) {
  resetScaleTilt();
  scaleWrap.classList.add(direction);
}

function weigh() {
  if (gameOver || weighCount >= 3) return;
  const left = getWeightsIn("left");
  const right = getWeightsIn("right");
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    revealHint();
    showToast("양쪽 접시에 같은 개수의 추를 올려야 한다.");
    return;
  }

  weighCount += 1;
  const leftSum = left.reduce((sum, weight) => sum + weight.weight, 0);
  const rightSum = right.reduce((sum, weight) => sum + weight.weight, 0);

  if (leftSum < rightSum) {
    tiltScale("tilt-left-light");
    resultCard.textContent = "저울이 기울었다. 올라간 접시에 있는 추를 후보로 생각해 보자.";
  } else if (rightSum < leftSum) {
    tiltScale("tilt-right-light");
    resultCard.textContent = "저울이 기울었다. 올라간 접시에 있는 추를 후보로 생각해 보자.";
  } else {
    resetScaleTilt();
    resultCard.textContent = "저울이 수평이다. 저울에 올리지 않은 추 중에서 후보를 찾아보자.";
  }

  updateUses();
  if (weighCount >= 3) {
    showToast("저울을 3번 모두 사용했다. 이제 정답을 골라야 한다.");
  }
}

function checkAnswer() {
  if (gameOver) return;
  const answer = getWeightsIn("answer");
  if (answer.length !== 1) {
    revealHint();
    showToast("정답 칸에는 추 1개만 놓아야 한다.");
    return;
  }

  if (answer[0].id === secretId) {
    gameOver = true;
    resultCard.textContent = `정답! ${secretId}번 추가 가벼운 추였다.`;
    showToast("정답! 축하합니다!");
    launchConfetti();
  } else {
    gameOver = true;
    revealHint();
    resultCard.textContent = `오답. ${answer[0].id}번은 가벼운 추가 아니다. 재시작해서 다시 도전하자.`;
    showToast("오답입니다. 재시작 버튼을 눌러 다시 해보자.");
  }
  weighButton.disabled = true;
  answerButton.disabled = true;
}

function revealHint() {
  if (revealedHints < hints.length) {
    revealedHints += 1;
    renderHints();
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function launchConfetti() {
  resizeConfetti();
  confettiPieces = Array.from({ length: 180 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * confettiCanvas.height * 0.45,
    size: 7 + Math.random() * 9,
    speed: 2.5 + Math.random() * 5,
    sway: -2 + Math.random() * 4,
    rotate: Math.random() * Math.PI,
    color: ["#e63922", "#1ca6a5", "#e9d072", "#ffffff", "#7ac66a"][Math.floor(Math.random() * 5)],
  }));
  window.cancelAnimationFrame(confettiFrame);
  animateConfetti();
}

function animateConfetti() {
  confettiContext.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach((piece) => {
    piece.y += piece.speed;
    piece.x += piece.sway + Math.sin(piece.y / 26);
    piece.rotate += 0.08;
    confettiContext.save();
    confettiContext.translate(piece.x, piece.y);
    confettiContext.rotate(piece.rotate);
    confettiContext.fillStyle = piece.color;
    confettiContext.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.62);
    confettiContext.restore();
  });
  confettiPieces = confettiPieces.filter((piece) => piece.y < confettiCanvas.height + 40);
  if (confettiPieces.length > 0) {
    confettiFrame = window.requestAnimationFrame(animateConfetti);
  } else {
    confettiContext.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

weighButton.addEventListener("click", weigh);
answerButton.addEventListener("click", checkAnswer);
restartButton.addEventListener("click", startGame);
hintButton.addEventListener("click", revealHint);
window.addEventListener("resize", resizeConfetti);

startGame();
