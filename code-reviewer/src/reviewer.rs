use std::path::{Path, PathBuf};
use anyhow::Result;
use walkdir::WalkDir;
use crate::models::{FileReview, ProjectReview};
use crate::vllm::VllmClient;

const REVIEW_EXTENSIONS: &[&str] = &[
    "rs", "py", "js", "jsx", "ts", "tsx",
    "c", "cpp", "h", "hpp", "cc",
    "go", "java", "rb", "php", "swift",
    "kt", "cs", "sh",
];
const SKIP_PATTERNS: &[&str] = &[
    "target/", ".git/", "build.rs",
    "tests/", "benches/", "examples/",
];

pub struct CodeReviewer {
    vllm: VllmClient,
}

impl CodeReviewer {
    pub fn new(vllm: VllmClient) -> Self {
        Self { vllm }
    }

    pub async fn review_project(
        &self,
        project_path: &Path,
        project_name: &str,
        review_types: &[String],
        custom_prompt: Option<&str>,
    ) -> Result<ProjectReview> {
        let files = self.collect_files(project_path);
        println!("\n📁 Found {} file(s) to review", files.len());
        if let Some(prompt) = custom_prompt {
            println!("💬 Custom prompt: {}\n", prompt);
        } else {
            println!("🔍 Focus: {}\n", review_types.join(", "));
        }

        let mut file_reviews = Vec::new();

        for (i, file_path) in files.iter().enumerate() {
            let relative = file_path
                .strip_prefix(project_path)
                .unwrap_or(file_path)
                .to_string_lossy()
                .to_string();

            print!("[{}/{}] Reviewing {}... ", i + 1, files.len(), relative);

            let content = match std::fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    println!("⚠️  Skipped (read error: {})", e);
                    file_reviews.push(FileReview {
                        filename: relative,
                        issues: vec![],
                        free_response: None,
                        skipped: true,
                        skip_reason: Some(e.to_string()),
                    });
                    continue;
                }
            };

            if content.trim().is_empty() {
                println!("⚠️  Skipped (empty)");
                file_reviews.push(FileReview {
                    filename: relative,
                    issues: vec![],
                    free_response: None,
                    skipped: true,
                    skip_reason: Some("Empty file".to_string()),
                });
                continue;
            }

            // ── Route: custom prompt → freeform, no prompt → structured JSON ──
            if let Some(prompt) = custom_prompt {
                match self.vllm.review_file_freeform(&relative, &content, prompt).await {
                    Ok(response) => {
                        println!("✅ Got response");
                        file_reviews.push(FileReview {
                            filename: relative,
                            issues: vec![],
                            free_response: Some(response),
                            skipped: false,
                            skip_reason: None,
                        });
                    }
                    Err(e) => {
                        println!("❌ Error: {}", e);
                        file_reviews.push(FileReview {
                            filename: relative,
                            issues: vec![],
                            free_response: None,
                            skipped: true,
                            skip_reason: Some(e.to_string()),
                        });
                    }
                }
            } else {
                match self.vllm.review_file(&relative, &content, review_types).await {
                    Ok(issues) => {
                        println!("✅ {} issue(s)", issues.len());
                        file_reviews.push(FileReview {
                            filename: relative,
                            issues,
                            free_response: None,
                            skipped: false,
                            skip_reason: None,
                        });
                    }
                    Err(e) => {
                        println!("❌ Error: {}", e);
                        file_reviews.push(FileReview {
                            filename: relative,
                            issues: vec![],
                            free_response: None,
                            skipped: true,
                            skip_reason: Some(e.to_string()),
                        });
                    }
                }
            }
        }

        Ok(ProjectReview {
            project_name: project_name.to_string(),
            file_reviews,
        })
    }

    fn collect_files(&self, project_path: &Path) -> Vec<PathBuf> {
        WalkDir::new(project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                let path_str = e.path().to_string_lossy();
                !SKIP_PATTERNS.iter().any(|p| path_str.contains(p))
            })
            .filter(|e| {
                e.path().extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| REVIEW_EXTENSIONS.contains(&ext))
                    .unwrap_or(false)
            })
            .map(|e| e.path().to_path_buf())
            .collect()
    }
}
