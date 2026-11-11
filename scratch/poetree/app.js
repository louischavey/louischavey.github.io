import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs";

const CORE_URL = "https://raw.githubusercontent.com/louischavey/poetree/master/poetree_core.py";
const STORAGE_KEY = "louis-chavey-poetree-garden-v1";
const PLANTING_BOUNDS = { left: 0.1, top: 0.18, right: 0.9, bottom: 0.9 };
const canvas = document.querySelector("#garden");
const context = canvas.getContext("2d");
const wordsField = document.querySelector("#words");
const growButton = document.querySelector("#grow");
const undoButton = document.querySelector("#undo");
const resetButton = document.querySelector("#reset");
const status = document.querySelector("#status");
const gardenList = document.querySelector("#garden-list");

let pyodide;
let garden = loadGarden();
let plantStates = [];
let selectedId = null;
let pendingRoot = null;
let ready = false;

function loadGarden() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(validPlant) : [];
  } catch {
    return [];
  }
}

function validPlant(plant) {
  return plant && typeof plant.id === "string" && typeof plant.x === "number" && typeof plant.y === "number"
    && ["flower", "conifer", "fern"].includes(plant.kind) && Number.isInteger(plant.seed)
    && Array.isArray(plant.submissions) && plant.submissions.every((entry) => typeof entry === "string");
}

function saveGarden() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(garden));
}

function setStatus(message) {
  status.textContent = message;
}

function setReady(value) {
  ready = value;
  wordsField.disabled = !value;
  growButton.disabled = !value;
  undoButton.disabled = !value || !selectedId;
  resetButton.disabled = !value || !garden.length;
}

function currentKind() {
  return document.querySelector("input[name=plant-type]:checked").value;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

async function growStates() {
  pyodide.globals.set("poetreeGarden", JSON.stringify(garden));
  await pyodide.runPythonAsync(`
import json
from poetree_core import Session
records = json.loads(poetreeGarden)
rendered = []
for record in records:
    session = Session(record["kind"], record["seed"], max_submission_words=100)
    for submission in record["submissions"]:
        session.add(submission)
    rendered.append(session.state())
poetreeResult = json.dumps(rendered)
  `);
  plantStates = JSON.parse(pyodide.globals.get("poetreeResult"));
}

async function refresh() {
  if (!pyodide) return;
  try {
    await growStates();
    saveGarden();
    draw();
    updateReading();
    setReady(true);
  } catch (error) {
    setStatus(error.message || "Poetree could not grow those words.");
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return rect;
}

function draw() {
  const rect = resizeCanvas();
  context.clearRect(0, 0, rect.width, rect.height);
  drawGround(rect);
  plantStates.forEach((state, index) => drawPlant(state, garden[index], rect));
  if (pendingRoot) {
    context.save();
    context.strokeStyle = "#fbf9ef";
    context.setLineDash([5, 5]);
    context.lineWidth = 2;
    context.beginPath();
    context.arc(pendingRoot.x * rect.width, pendingRoot.y * rect.height, 15, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function drawGround(rect) {
  context.save();
  context.fillStyle = "#9daf82";
  context.fillRect(0, 0, rect.width, rect.height);
  context.strokeStyle = "rgba(255, 253, 246, .45)";
  context.setLineDash([7, 7]);
  context.strokeRect(PLANTING_BOUNDS.left * rect.width, PLANTING_BOUNDS.top * rect.height,
    (PLANTING_BOUNDS.right - PLANTING_BOUNDS.left) * rect.width,
    (PLANTING_BOUNDS.bottom - PLANTING_BOUNDS.top) * rect.height);
  context.restore();
}

function drawPlant(state, plant, rect) {
  const rootX = plant.x * rect.width;
  const rootY = plant.y * rect.height;
  const densityScale = Math.max(0.2, Math.min(0.8, 1 / Math.sqrt(1 + state.words.length / 10)));
  const turtle = { x: rootX, y: rootY, angle: -Math.PI / 2 };
  const stack = [];
  context.save();
  context.strokeStyle = "rgba(28, 47, 37, .7)";
  context.fillStyle = "#172c20";
  context.lineWidth = Math.max(1, 1.4 * densityScale);
  context.font = `${Math.max(11, 17 * densityScale)}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const [operation, args] of state.tape) {
    if (operation === "[") {
      stack.push({ ...turtle });
    } else if (operation === "]") {
      Object.assign(turtle, stack.pop() || turtle);
    } else if (operation === "T") {
      turtle.angle += args[0] * Math.PI / 180;
    } else if (operation === "F") {
      const word = state.words[args[0]] || "";
      const distance = Math.min(180, 22 + context.measureText(word).width) * densityScale;
      const endX = turtle.x + Math.cos(turtle.angle) * distance;
      const endY = turtle.y + Math.sin(turtle.angle) * distance;
      context.beginPath();
      context.moveTo(turtle.x, turtle.y);
      context.lineTo(endX, endY);
      context.stroke();
      context.save();
      context.translate((turtle.x + endX) / 2, (turtle.y + endY) / 2);
      context.rotate(turtle.angle);
      context.fillText(word, 0, -5 * densityScale);
      context.restore();
      turtle.x = endX;
      turtle.y = endY;
    }
  }

  context.fillStyle = selectedId === plant.id ? "#f7f3e6" : "#172c20";
  context.beginPath();
  context.arc(rootX, rootY, selectedId === plant.id ? 7 : 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function updateReading() {
  if (!garden.length) {
    gardenList.textContent = "No plants yet.";
    return;
  }
  gardenList.textContent = garden.map((plant, index) => {
    const words = plantStates[index]?.words || [];
    return `${plant.kind}: ${words.join(" ") || "not yet grown"}`;
  }).join(" · ");
}

function normalizedPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

function nearestPlant(point) {
  const rect = canvas.getBoundingClientRect();
  const radius = Math.max(24 / Math.min(rect.width, rect.height), 0.04);
  return garden.find((plant) => Math.hypot(plant.x - point.x, plant.y - point.y) < radius);
}

canvas.addEventListener("click", (event) => {
  if (!ready) return;
  const point = normalizedPoint(event);
  const nearby = nearestPlant(point);
  if (nearby) {
    selectedId = nearby.id;
    pendingRoot = null;
    setStatus(`Selected ${nearby.kind}. Add up to 100 words, then grow.`);
  } else if (point.x >= PLANTING_BOUNDS.left && point.x <= PLANTING_BOUNDS.right && point.y >= PLANTING_BOUNDS.top && point.y <= PLANTING_BOUNDS.bottom) {
    selectedId = null;
    pendingRoot = point;
    setStatus("New root selected. Choose a type, add up to 100 words, then grow.");
  } else {
    setStatus("Choose a spot inside the pale planting border.");
  }
  setReady(true);
  draw();
});

growButton.addEventListener("click", async () => {
  const text = wordsField.value.trim();
  if (!text) return setStatus("Enter words before growing.");
  const count = text.split(/\s+/).length;
  if (count > 100) return setStatus("Please add at most 100 words at a time.");
  if (selectedId) {
    const plant = garden.find((item) => item.id === selectedId);
    plant.submissions.push(text);
    setStatus(`Watered the ${plant.kind}.`);
  } else if (pendingRoot) {
    const plant = { id: uuid(), x: pendingRoot.x, y: pendingRoot.y, kind: currentKind(), seed: randomSeed(), submissions: [text] };
    garden.push(plant);
    selectedId = plant.id;
    pendingRoot = null;
    setStatus(`Planted a ${plant.kind}.`);
  } else {
    return setStatus("Click an empty place or an existing root first.");
  }
  wordsField.value = "";
  setReady(false);
  await refresh();
});

undoButton.addEventListener("click", async () => {
  const plant = garden.find((item) => item.id === selectedId);
  if (!plant) return;
  plant.submissions.pop();
  if (!plant.submissions.length) {
    garden = garden.filter((item) => item.id !== plant.id);
    selectedId = null;
    setStatus("Removed the new plant.");
  } else {
    setStatus(`Removed the latest growth from the ${plant.kind}.`);
  }
  setReady(false);
  await refresh();
});

resetButton.addEventListener("click", () => {
  if (!confirm("Clear this browser's Poetree garden?")) return;
  garden = [];
  plantStates = [];
  selectedId = null;
  pendingRoot = null;
  saveGarden();
  setStatus("Garden cleared.");
  setReady(true);
  draw();
  updateReading();
});

window.addEventListener("resize", draw);

async function boot() {
  try {
    pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/" });
    const response = await fetch(CORE_URL);
    if (!response.ok) throw new Error("The Poetree growth core could not be loaded.");
    pyodide.FS.writeFile("poetree_core.py", await response.text());
    await pyodide.runPythonAsync("from poetree_core import Session");
    ready = true;
    await refresh();
    setStatus(garden.length ? "Your saved garden is ready." : "Choose a place in the garden to begin.");
  } catch (error) {
    setStatus(error.message || "Poetree could not start. Please reload the page.");
  }
}

draw();
boot();
