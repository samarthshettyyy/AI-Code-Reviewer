const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface IssueOut {
  issue_type: "bug" | "security" | "performance" | "style" | "architecture" | "debugging";
  severity: "critical" | "high" | "medium" | "low";
  line: number | null;
  description: string;
  suggestion: string;
}

export interface FileResult {
  filename: string;
  skipped: boolean;
  skip_reason: string | null;
  issues: IssueOut[];
}

export interface ReviewResponse {
  project_name: string;
  files_reviewed: number;
  files_skipped: number;
  total_issues: number;
  file_results: FileResult[];
  verdict: string;
}

export async function reviewByPath(
  path: string,
  review_types: string[]
): Promise<ReviewResponse> {
  const res = await fetch(`${API_URL}/api/review/path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, review_types }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reviewByUpload(
  files: File[],
  review_types: string[]
): Promise<ReviewResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("review_types", JSON.stringify(review_types));
  const res = await fetch(`${API_URL}/api/review/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
