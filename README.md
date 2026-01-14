# 🎮 LOCKRUSH

LOCKRUSH is a **timing-based arcade game** inspired by games like *Pop the Lock*, built from scratch using **Rust, WebAssembly, Canvas, Axum, and PostgreSQL**.

The goal is simple but challenging:
> Tap at the exact moment when the rotating red bar aligns with the yellow dot.

The game continues until all lives are lost.  
Scores are ranked globally with server-side validation to prevent cheating.

---

## ✨ Features

- 🟡 Reflex-based arcade gameplay
- ❤️ 3 lives per run
- ⚡ Increasing difficulty (speed scaling with score)
- ⏸ Pause support
- 🏆 Global Top-10 leaderboard
- 🔐 Server-verified scores (anti-cheat)
- 🌍 Deployed frontend + backend
- 🦀 Core game engine written in Rust
- 🌐 WebAssembly-powered frontend

---

## 🧠 Architecture Overview



Frontend (HTML + Canvas + JS)
|
| (WASM bindings)
v
Rust Game Engine (Shared)
|
| (verified score submission)
v
Rust Backend (Axum)
|
v
PostgreSQL (Leaderboard)


- **Same game engine logic** runs in both browser (WASM) and server (Rust)
- Backend only stores **best score per player**
- Ranking is calculated using:
  - Higher score first
  - Faster time as tie-breaker

---

## 🛠 Tech Stack

### Frontend
- HTML5 Canvas
- JavaScript
- WebAssembly (wasm-bindgen)

### Backend
- Rust
- Axum
- SQLx
- PostgreSQL

### Deployment
- Frontend: Vercel
- Backend + DB: Railway

---

## 🎯 How to Play

- **Click / Space** → Tap
- **Pause button** → Pause / Resume
- **Game Over**
  - Space / Click → Replay
  - `L` → View Leaderboard

---

## 🚀 Run Locally

### 1️⃣ Prerequisites

Make sure you have:

- Rust (stable)
- Node.js
- PostgreSQL
- wasm-pack
- sqlx-cli

```bash
cargo install wasm-pack
cargo install sqlx-cli


### 2️⃣ Clone the Repository

git clone https://github.com/jnanadeepkandiboina/lockrush.git
cd lockrush

### 3️⃣ Setup Database
CREATE DATABASE lockrush;
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  score INT NOT NULL,
  time REAL NOT NULL
);

###4️⃣ Backend Setup

cd backend

Create .env:  ex: (DATABASE_URL=postgres://<user>:<password>@localhost/lockrush)

cargo sqlx prepare
cargo run

Backend runs on: http://localhost:3001

###5️⃣ Build WASM Game Engine

cd game-engine
wasm-pack build --target web
 -> This generates the WASM files used by the frontend.

###6️⃣ Run Frontend
cd frontend
npx serve .

Open in browser: http://localhost:3000
