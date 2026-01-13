use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
mod game;
mod models;

use models::GameState;

static mut GAME: Option<GameState> = None;

#[wasm_bindgen]
pub fn new_game() {
    unsafe {
        GAME = Some(game::new_game());
    }
}

#[wasm_bindgen]
pub fn update(dt: f32) {
    unsafe {
        if let Some(ref mut g) = GAME {
            game::update(g, dt);
        }
    }
}

#[wasm_bindgen]
pub fn tap() {
    unsafe {
        if let Some(ref mut g) = GAME {
            game::tap(g);
        }
    }
}

#[wasm_bindgen]
pub fn get_state() -> JsValue {
    unsafe {
        serde_wasm_bindgen::to_value(GAME.as_ref().unwrap()).unwrap()
    }
}
