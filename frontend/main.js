import init, { new_game, update, get_state, tap } from "./wasm/lockrush_engine.js";

const API = "https://lockrush-production.up.railway.app";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const login = document.getElementById("login");
const game = document.getElementById("game");
const startBtn = document.getElementById("start");

let player = JSON.parse(localStorage.getItem("lockrush_player"));

let last = 0;
let prevScore = 0;
let prevLives = 3;
let bestScore = 0;
let uiState = player ? "playing" : "login";
let lastRank = "?";

let missFlash = 0;
let shake = 0;
let saved = false;

function resize() {
    // Determine the smaller dimension of the viewport
    const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9);
    canvas.width = size;
    canvas.height = size;

    // Redraw the game if it's active
    if (uiState === "playing" || uiState === "gameover") {
        const state = get_state();
        draw(state);
        if (uiState === "gameover") {
            drawGameOver(state);
        }
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
    const radius = w * 0.38; // 190 / 500

    // Outer circle
    ctx.strokeStyle = "white";
    ctx.lineWidth = w * 0.01; // 5 / 500
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius - w * 0.11, 0, Math.PI * 2); // 55 / 500
    ctx.stroke();

    // Yellow dot
    const dx = cx + Math.cos(state.dot_angle) * (radius - w * 0.054); // 27 / 500
    const dy = cy + Math.sin(state.dot_angle) * (radius - w * 0.054);

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(dx, dy, w * 0.044, 0, Math.PI * 2); // 22 / 500
    ctx.fill();

    // Red bar
    const inner = radius - w * 0.11; // 55 / 500
    const outer = radius;

    const x1 = cx + Math.cos(state.angle) * inner;
    const y1 = cy + Math.sin(state.angle) * inner;

    const x2 = cx + Math.cos(state.angle) * outer;
    const y2 = cy + Math.sin(state.angle) * outer;

    ctx.strokeStyle = "red";
    ctx.lineWidth = w * 0.016; // 8 / 500
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Best Score
    ctx.fillStyle = "white";
    ctx.font = `${w * 0.044}px Arial`; // 22 / 500
    ctx.textAlign = "left";
    ctx.fillText("BEST: " + bestScore, w * 0.04, h * 0.08); // 20/500, 40/500

    // Score
    ctx.fillStyle = "white";
    ctx.font = `${w * 0.12}px Arial`; // 60 / 500
    ctx.textAlign = "center";
    ctx.fillText(state.score, cx, cy + h * 0.04);

    // Lives
    ctx.font = `${w * 0.048}px Arial`; // 24 / 500
    ctx.textAlign = "right";
    ctx.fillText("♥".repeat(state.lives), w * 0.96, h * 0.08); // 480/500, 40/500

    if (missFlash > 0) {
        ctx.fillStyle = `rgba(255,0,0,${missFlash * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        missFlash *= 0.8;
    }
}



function loop(time) {

    const state = get_state();

    if (state.game_over) {
        uiState = "gameover";
        if (!saved) {
            saveScore(state);
            saved = true;
        }
        draw(state);
        drawGameOver(state);
        return;
    }

    if (uiState !== "playing") return;
    const dt = (time - last) / 1000;
    last = time;

    update(dt);


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

function drawGameOver(state) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0,0,w,h);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";

    ctx.font = `${w * 0.08}px Arial`; // 40 / 500
    ctx.fillText("GAME OVER", w/2, h * 0.4);

    const rank = lastRank;

    ctx.font = `${w * 0.06}px Arial`; // 30 / 500
    ctx.fillText("Score: " + state.score, w/2, h * 0.5);
    ctx.fillText("Rank: #" + rank, w/2, h * 0.58);

    ctx.font = `${w * 0.04}px Arial`; // 20 / 500
    ctx.fillText("Click or Press Space to Replay", w/2, h * 0.64);
    
    ctx.font = `${w * 0.05}px Arial`; // 25 / 500
    ctx.fillText("Press L for Leaderboard", w/2, h * 0.72);
}

function saveScore(state) {
    let list = JSON.parse(localStorage.getItem("lockrush_scores") || "[]");

    list.push({
        name: player.name,
        email: player.email,
        score: state.score,
        time: state.time_alive
    });

    list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time;
    });

    list = list.slice(0, 10); // keep top 10

    localStorage.setItem("lockrush_scores", JSON.stringify(list));

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
        let rank = 1;
        for (const s of data) {
            if (
                s.score > state.score ||
                (s.score === state.score && s.time < state.time_alive)
            ) {
                rank++;
            }
        }
        lastRank = rank;

        // redraw game over once rank is ready
        if (uiState === "gameover") {
            draw(get_state());
            drawGameOver(get_state());
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


const leaderboard = document.getElementById("leaderboard");
const scoresDiv = document.getElementById("scores");
const backBtn = document.getElementById("back");

async function showLeaderboard() {
    uiState = "leaderboard";
    leaderboard.style.display = "block";
    canvas.style.display = "none";
    scoresDiv.innerHTML = "<p>Loading...</p>";

    try {
        const res = await fetch(`${API}/leaderboard`);
        const data = await res.json();

        if (uiState !== "leaderboard") return;

        scoresDiv.innerHTML = "";
        data.forEach((s, i) => {
            scoresDiv.innerHTML += `<p>#${i+1} ${s.name} — ${s.score}</p>`;
        });
    } catch(e) {
        if (uiState === "leaderboard") {
            scoresDiv.innerHTML = `<p style="color: red">Error loading scores</p>`;
        }
    }
}

backBtn.onclick = (e) => {
    e.stopPropagation();
    leaderboard.style.display = "none";
    canvas.style.display = "block";
    uiState = "gameover";
    // Need to redraw after showing canvas again
    resize();
};


async function run() {
    await init();
    
    // Setup event listeners
    window.addEventListener("keydown", e => {
        if (e.code === "Space") {
            handleInput();
        } else if (e.code === "KeyL" && uiState === "gameover") {
            showLeaderboard();
        }
    });
    window.addEventListener("click", handleInput);
    window.addEventListener("touchstart", handleInput);
    window.addEventListener('resize', resize);
    
    // Initial setup
    if (player) {
        login.style.display = "none";
        game.style.display = "block";
        fetchBestScore();
    } else {
        game.style.display = "none";
    }

    startBtn.onclick = () => {
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;

        if (!name || !email) return alert("Enter name and email");

        player = { name, email };
        localStorage.setItem("lockrush_player", JSON.stringify(player));

        login.style.display = "none";
        game.style.display = "block";
        uiState = "playing";

        last = performance.now();
        new_game(); // Start a new game
        requestAnimationFrame(loop);

        fetchBestScore();
    };
    
    new_game();
    // Set initial size and start loop
    resize();
    requestAnimationFrame(loop);
}

function handleInput(e) {
    // Prevent click from firing immediately after touch
    if (e) e.preventDefault();
    if (uiState === "login") return;
    if (uiState === "leaderboard") return;

    const s = get_state();

    if (uiState === "gameover") {
        uiState = "playing";
        new_game();
        saved = false;
        last = performance.now();
        // No need to call loop here, it's already running
        return;
    }

    tap();
}

run();
