use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio_retry::{strategy::ExponentialBackoff, Retry};
use crate::models::ReviewIssue;

#[derive(Serialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Clone)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: MessageContent,
}

#[derive(Deserialize)]
struct MessageContent {
    content: String,
}

pub struct VllmClient {
    client: Client,
    base_url: String,
    model: String,
}

impl VllmClient {
    pub fn new(base_url: &str, model: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(180))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .unwrap();
        Self {
            client,
            base_url: base_url.to_string(),
            model: model.to_string(),
        }
    }

    // ── Shared helper to call vLLM ─────────────────────────────────
    async fn call_model(&self, messages: Vec<ChatMessage>, max_tokens: u32, temperature: f32) -> Result<String> {
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            max_tokens,
            temperature,
        };

        let url = format!("{}/v1/chat/completions", self.base_url);
        let client = self.client.clone();
        let req_clone = request.clone();
        let retry_strategy = ExponentialBackoff::from_millis(1000).take(3);

        let raw = Retry::spawn(retry_strategy, || {
            let c = client.clone();
            let u = url.clone();
            let r = req_clone.clone();
            async move {
                let resp = c.post(&u)
                    .json(&r)
                    .send()
                    .await?
                    .error_for_status()?
                    .json::<ChatResponse>()
                    .await?;
                Ok::<String, anyhow::Error>(
                    resp.choices.into_iter().next()
                        .map(|c| c.message.content)
                        .unwrap_or_default()
                )
            }
        }).await?;

        Ok(raw.trim().to_string())
    }

    // ── Structured JSON review (focus-based) ──────────────────────
    pub async fn review_file(
        &self,
        filename: &str,
        content: &str,
        review_types: &[String],
    ) -> Result<Vec<ReviewIssue>> {
        let focus_lines: Vec<&str> = review_types.iter().filter_map(|t| match t.as_str() {
            "bug"          => Some("- Bugs: logic errors, off-by-one errors, wrong conditions, incorrect return values"),
            "security"     => Some("- Security: unsafe blocks, unwrap() panics, input validation failures, hardcoded secrets"),
            "performance"  => Some("- Performance: unnecessary clones, blocking calls in async context, inefficient loops"),
            "style"        => Some("- Style: missing error handling, poor naming conventions, missing documentation"),
            "architecture" => Some("- Architecture: poor module structure, tight coupling, missing abstractions, god structs"),
            "debugging"    => Some("- Debugging: silent failures, swallowed errors, missing log statements, unreachable code"),
            _ => None,
        }).collect();

        let focus_section = if focus_lines.is_empty() {
            "- Review everything: bugs, security, performance, style, architecture, debugging".to_string()
        } else {
            focus_lines.join("\n")
        };

        let system_prompt = format!(
            r#"You are a senior software engineer performing a focused code review.
Analyze the provided source code and identify issues.

Focus ONLY on the following areas requested by the user:
{}

Return ONLY a valid JSON array. Each element must have exactly these fields:
{{
  "type": "bug" | "security" | "performance" | "style" | "architecture" | "debugging",
  "severity": "critical" | "high" | "medium" | "low",
  "line": <integer line number or null>,
  "description": "<clear description of what is wrong>",
  "suggestion": "<specific actionable fix>"
}}

If no issues found in the requested focus areas, return: []
Do NOT include any text, explanation, or markdown outside the JSON array."#,
            focus_section
        );

        let code = if content.len() > 12000 { &content[..12000] } else { content };
        let user_prompt = format!("File: {}\n\n source code to review:\n\n```\n{}\n```", filename, code);

        let raw = self.call_model(
            vec![
                ChatMessage { role: "system".to_string(), content: system_prompt },
                ChatMessage { role: "user".to_string(),   content: user_prompt },
            ],
            2048,
            0.1,
        ).await?;

        let cleaned = raw
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let json_start = cleaned.find('[').unwrap_or(0);
        let json_end   = cleaned.rfind(']').map(|i| i + 1).unwrap_or(cleaned.len());
        let json_str   = &cleaned[json_start..json_end];

        let issues: Vec<ReviewIssue> = serde_json::from_str(json_str).unwrap_or_default();
        Ok(issues)
    }

    // ── Free-form review (custom prompt) ──────────────────────────
    pub async fn review_file_freeform(
        &self,
        filename: &str,
        content: &str,
        custom_prompt: &str,
    ) -> Result<String> {
        let system_prompt = format!(
            r#"You are a senior software engineer reviewing code.
The user has given you a specific instruction. Follow it exactly and give a clear, helpful response.

Instruction: "{}"

Respond in plain text. Be concise and specific. Point out exact line numbers where relevant.
Do NOT wrap your response in JSON. Just answer the instruction directly."#,
            custom_prompt
        );

        let code = if content.len() > 12000 { &content[..12000] } else { content };
        let user_prompt = format!("File: {}\n\n```\n{}\n```", filename, code);

        self.call_model(
            vec![
                ChatMessage { role: "system".to_string(), content: system_prompt },
                ChatMessage { role: "user".to_string(),   content: user_prompt },
            ],
            1024,
            0.3,
        ).await
    }
}
