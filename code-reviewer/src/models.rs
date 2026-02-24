use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum IssueType {
    Bug,
    Security,
    Performance,
    Style,
    Architecture,
    Debugging,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewIssue {
    #[serde(rename = "type")]
    pub issue_type: IssueType,
    pub severity: Severity,
    pub line: Option<u32>,
    pub description: String,
    pub suggestion: String,
}

#[derive(Debug)]
pub struct FileReview {
    pub filename: String,
    pub issues: Vec<ReviewIssue>,
    pub free_response: Option<String>,   // ← NEW: stores raw model response for custom prompts
    pub skipped: bool,
    pub skip_reason: Option<String>,
}

#[derive(Debug)]
pub struct ProjectReview {
    pub project_name: String,
    pub file_reviews: Vec<FileReview>,
}

impl ProjectReview {
    pub fn total_issues(&self) -> usize {
        self.file_reviews.iter().map(|f| f.issues.len()).sum()
    }

    pub fn issues_by_severity(&self, severity: &Severity) -> Vec<(&FileReview, &ReviewIssue)> {
        self.file_reviews.iter().flat_map(|f| {
            f.issues.iter()
                .filter(|i| &i.severity == severity)
                .map(move |i| (f, i))
        }).collect()
    }
}
