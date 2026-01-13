use serde::Serialize;

#[derive(Serialize)]
pub struct GameState {
    pub angle: f32,
    pub speed: f32,
    pub dot_angle: f32,
    pub score: u32,
    pub lives: u8,
    pub hit_window: f32,
    pub time_alive: f32,
    pub game_over: bool,
}

