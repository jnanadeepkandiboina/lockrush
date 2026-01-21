import init, { new_game, update, get_state, tap } from "./wasm/lockrush_engine.js";

const API = "https://lockrush-production.up.railway.app";

// UI Elements
const login = document.getElementById("login");
const gameContainer = document.getElementById("game-container");
const canvas = document.getElementById("game");
const gameOverUI = document.getElementById("game-over");
const startPanel = document.getElementById("start-panel");
const currentRankEl = document.getElementById("current-rank");
const bestRankEl = document.getElementById("best-rank");


// Buttons
const startBtn = document.getElementById("start");
const replayBtn = document.getElementById("replay-btn");
const leaderboardBtn = document.getElementById("leaderboard-btn");

// Game Over UI Text
const finalScoreEl = document.getElementById("final-score");
const finalRankEl = document.getElementById("final-rank");

const ctx = canvas.getContext("2d");

let player = JSON.parse(localStorage.getItem("lockrush_player"));

canvas.style.pointerEvents = "none";

// State
let last = 0;
let prevScore = 0;
let prevLives = 3;
let bestScore = 0;
let currentScore = 0;
let lastGameTime = 0;
let hasPlayed = false;
let uiState = player ? "pre-game" : "login";
let lastRank = "?";
let missFlash = 0;
let shake = 0;
let saved = false;
let tapCooldown = false;

function resize() {
    const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9);
    canvas.width = size;
    canvas.height = size;
    if (uiState === "playing" || uiState === "gameover" || uiState === "pre-game") {
        const state = get_state();
        draw(state);
    }
}

function draw(state) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
    ctx.fillRect(0, 0, w, h);
    let ox = 0;
    let oy = 0;
    if (shake > 0) {
        ox = (Math.random() - 0.5) * shake;
        oy = (Math.random() - 0.5) * shake;
        shake *= 0.8;
    }
    const cx = w / 2 + ox;
    const cy = h / 2 + oy;
    const radius = w * 0.38;
    ctx.strokeStyle = "white";
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - w * 0.11, 0, Math.PI * 2);
    ctx.stroke();
    const dx = cx + Math.cos(state.dot_angle) * (radius - w * 0.054);
    const dy = cy + Math.sin(state.dot_angle) * (radius - w * 0.054);
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(dx, dy, w * 0.044, 0, Math.PI * 2);
    ctx.fill();
    const inner = radius - w * 0.11;
    const outer = radius;
    const x1 = cx + Math.cos(state.angle) * inner;
    const y1 = cy + Math.sin(state.angle) * inner;
    const x2 = cx + Math.cos(state.angle) * outer;
    const y2 = cy + Math.sin(state.angle) * outer;
    ctx.strokeStyle = "red";
    ctx.lineWidth = w * 0.016;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = `${w * 0.044}px Arial`;
    ctx.textAlign = "left";
    ctx.fillText("BEST: " + bestScore, w * 0.04, h * 0.08);
    ctx.fillStyle = "white";
    ctx.font = `${w * 0.12}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(state.score, cx, cy + h * 0.04);
    ctx.font = `${w * 0.048}px Arial`;
    ctx.textAlign = "right";
    ctx.fillText("♥".repeat(state.lives), w * 0.96, h * 0.08);
    if (missFlash > 0) {
        ctx.fillStyle = `rgba(255,0,0,${missFlash * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        missFlash *= 0.8;
    }
}

function showGameOver(state) {
    uiState = "gameover";
    hasPlayed = true;
    currentScore = state.score;
    lastGameTime = state.time_alive;
    finalScoreEl.innerText = state.score;
    finalRankEl.innerText = "?"; // Placeholder
    gameOverUI.style.display = "flex";
    if (!saved) {
        saveScore(state);
        saved = true;
    }
}

function loop(time) {
    if (uiState !== "playing") return;
    
    const dt = (time - last) / 1000;
    last = time;

    update(dt);

    const state = get_state();

    if (state.game_over) {
        draw(state); // Draw final frame
        showGameOver(state);
        return; // Stop the loop
    }

    
    if (state.score > prevScore) {
        shake = 4;
    }
    if (state.lives < prevLives) {
        missFlash = 1;
        shake = 12;
    }
    prevScore = state.score;
    prevLives = state.lives;
    draw(state);
    requestAnimationFrame(loop);
}

function saveScore(state) {
    // ... (save to localStorage, same as before)
    fetch(`${API}/submit-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: player.name,
            email: player.email,
            score: state.score,
            time: state.time_alive
        })
    });

    fetch(`${API}/leaderboard`)
    .then(r => r.json())
    .then(data => {
        // ---- CURRENT SCORE RANK ----
        let currentRank = 1;
        for (const s of data) {
            if (
                s.score > state.score ||
                (s.score === state.score && s.time < state.time_alive)
            ) {
                currentRank++;
            }
        }

        // ---- BEST SCORE RANK ----
        const playerIndex = data.findIndex(s => s.email === player.email);
        const bestRank = playerIndex !== -1 ? playerIndex + 1 : "?";


        if (uiState === "gameover") {
            currentRankEl.innerText = currentRank;
            bestRankEl.innerText = bestRank;
        }
    });


    if (state.score > bestScore) {
        bestScore = state.score;
    }
}

async function fetchBestScore() {
    const res = await fetch(`${API}/leaderboard`);
    const data = await res.json();
    const me = data.find(s => s.email === player.email);
    bestScore = me ? me.score : 0;
}

const leaderboardUI = document.getElementById("leaderboard");
const scoresDiv = document.getElementById("scores");
const backBtn = document.getElementById("back");

async function showLeaderboard() {
    uiState = "leaderboard";
    leaderboardUI.style.display = "block";
    gameContainer.style.display = "none";
    gameOverUI.style.display = "none";
    scoresDiv.innerHTML = "<p>Loading...</p>";
    try {
        const res = await fetch(`${API}/leaderboard`);
        const data = await res.json();
        if (uiState !== "leaderboard") return;
        scoresDiv.innerHTML = "";

        const bestScoreEntry = data.find(s => s.email === player.email);
        const bestScoreValue = bestScoreEntry ? bestScoreEntry.score : 0;
        const isCurrentBest = hasPlayed && currentScore === bestScoreValue;

        let playerInTop10 = false;
        // Show top 10
        data.slice(0, 10).forEach((s, i) => {
            if (s.email === player.email) {
                playerInTop10 = true;
                const label = isCurrentBest ? "(best, current)" : "(best)";
                scoresDiv.innerHTML += `<p>#${i + 1} ${s.name} ${label} — ${s.score}</p>`;
            } else {
                scoresDiv.innerHTML += `<p>#${i + 1} ${s.name} — ${s.score}</p>`;
            }
        });

        // If player is not in top 10, find and show their rank
        if (!playerInTop10 && bestScoreEntry) {
            const playerIndex = data.findIndex(s => s.email === player.email);
            const label = isCurrentBest ? "(best, current)" : "(best)";
            scoresDiv.innerHTML += `<hr><p>#${playerIndex + 1} ${bestScoreEntry.name} ${label} — ${bestScoreEntry.score}</p>`;
        }

        // Show current score if it's NOT the best score.
        if (hasPlayed && !isCurrentBest) {
            let currentRank = 1;
            for (const s of data) {
                if (s.score > currentScore || (s.score === currentScore && s.time < lastGameTime)) {
                    currentRank++;
                }
            }
            scoresDiv.innerHTML += `<hr><p>#${currentRank} ${player.name} (current) — ${currentScore}</p>`;
        }
    } catch (e) {
        if (uiState === "leaderboard") {
            scoresDiv.innerHTML = `<p style="color: red">Error loading scores</p>`;
        }
    }
}

backBtn.onclick = (e) => {
    e.stopPropagation();
    leaderboardUI.style.display = "none";
    gameContainer.style.display = "block";
    gameOverUI.style.display = "flex"; // Show game over screen again
    uiState = "gameover";
};

function enterPreGame() {
    login.style.display = "none";
    gameContainer.style.display = "block";
    gameOverUI.style.display = "none";
    startPanel.style.display = "flex";
    uiState = "pre-game";
    new_game();
    const state = get_state();
    draw(state);
}

function startGame() {
    canvas.style.pointerEvents = "auto";
    startPanel.style.display = "none";
    gameOverUI.style.display = "none";
    uiState = "playing";
    saved = false;
    last = performance.now();
    requestAnimationFrame(loop);
}

function handleTap() {
    if (uiState === "pre-game") {
        startGame();
        return;
    }
    if (uiState !== "playing" || tapCooldown) return;
    tap();
    tapCooldown = true;
    setTimeout(() => {
        tapCooldown = false;
    }, 100);
}

async function run() {
    await init();
    
    // Setup event listeners
    window.addEventListener("pointerdown", (e) => {
        if (uiState !== "playing" && uiState !== "pre-game") return;
        // Only allow left click or finger
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        handleTap();
    }, { passive: false });
    
    window.addEventListener('resize', resize);
    window.addEventListener("keydown", (e) => {
        if (uiState !== "playing" && uiState !== "pre-game") return;
        if (e.code === "Space") {
            e.preventDefault();
            handleTap();
        }
    });
    
    startBtn.onclick = () => {
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        if (!name || !email) return alert("Enter name and email");
        player = { name, email };
        localStorage.setItem("lockrush_player", JSON.stringify(player));
        fetchBestScore();
        enterPreGame();
    };

    replayBtn.onclick = () => {
        new_game();
        startGame();
    };
    leaderboardBtn.onclick = showLeaderboard;

    // Initial UI setup
    if (player) {
        fetchBestScore().then(() => {
            enterPreGame();
            resize();
        });
    } else {
        gameContainer.style.display = "none";
        login.style.display = "flex";
    }
    
    resize();
}

run();