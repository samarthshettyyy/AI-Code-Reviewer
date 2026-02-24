# 🔍 AI Code Reviewer

An AI-powered code review tool that analyzes your source code using a
self-hosted **CodeLlama-13B** model via **vLLM**. Supports structured
issue detection and free-form natural language queries across 10+
programming languages.

---
---


## ✨ Features

- **Multi-language support** — Rust, Python, JavaScript, TypeScript,
  C/C++, Go, Java, Ruby, PHP, Swift, Kotlin, C# and more
- **Two review modes**
  - 🧠 **Structured review** — Returns categorized issues with severity
    (critical / high / medium / low), line numbers, descriptions and
    fix suggestions
  - 💬 **Custom prompt** — Ask anything in plain English; the model
    responds freely without JSON constraints
- **Focus filters** — Full Review, Bug Detection, Security Audit,
  Performance, Code Style, Architecture
- **File input options** — Upload individual files / zip archives, or
  provide a local folder path for full project scanning
- **Downloadable reports** — Export results as a Markdown `.md` file
- **Abort control** — Cancel a running review mid-flight
- **Self-hosted & private** — No code leaves your network; model runs
  on your own vLLM server

---

### Backend modules (`src/`)

| File | Responsibility |
|---|---|
| `main.rs` | Server bootstrap, port binding |
| `api.rs` | Route handlers, request/response structs |
| `reviewer.rs` | Project walker, file dispatcher |
| `vllm.rs` | vLLM HTTP client, structured + free-form prompts |
| `models.rs` | Shared data types (`ReviewIssue`, `FileReview`, etc.) |

---

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 18+ and pnpm/npm
- A running [vLLM](https://github.com/vllm-project/vllm) instance
  serving CodeLlama-13B (or any compatible model)

---


