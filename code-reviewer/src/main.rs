mod models;
mod vllm;
mod reviewer;
mod api;

use axum::Router;
use tower_http::cors::{CorsLayer, Any};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(api::routes())
        .layer(cors);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);

    println!("🚀 AI Code Reviewer API");
    println!("📡 Listening on http://{}", addr);
    println!("🔗 vLLM at {}", std::env::var("VLLM_BASE_URL")
        .unwrap_or_else(|_| "http://192.168.4.249:8000".to_string()));

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
