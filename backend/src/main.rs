use axum::{
    http::StatusCode,
    response::IntoResponse,
    Extension, Json, Router,
    routing::{get, post},
};
use dotenvy::dotenv;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::cors::{Any, CorsLayer};
use url::Url;

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

    if let Ok(url) = url::Url::parse(&db_url) {
        println!(
            "Attempting to connect to database. User: {:?}, Host: {:?}, Port: {:?}",
            url.username(),
            url.host_str(),
            url.port()
        );
    } else {
        println!("Failed to parse DATABASE_URL.");
    }

    let pool = {
        let mut pool = None;
        for i in 1..=5 {
            println!("Attempting to connect to Postgres... (Attempt {})", i);
            let conn_result = PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(10))
                .connect(&db_url)
                .await;

            match conn_result {
                Ok(p) => {
                    pool = Some(p);
                    println!("Successfully connected to Postgres.");
                    break;
                }
                Err(e) => {
                    eprintln!("Failed to connect on attempt {}: {}", i, e);
                    if i < 5 {
                        println!("Retrying in 5 seconds...");
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    }
                }
            }
        }
        pool.expect("Failed to connect to Postgres after 5 attempts")
    };

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
