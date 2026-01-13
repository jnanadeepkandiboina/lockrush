use axum::{
    http::StatusCode,
    response::IntoResponse,
    Extension, Json, Router,
    routing::{get, post},
};
use dotenvy::dotenv;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use tower_http::cors::{Any, CorsLayer};

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

async fn submit_score(Extension(pool): Extension<PgPool>, Json(data): Json<SubmitScore>) -> impl IntoResponse {
    let result = sqlx::query!(
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
    .await;

    match result {
        Ok(_) => StatusCode::CREATED,
        Err(e) => {
            eprintln!("Failed to submit score: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn leaderboard(Extension(pool): Extension<PgPool>) -> impl IntoResponse {
    let result = sqlx::query_as!(
        ScoreRow,
        "SELECT name, email, score, time FROM scores ORDER BY score DESC, time ASC LIMIT 10"
    )
    .fetch_all(&pool)
    .await;

    match result {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => {
            eprintln!("Failed to fetch leaderboard: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch leaderboard.").into_response()
        }
    }
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

    let port = std::env::var("PORT").unwrap_or("3001".to_string());
    let addr = format!("0.0.0.0:{}", port);

    axum::Server::bind(&addr.parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
