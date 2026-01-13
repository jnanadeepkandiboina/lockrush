import init, { new_game, update, get_state, tap } from "./wasm/lockrush_engine.js";

const API = "http://localhost:3001";

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

function draw(state) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
    ctx.fillRect(0, 0, 500, 500);

    let ox = 0;
    let oy = 0;

    if (shake > 0) {
        ox = (Math.random() - 0.5) * shake;
        oy = (Math.random() - 0.5) * shake;
        shake *= 0.8;
    }

    const cx = 250 + ox;
    const cy = 250 + oy;
    const radius = 190;

    // Outer circle
    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 55, 0, Math.PI * 2);
    ctx.stroke();

    // Yellow dot
    const dx = cx + Math.cos(state.dot_angle) * (radius - 27);
    const dy = cy + Math.sin(state.dot_angle) * (radius - 27);

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(dx, dy, 22, 0, Math.PI * 2);
    ctx.fill();

    // Red bar
    const inner = radius - 55;
    const outer = radius;

    const x1 = cx + Math.cos(state.angle) * inner;
    const y1 = cy + Math.sin(state.angle) * inner;

    const x2 = cx + Math.cos(state.angle) * outer;
    const y2 = cy + Math.sin(state.angle) * outer;

    ctx.strokeStyle = "red";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Best Score
    ctx.font = "22px Arial";
    ctx.textAlign = "left";
    ctx.fillText("BEST: " + bestScore, 20, 40);

    // Score
    ctx.fillStyle = "white";
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.fillText(state.score, cx, cy + 20);

    // Lives
    ctx.font = "24px Arial";
    ctx.textAlign = "right";
    ctx.fillText("♥".repeat(state.lives), 480, 40);

    if (missFlash > 0) {
        ctx.fillStyle = `rgba(255,0,0,${missFlash * 0.25})`;
        ctx.fillRect(0, 0, 500, 500);
        missFlash *= 0.8;
    }
}



function loop(time) {

    if (uiState !== "playing") return;
    const dt = (time - last) / 1000;
    last = time;

    update(dt);
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
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0,0,500,500);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";

    ctx.font = "40px Arial";
    ctx.fillText("GAME OVER", 250, 200);

    const rank = lastRank;

    ctx.font = "30px Arial";
    ctx.fillText("Score: " + state.score, 250, 250);
    ctx.fillText("Rank: #" + rank, 250, 290);

    ctx.fillText("Press L for Leaderboard", 250, 360);

    ctx.font = "20px Arial";
    ctx.fillText("Click or Press Space to Replay", 250, 320);
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

    fetch("${API}/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: player.name,
            email: player.email,
            score: state.score,
            time: state.time_alive
        })
    });

    fetch("${API}/leaderboard")
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
    const res = await fetch("${API}/leaderboard");
    const data = await res.json();

    const me = data.find(s => s.email === player.email);
    bestScore = me ? me.score : 0;
}


const leaderboard = document.getElementById("leaderboard");
const scoresDiv = document.getElementById("scores");
const backBtn = document.getElementById("back");

async function showLeaderboard() {
    uiState = "leaderboard";

    const res = await fetch("${API}/leaderboard");
    const data = await res.json();

    scoresDiv.innerHTML = "";
    data.forEach((s, i) => {
        scoresDiv.innerHTML += `<p>#${i+1} ${s.name} — ${s.score}</p>`;
    });

    leaderboard.style.display = "block";
    canvas.style.display = "none";
}

backBtn.onclick = (e) => {
    e.stopPropagation();
    leaderboard.style.display = "none";
    canvas.style.display = "block";
    uiState = "gameover";
    drawGameOver(get_state());
};



async function run() {
    await init();
    new_game();
    requestAnimationFrame(loop);
}

if (player) {
    login.style.display = "none";
    game.style.display = "block";
    fetchBestScore();
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
    requestAnimationFrame(loop);

    fetchBestScore();
};


run();

window.addEventListener("keydown", e => {
    if (uiState === "login") return;
    if (uiState === "leaderboard") return;
    if (e.code === "Space") {
        const s = get_state();
        if (s.game_over) {
            uiState = "playing";
            new_game();
            saved = false;
            last = performance.now();
            requestAnimationFrame(loop);
        } else {
            tap();
        }
    }
});

window.addEventListener("click", () => {
    if (uiState === "login") return;
    if (uiState === "leaderboard") return;
    const s = get_state();
    if (s.game_over) {
        uiState = "playing";
        new_game();
        saved = false;
        last = performance.now();
        requestAnimationFrame(loop);
    } else {
        tap();
    }
});

window.addEventListener("keydown", e => {
  if (e.code === "KeyL" && uiState === "gameover") {
    showLeaderboard();
  }
});