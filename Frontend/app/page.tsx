'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Code2,
  ChevronDown,
  Upload,
  Folder,
  X,
  Bug,
  Shield,
  Zap,
  PenTool,
  CheckCircle,
  Download,
  Loader2,
  FileText,
  MessageSquare,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────
type ReviewType = 'full' | 'bugs' | 'security' | 'performance' | 'style' | 'architecture'
type Severity = 'critical' | 'high' | 'medium' | 'low'
type IssueType = 'bug' | 'security' | 'performance' | 'style' | 'architecture' | 'debugging'

interface ReviewIssue {
  issue_type: IssueType
  severity: Severity
  line: number | null
  description: string
  suggestion: string
}

interface FileResult {
  filename: string
  issues: ReviewIssue[]
  skipped: boolean
  skip_reason: string | null
  free_response?: string
}

interface ReviewResponse {
  project_name: string
  files_reviewed: number
  files_skipped: number
  total_issues: number
  file_results: FileResult[]
  verdict: string
}

// ── Supported languages ────────────────────────────────────────────────
const SUPPORTED_EXTENSIONS = [
  '.rs', '.py', '.js', '.jsx', '.ts', '.tsx',
  '.c', '.cpp', '.h', '.hpp', '.cc',
  '.go', '.java', '.rb', '.php', '.swift',
  '.kt', '.cs', '.sh', '.toml', '.yaml', '.yml', '.json',
]

const ACCEPT_STRING = SUPPORTED_EXTENSIONS.join(',') + ',.zip'

function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext))
}

// ── Helpers ────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getCounts(fileResults: FileResult[]) {
  const all = fileResults.flatMap(f => f.issues)
  return {
    critical: all.filter(i => i.severity === 'critical').length,
    high:     all.filter(i => i.severity === 'high').length,
    medium:   all.filter(i => i.severity === 'medium').length,
    low:      all.filter(i => i.severity === 'low').length,
  }
}

const reviewFocusOptions = [
  { id: 'full',         label: 'Full Review',    icon: '🔍', description: 'Everything',                apiTypes: ['bug','security','performance','style','architecture','debugging'] },
  { id: 'bugs',         label: 'Bug Detection',  icon: '🐛', description: 'Logic & runtime errors',    apiTypes: ['bug'] },
  { id: 'security',     label: 'Security Audit', icon: '🔒', description: 'Vulnerabilities & secrets',  apiTypes: ['security'] },
  { id: 'performance',  label: 'Performance',    icon: '⚡', description: 'Speed & memory',             apiTypes: ['performance'] },
  { id: 'style',        label: 'Code Style',     icon: '📝', description: 'Naming & structure',        apiTypes: ['style'] },
  { id: 'architecture', label: 'Architecture',   icon: '🏗️', description: 'Design patterns',           apiTypes: ['architecture','debugging'] },
]

function SeverityIcon({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: 'bg-red-500', high: 'bg-orange-500',
    medium: 'bg-yellow-500', low: 'bg-blue-500',
  }
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[severity]}`} />
}

function SeverityLabel({ severity }: { severity: Severity }) {
  const labels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
  return <span className="capitalize">{labels[severity]}</span>
}

function getVerdictInfo(counts: { critical: number; high: number; medium: number; low: number }) {
  if (counts.critical > 0) return {
    icon: '❌', title: 'CRITICAL ISSUES FOUND', description: 'Must fix before use',
    color: 'bg-red-900/20 border-red-800', textColor: 'text-red-300',
  }
  if (counts.high > 0) return {
    icon: '⚠️', title: 'HIGH SEVERITY ISSUES', description: 'Fix recommended',
    color: 'bg-orange-900/20 border-orange-800', textColor: 'text-orange-300',
  }
  if (counts.medium > 0) return {
    icon: '🟡', title: 'MEDIUM ISSUES', description: 'Consider fixing',
    color: 'bg-yellow-900/20 border-yellow-800', textColor: 'text-yellow-300',
  }
  return {
    icon: '✅', title: 'LOOKS GOOD', description: 'No critical issues found',
    color: 'bg-green-900/20 border-green-800', textColor: 'text-green-300',
  }
}

// ── Component ──────────────────────────────────────────────────────────
export default function Page() {
  const [showResults, setShowResults]       = useState(false)
  const [selectedFocus, setSelectedFocus]   = useState<ReviewType>('full')
  const [customPrompt, setCustomPrompt]     = useState('')
  const [uploadedFiles, setUploadedFiles]   = useState<File[]>([])
  const [activeFileTab, setActiveFileTab]   = useState<'path' | 'upload'>('path')
  const [projectPath, setProjectPath]       = useState('')
  const [isLoading, setIsLoading]           = useState(false)
  const [expandedFiles, setExpandedFiles]   = useState<Set<string>>(new Set())
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())
  const [result, setResult]                 = useState<ReviewResponse | null>(null)
  const [error, setError]                   = useState<string | null>(null)
  const [isDragging, setIsDragging]         = useState(false)

  const fileInputRef       = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null)

    if (activeFileTab === 'path' && !projectPath.trim()) {
      setError('Please enter a folder path.'); return
    }
    if (activeFileTab === 'upload' && uploadedFiles.length === 0) {
      setError('Please upload at least one source file.'); return
    }

    const focusOption = reviewFocusOptions.find(o => o.id === selectedFocus)!
    const reviewTypes = customPrompt.trim()
      ? ['bug','security','performance','style','architecture','debugging']
      : focusOption.apiTypes

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setShowResults(false)

    try {
      let data: ReviewResponse

      if (activeFileTab === 'upload') {
        const formData = new FormData()
        uploadedFiles.forEach(f => formData.append('files', f))
        formData.append('review_types', JSON.stringify(reviewTypes))
        if (customPrompt.trim()) formData.append('custom_prompt', customPrompt.trim())

        const res = await fetch(`${API_URL}/api/review/upload`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(await res.text())
        data = await res.json()
      } else {
        const res = await fetch(`${API_URL}/api/review/path`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: projectPath.trim(),
            review_types: reviewTypes,
            ...(customPrompt.trim() && { custom_prompt: customPrompt.trim() }),
          }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(await res.text())
        data = await res.json()
      }

      setResult(data)
      setShowResults(true)
      setExpandedFiles(new Set(data.file_results.map(f => f.filename)))
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        // cancelled by user — do nothing
      } else {
        setError(e instanceof Error ? e.message : 'Failed to connect to backend. Is it running?')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Stop ───────────────────────────────────────────────────────────
  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
    setError('Review cancelled.')
  }

  // ── File handlers ──────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(
      f => isSupportedFile(f.name) || f.name.endsWith('.zip')
    )
    if (files.length === 0) return
    setUploadedFiles(prev => [...prev, ...files])
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    setUploadedFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
  }

  // ── Expand toggles ─────────────────────────────────────────────────
  const toggleFileExpanded = (filename: string) => {
    const newSet = new Set(expandedFiles)
    newSet.has(filename) ? newSet.delete(filename) : newSet.add(filename)
    setExpandedFiles(newSet)
  }

  const toggleIssueExpanded = (issueKey: string) => {
    const newSet = new Set(expandedIssues)
    newSet.has(issueKey) ? newSet.delete(issueKey) : newSet.add(issueKey)
    setExpandedIssues(newSet)
  }

  // ── Download ───────────────────────────────────────────────────────
  const downloadReport = () => {
    if (!result) return
    const counts = getCounts(result.file_results)
    const verdict = getVerdictInfo(counts)
    const isFreeForm = result.file_results.some(f => f.free_response)

    const markdown = isFreeForm
      ? `# AI Code Review Report

**Project:** ${result.project_name}
**Files Reviewed:** ${result.files_reviewed}
**Prompt:** ${customPrompt}

## Responses by File

${result.file_results
  .filter(f => !f.skipped)
  .map(file => `
### ${file.filename}

${file.free_response || '_No response_'}
`).join('')}
`
      : `# AI Code Review Report

**Project:** ${result.project_name}
**Files Reviewed:** ${result.files_reviewed}
**Total Issues:** ${result.total_issues}

## Summary
- **Critical:** ${counts.critical}
- **High:** ${counts.high}
- **Medium:** ${counts.medium}
- **Low:** ${counts.low}

## Verdict
${verdict.icon} **${verdict.title}** — ${verdict.description}

## Issues by File

${result.file_results
  .filter(f => !f.skipped && f.issues.length > 0)
  .map(file => `
### ${file.filename}

${file.issues.map(issue => `
- **[${issue.severity.toUpperCase()}]** ${issue.issue_type} (Line ${issue.line || 'N/A'})
  - ${issue.description}
  - *Suggestion:* ${issue.suggestion}
`).join('')}
`).join('')}
`

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.project_name}_review.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived ────────────────────────────────────────────────────────
  const counts = result ? getCounts(result.file_results) : { critical: 0, high: 0, medium: 0, low: 0 }
  const isFreeFormResult = result?.file_results.some(f => f.free_response)

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f10] to-[#1a1a1f] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">

        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Code2 className="h-8 w-8 text-[#7c6af7]" />
            <h1 className="text-4xl font-bold">AI Code Reviewer</h1>
          </div>
          <p className="text-gray-400">Powered by CodeLlama-13B via vLLM</p>
        </div>

        {/* Input Section */}
        <div className="mb-8 rounded-2xl border border-[#2e2e38] bg-[#1e1e24] p-8">

          {/* Custom Prompt */}
          <div className="mb-6">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="What would you like to review? e.g. 'Find all memory leaks and unsafe blocks' or leave blank to use the focus below"
              className="w-full rounded-xl border border-[#2e2e38] bg-[#0f0f10] px-4 py-3 text-white placeholder-gray-500 focus:border-[#7c6af7] focus:outline-none focus:ring-1 focus:ring-[#7c6af7]"
              rows={3}
            />
          </div>

          {/* Review Focus Grid */}
          <div className="mb-8">
            <p className="mb-3 text-sm font-medium text-gray-300">Review Focus</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {reviewFocusOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedFocus(option.id as ReviewType)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    selectedFocus === option.id
                      ? 'border-[#7c6af7] bg-[#7c6af7]/10'
                      : 'border-[#2e2e38] bg-[#0f0f10] hover:border-[#3e3e48]'
                  } ${customPrompt ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{option.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-gray-500">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* File Input */}
          <div className="mb-8">
            <p className="mb-3 text-sm font-medium text-gray-300">Source Code</p>
            <div className="flex gap-2 border-b border-[#2e2e38]">
              <button
                onClick={() => setActiveFileTab('path')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeFileTab === 'path'
                    ? 'border-b-2 border-[#7c6af7] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Local Path
              </button>
              <button
                onClick={() => setActiveFileTab('upload')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeFileTab === 'upload'
                    ? 'border-b-2 border-[#7c6af7] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Upload Files
              </button>
            </div>

            <div className="mt-4">
              {activeFileTab === 'path' ? (
                <div className="relative">
                  <Folder className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Enter absolute path to your project folder"
                    className="w-full rounded-xl border border-[#2e2e38] bg-[#0f0f10] pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#7c6af7] focus:outline-none focus:ring-1 focus:ring-[#7c6af7]"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed bg-[#0f0f10] p-8 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? 'border-[#7c6af7] bg-[#7c6af7]/10'
                        : 'border-[#2e2e38] hover:border-[#7c6af7] hover:bg-[#7c6af7]/5'
                    }`}
                  >
                    <Upload className="mx-auto mb-2 h-6 w-6 text-gray-500" />
                    <p className="text-sm font-medium">Drag and drop source files or .zip archives</p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                    <p className="text-xs text-gray-600 mt-2">
                      Supports: .rs .py .js .ts .tsx .c .cpp .go .java .rb .php .swift .kt .cs and more
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPT_STRING}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg border border-[#2e2e38] bg-[#0f0f10] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <div className="text-sm">
                              <p className="font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Submit + Stop Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-[#7c6af7] px-6 py-3 font-medium text-white hover:bg-[#6b5ae6] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Reviewing...</span>
                </>
              ) : (
                <>
                  <span>Start Review</span>
                  <span>→</span>
                </>
              )}
            </button>

            {isLoading && (
              <button
                onClick={handleStop}
                className="rounded-xl border border-red-700 bg-red-900/20 px-5 py-3 text-sm font-medium text-red-400 hover:bg-red-900/40 transition-colors whitespace-nowrap"
              >
                ✕ Stop
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {showResults && !isLoading && result && (
          <div className="space-y-6 animate-in fade-in duration-500">

            {/* Summary Cards */}
            {!isFreeFormResult && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {(['critical','high','medium','low'] as const).map(s => {
                  const colors = {
                    critical: ['bg-red-500','text-red-400'],
                    high:     ['bg-orange-500','text-orange-400'],
                    medium:   ['bg-yellow-500','text-yellow-400'],
                    low:      ['bg-blue-500','text-blue-400'],
                  }
                  return (
                    <div key={s} className="rounded-xl border border-[#2e2e38] bg-[#1e1e24] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${colors[s][0]}`} />
                        <p className="text-sm text-gray-400 capitalize">{s}</p>
                      </div>
                      <p className={`text-3xl font-bold ${colors[s][1]}`}>{counts[s]}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Verdict / Prompt Banner */}
            {isFreeFormResult ? (
              <div className="rounded-xl border border-[#7c6af7]/30 bg-[#7c6af7]/5 p-6 flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-[#7c6af7]">💬 Custom Prompt Response</p>
                  <p className="text-sm text-gray-400 mt-1 italic">"{customPrompt}"</p>
                </div>
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 rounded-lg bg-[#7c6af7] px-4 py-2 text-sm font-medium hover:bg-[#6b5ae6] transition-colors whitespace-nowrap"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </button>
              </div>
            ) : (
              (() => {
                const verdict = getVerdictInfo(counts)
                return (
                  <div className={`rounded-xl border ${verdict.color} p-6 flex items-center justify-between`}>
                    <div>
                      <p className={`text-xl font-bold ${verdict.textColor}`}>
                        {verdict.icon} {verdict.title}
                      </p>
                      <p className="text-sm text-gray-400">{verdict.description}</p>
                    </div>
                    <button
                      onClick={downloadReport}
                      className="flex items-center gap-2 rounded-lg bg-[#7c6af7] px-4 py-2 text-sm font-medium hover:bg-[#6b5ae6] transition-colors whitespace-nowrap"
                    >
                      <Download className="h-4 w-4" />
                      Download Report
                    </button>
                  </div>
                )
              })()
            )}

            {/* File Accordions */}
            <div className="space-y-2">
              {result.file_results.map((file) => (
                <div key={file.filename} className="rounded-xl border border-[#2e2e38] bg-[#1e1e24] overflow-hidden">
                  <button
                    onClick={() => toggleFileExpanded(file.filename)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#25252b] transition-colors"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <code className="font-mono text-sm text-gray-300">{file.filename}</code>

                      {file.free_response && (
                        <span className="text-xs px-2 py-1 rounded-full bg-[#7c6af7]/10 border border-[#7c6af7]/30 text-[#7c6af7] flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          Response
                        </span>
                      )}

                      {!file.free_response && (
                        file.issues.length === 0 ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-900/20 border border-green-800 text-green-300 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Clean
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                            file.issues.some(i => i.severity === 'critical') ? 'bg-red-900/20 border-red-800 text-red-300'
                            : file.issues.some(i => i.severity === 'high')   ? 'bg-orange-900/20 border-orange-800 text-orange-300'
                            : file.issues.some(i => i.severity === 'medium') ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300'
                            : 'bg-blue-900/20 border-blue-800 text-blue-300'
                          }`}>
                            {file.issues.length} issue{file.issues.length !== 1 ? 's' : ''}
                          </span>
                        )
                      )}
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${expandedFiles.has(file.filename) ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedFiles.has(file.filename) && (
                    <div className="border-t border-[#2e2e38] px-6 py-4 bg-[#0f0f10]">

                      {file.free_response && (
                        <div className="rounded-lg border border-[#7c6af7]/20 bg-[#7c6af7]/5 p-4">
                          <p className="text-xs font-medium text-[#7c6af7] mb-2 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Model Response
                          </p>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {file.free_response}
                          </p>
                        </div>
                      )}

                      {!file.free_response && file.issues.length > 0 && (
                        <div className="space-y-3">
                          {file.issues.map((issue, idx) => {
                            const issueKey = `${file.filename}-${idx}`
                            return (
                              <div key={issueKey} className="rounded-lg border border-[#2e2e38] p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <SeverityIcon severity={issue.severity} />
                                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        <SeverityLabel severity={issue.severity} />
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {issue.issue_type === 'bug'         && <Bug     className="h-4 w-4 text-gray-400" />}
                                      {issue.issue_type === 'security'    && <Shield  className="h-4 w-4 text-gray-400" />}
                                      {issue.issue_type === 'performance' && <Zap     className="h-4 w-4 text-gray-400" />}
                                      {issue.issue_type === 'style'       && <PenTool className="h-4 w-4 text-gray-400" />}
                                      <span className="text-xs font-medium text-gray-400 capitalize">{issue.issue_type}</span>
                                    </div>
                                    {issue.line && <span className="text-xs text-gray-500">Line {issue.line}</span>}
                                  </div>
                                  <button onClick={() => toggleIssueExpanded(issueKey)} className="text-gray-500 hover:text-gray-300">
                                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedIssues.has(issueKey) ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>

                                <p className="text-sm text-gray-300">{issue.description}</p>

                                {expandedIssues.has(issueKey) && (
                                  <div className="pt-2 border-t border-[#2e2e38]">
                                    <p className="text-xs font-medium text-gray-400 mb-1">Suggestion:</p>
                                    <p className="text-sm text-gray-300">{issue.suggestion}</p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
