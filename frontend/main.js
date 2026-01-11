import init, { greet } from "./wasm/lockrush_engine.js";

async function run() {
    await init();
    const msg = greet();
    document.getElementById("output").innerText = msg;
}

run();
