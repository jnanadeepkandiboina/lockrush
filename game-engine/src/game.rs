use crate::models::GameState;

pub fn new_game() -> GameState {
    GameState {
        angle: 0.0,
        speed: 2.5,
        dot_angle: rand_angle(),
        score: 0,
        lives: 3,
        hit_window: 0.25,
        time_alive: 0.0,
        game_over: false,
    }
}

pub fn update(state: &mut GameState, dt: f32) {
    if state.game_over {
        return;
    }

    state.time_alive += dt;
    state.angle += state.speed * dt;

    if state.angle > std::f32::consts::TAU {
        state.angle -= std::f32::consts::TAU;
    }
}

pub fn tap(state: &mut GameState) {

    let diff = (state.angle - state.dot_angle).abs();

    if diff < state.hit_window {

        state.score += 1;

        // speed curve
        const MAX_SPEED: f32 = 5.5;
        state.speed += 0.08 + (state.score as f32 * 0.0002);
        if state.speed > MAX_SPEED {
            state.speed = MAX_SPEED;
        }

        // shrink hit window (but never too small)
        state.hit_window *= 0.97;
        if state.hit_window < 0.05 {
            state.hit_window = 0.05;
        }

        state.dot_angle = rand_angle();

    } else {
        if state.lives > 0 {
            state.lives -= 1;
            if state.lives == 0 {
                state.game_over = true;
            }
        }
    }
}

fn rand_angle() -> f32 {
    (js_sys::Math::random() as f32) * std::f32::consts::TAU
}
