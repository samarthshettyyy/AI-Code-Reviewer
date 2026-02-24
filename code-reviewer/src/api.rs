use axum::{
    routing::{post, get},
    Router, Json,
    extract::Multipart,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::models::Severity;
use crate::vllm::VllmClient;
use crate::reviewer::CodeReviewer;

// ── Request / Response structs ─────────────────────────────────────

#[derive(Deserialize)]
pub struct ReviewByPathRequest {
    pub path: String,
    pub review_types: Option<Vec<String>>,
    pub custom_prompt: Option<String>,
}

#[derive(Serialize)]
pub struct ReviewResponse {
    pub project_name: String,
    pub files_reviewed: usize,
    pub files_skipped: usize,
    pub total_issues: usize,
    pub file_results: Vec<FileResult>,
    pub verdict: String,
}

#[derive(Serialize)]
pub struct FileResult {
    pub filename: String,
    pub skipped: bool,
    pub skip_reason: Option<String>,
    pub issues: Vec<IssueOut>,
    pub free_response: Option<String>,   // ← NEW
}

#[derive(Serialize)]
pub struct IssueOut {
    pub issue_type: String,
    pub severity: String,
    pub line: Option<u32>,
    pub description: String,
    pub suggestion: String,
}

// ── Routes ─────────────────────────────────────────────────────────

pub fn routes() -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/review/path", post(review_by_path))
        .route("/api/review/upload", post(review_by_upload))
}

// ── Handlers ───────────────────────────────────────────────────────

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "model": "codellama-13b-instruct" }))
}

async fn review_by_path(
    Json(body): Json<ReviewByPathRequest>,
) -> Result<Json<ReviewResponse>, (StatusCode, String)> {

    let path = Path::new(&body.path);
    if !path.exists() {
        return Err((StatusCode::BAD_REQUEST, format!("Path does not exist: {}", body.path)));
    }

    let project_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let review_types = body.review_types.unwrap_or_else(|| {
        vec!["bug".into(), "security".into(), "performance".into(), "style".into()]
    });

    let reviewer = CodeReviewer::new(make_vllm_client());
    let review = reviewer
        .review_project(path, &project_name, &review_types, body.custom_prompt.as_deref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(build_response(review)))
}

async fn review_by_upload(
    mut multipart: Multipart,
) -> Result<Json<ReviewResponse>, (StatusCode, String)> {

    let tmp_dir = std::env::temp_dir().join("code_review_upload");
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut review_types: Vec<String> = vec!["bug".into(), "security".into(), "performance".into(), "style".into()];
    let mut custom_prompt: Option<String> = None;

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name     = field.name().unwrap_or("").to_string();
        let filename = field.file_name().unwrap_or("file.rs").to_string();

        if name == "review_types" {
            let val = field.text().await.unwrap_or_default();
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&val) {
                review_types = parsed;
            }
            continue;
        }

        if name == "custom_prompt" {
            let val = field.text().await.unwrap_or_default();
            if !val.trim().is_empty() {
                custom_prompt = Some(val.trim().to_string());
            }
            continue;
        }

        let data = field.bytes().await
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
        std::fs::write(tmp_dir.join(&filename), &data)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    let reviewer = CodeReviewer::new(make_vllm_client());
    let review = reviewer
        .review_project(&tmp_dir, "uploaded_files", &review_types, custom_prompt.as_deref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    std::fs::remove_dir_all(&tmp_dir).ok();
    Ok(Json(build_response(review)))
}

// ── Helpers ────────────────────────────────────────────────────────

fn make_vllm_client() -> VllmClient {
    let url = std::env::var("VLLM_BASE_URL")
        .unwrap_or_else(|_| "http://192.168.4.249:8000".to_string());
    let model = std::env::var("VLLM_MODEL")
        .unwrap_or_else(|_| "codellama-13b-instruct".to_string());
    println!("🤖 Using vLLM model: {}", model);
    VllmClient::new(&url, &model)
}

fn build_response(review: crate::models::ProjectReview) -> ReviewResponse {
    let verdict = {
        let critical = review.issues_by_severity(&Severity::Critical).len();
        let high     = review.issues_by_severity(&Severity::High).len();
        let medium   = review.issues_by_severity(&Severity::Medium).len();
        if critical > 0    { "CRITICAL — Must fix before merge".to_string() }
        else if high > 0   { "HIGH — Fix recommended".to_string() }
        else if medium > 0 { "MEDIUM — Consider fixing".to_string() }
        else               { "LOOKS GOOD — No critical issues".to_string() }
    };

    let file_results = review.file_reviews.iter().map(|fr| FileResult {
        filename:      fr.filename.clone(),
        skipped:       fr.skipped,
        skip_reason:   fr.skip_reason.clone(),
        free_response: fr.free_response.clone(),   // ← NEW
        issues: fr.issues.iter().map(|i| IssueOut {
            issue_type:  format!("{:?}", i.issue_type).to_lowercase(),
            severity:    format!("{:?}", i.severity).to_lowercase(),
            line:        i.line,
            description: i.description.clone(),
            suggestion:  i.suggestion.clone(),
        }).collect(),
    }).collect();

    ReviewResponse {
        project_name:   review.project_name.clone(),
        files_reviewed: review.file_reviews.iter().filter(|f| !f.skipped).count(),
        files_skipped:  review.file_reviews.iter().filter(|f| f.skipped).count(),
        total_issues:   review.total_issues(),
        file_results,
        verdict,
    }
}
