use axum::{
    routing::{get, post},
    Json, Router, Extension,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_http::cors::{CorsLayer, Any};
use std::env;
use dotenvy::dotenv;

#[derive(Deserialize)]
struct SubmitScore {
    name: String,
    email: String,
    score: i32,
    time: f32,
}

#[derive(Serialize)]
struct ScoreRow {
    name: String,
    email: String,
    score: i32,
    time: f32,
}

async fn submit_score(
    Extension(pool): Extension<PgPool>,
    Json(data): Json<SubmitScore>,
) {
    sqlx::query!(
        "
        INSERT INTO scores (name, email, score, time)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email)
        DO UPDATE SET
            name = EXCLUDED.name,
            score = EXCLUDED.score,
            time = EXCLUDED.time
        WHERE
            EXCLUDED.score > scores.score
            OR (EXCLUDED.score = scores.score AND EXCLUDED.time < scores.time)
        ",
        data.name,
        data.email,
        data.score,
        data.time
    )
    .execute(&pool)
    .await
    .unwrap();

}

async fn leaderboard(
    Extension(pool): Extension<PgPool>,
) -> Json<Vec<ScoreRow>> {
    let rows = sqlx::query_as!(
        ScoreRow,
        "SELECT name, email, score, time FROM scores ORDER BY score DESC, time ASC LIMIT 10"
    )

    .fetch_all(&pool)
    .await
    .unwrap();

    Json(rows)
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL not set");
    let pool = PgPool::connect(&db_url).await.unwrap();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/submit-score", post(submit_score))
        .route("/leaderboard", get(leaderboard))
        .layer(Extension(pool))
        .layer(cors);

    axum::Server::bind(&"0.0.0.0:3001".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
