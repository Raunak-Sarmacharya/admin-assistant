# Mini Verlo — Product Requirements Document

## Vision
A portfolio-grade AI Admin Assistant for Wealth Management, demonstrating full-stack AI engineering competence. Inspired by [Verlo Finance](https://verlo.finance) — purpose-built for financial advisors to eliminate the 80% of time lost to admin, prep, and compliance.

## Target Audience (For Demo Purposes)
Financial advisors who need to:
- Process meeting transcripts into structured CRM-ready outputs
- Record in-person meetings or conduct online meetings with clients
- Get instant answers about client data via natural language
- Ensure compliance with FINRA/SEC regulations on all client communications
- Manage client relationships and tasks efficiently

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **Language**: TypeScript 5
- **UI**: React 19, Tailwind CSS v4, shadcn/ui (new-york style, stone base color), Lucide icons
- **Database**: Supabase (PostgreSQL) with `@supabase/supabase-js` v2.95 and `@supabase/ssr` v0.8
- **AI**: Vercel AI SDK v6 (`ai` v6.0), `@ai-sdk/google` v3, `@ai-sdk/openai` v3
- **Validation**: Zod v4
- **Theming**: next-themes (dark/light mode)
- **Notifications**: Sonner v2
- **Build**: Turbopack, PostCSS with `@tailwindcss/postcss`

## Core Value Propositions
1. **Ask Anything** — Chat over all client data in plain English
2. **Never Miss a Detail** — AI-powered meeting notes, action items, follow-up emails
3. **Compliance-First** — Every AI output scanned for regulatory risks before sending
4. **Data Privacy** — PII automatically redacted before any LLM call
5. **BYOK** — Bring Your Own API Key; supports Google Gemini (free) and OpenAI
6. **Multi-Modal Input** — Paste text, record from mic, upload audio files, upload notes, or conduct live online meetings
7. **Online Meetings** — WebRTC peer-to-peer meeting rooms with shareable links and mixed-audio recording

## Application Structure

### Pages & Routes

| Route | Type | Description |
|---|---|---|
| `/` | Redirect | Redirects to `/dashboard` |
| `/dashboard` | Server Page | Overview with KPI stats (Total AUM, Active Clients, Recent Meetings, Pending Tasks), compliance flag alerts, recent meetings list, pending tasks list |
| `/dashboard/clients` | Server Page | Client list with name, risk tolerance badge, AUM |
| `/dashboard/clients/[id]` | Server Page | Client detail: profile info, AUM, email, phone, notes, related meetings and tasks |
| `/dashboard/meetings/new` | Client Page | **Meeting Processing Hub** — Tabbed interface with 4 input modes (Paste, Record, Upload Audio, Upload Notes), client selection, meeting title, AI processing pipeline visualization, PII vault preview, and "Start Online Meeting" button |
| `/dashboard/meetings/[id]` | Server Page | **Meeting Workbench** — Full meeting detail with transcript (PII-highlighted), AI-generated summary, key topics, extracted tasks, email draft with compliance flags, approval workflow, source type badge |
| `/dashboard/chat` | Client Page | AI Chat interface — streaming conversation over all client/meeting/task data with message history |
| `/dashboard/settings` | Client Page | BYOK configuration — provider picker (Google Gemini / OpenAI), API key input with validation, model selection with dynamic fetching, connected integrations display |
| `/meeting/[roomId]` | Client Page | **Online Meeting Room** (standalone, outside dashboard layout) — Pre-join screen with role selection (Host/Guest), shareable link, WebRTC peer-to-peer audio connection, real-time waveform visualization, recording controls (host only), mute toggle, "Process with AI" handoff |

### API Routes

| Route | Method | Description |
|---|---|---|
| `/api/ai/process-meeting` | POST | Takes transcript + client context → returns structured AI output (summary, key topics, tasks, email draft) using `generateObject` with Zod schema validation |
| `/api/ai/compliance-check` | POST | Takes email draft + client risk tolerance → returns compliance flags (flagged text, risk category, severity, explanation) using `generateObject` |
| `/api/ai/transcribe` | POST | Takes base64-encoded audio or text file → returns transcript. Audio mode uses Gemini multimodal API with `generateText`. Text mode decodes base64 directly. Supports MP3, WAV, WebM, OGG, M4A up to 20MB |
| `/api/ai/chat` | POST | Takes messages + API key → streams AI response using `streamText`. Builds dynamic context from all clients, recent meetings, and pending tasks. Wraps stream to catch mid-stream errors (e.g. 429 quota) |

All AI routes:
- Accept `apiKey` in request body (BYOK pattern — key never stored server-side)
- Accept `model` parameter (defaults to `gemini-2.0-flash`)
- Use `createAIProvider()` factory that auto-detects Google vs OpenAI from model name
- Use `parseAIError()` for graceful quota/billing/key error handling
- Return `isQuota: true` flag for quota-specific errors

### Database Schema (Supabase PostgreSQL)

| Table | Key Columns | Description |
|---|---|---|
| `clients` | id, name, email, phone, risk_tolerance (Conservative/Balanced/Growth/Aggressive), aum_value, status (Active/Prospect/Inactive), notes | Wealth management client profiles (seeded with 5 demo clients) |
| `meetings` | id, client_id (FK), title, transcript_text, transcript_redacted, pii_entities (JSONB), source_type (paste/audio_upload/file_upload), source_file_name, status (processing/review_needed/approved/completed) | Meeting records with transcripts and source tracking |
| `meeting_outputs` | id, meeting_id (FK, unique), summary_text, key_topics (JSONB), client_email_draft, is_approved, approved_at | AI-generated structured content per meeting |
| `tasks` | id, meeting_id (FK), client_id (FK), description, due_date, priority (high/medium/low), status (pending/in_progress/completed) | Extracted action items from meetings |
| `compliance_flags` | id, meeting_output_id (FK), flagged_text, risk_category (Promissory/Guarantee/Suitability/Misleading/Unauthorized), severity (high/medium/low), explanation, is_resolved, advisor_comment | Regulatory risk detections on email drafts |
| `chat_messages` | id, role (user/assistant/system), content, metadata (JSONB) | AI chat conversation history |

### Components

#### Layout Components
| Component | File | Description |
|---|---|---|
| AppSidebar | `components/layout/app-sidebar.tsx` | Main navigation sidebar with links to Overview, Clients, Meetings, AI Chat, Settings. Shows SOC 2 compliance badge in footer. Collapsible to icon mode |
| Header | `components/layout/header.tsx` | Top bar with theme toggle and API key connection status badge |

#### Meeting Components
| Component | File | Description |
|---|---|---|
| AudioRecorder | `components/meeting/audio-recorder.tsx` | Full recording UI with real-time canvas waveform visualization (Web Audio API AnalyserNode), animated recording indicator with duration timer, record/pause/resume/stop controls, post-recording audio playback via `<audio>` element, permission error handling |
| FileUploadZone | `components/meeting/file-upload-zone.tsx` | Drag-and-drop file upload with file type and size validation, visual drag-over states, file preview (name, size, type), supports both audio files (MP3/WAV/M4A/WebM/OGG up to 20MB) and text files (TXT/MD/CSV up to 5MB). Converts files to base64 |
| ProcessingPipeline | `components/meeting/processing-pipeline.tsx` | Visual multi-step pipeline showing processing progress. Steps: Upload → Transcribe → PII Redaction → AI Analysis → Compliance Scan → Complete. Each step has status (pending/running/complete/error/skipped) with icons and descriptions. Dynamically adapts steps based on input mode |

#### UI Components (shadcn/ui)
Avatar, Badge, Button, Card, Command, Dialog, DropdownMenu, Input, Label, Popover, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Sonner (toast), Table, Tabs (with horizontal/vertical variants), Textarea, Tooltip

### Custom Hooks

| Hook | File | Description |
|---|---|---|
| useApiKey | `hooks/use-api-key.ts` | Manages BYOK API key, model, and provider state via localStorage. Returns `apiKey`, `model`, `provider`, `isKeySet`, `isLoaded` and setter/clear functions. Never persists to server |
| useAudioRecorder | `hooks/use-audio-recorder.ts` | Wraps MediaRecorder API + Web Audio API AnalyserNode. Supports record/pause/resume/stop, auto-converts to base64, handles mic permission errors. Accepts optional external MediaStream for recording mixed audio from WebRTC. Returns state, duration, audioBlob, audioUrl, base64Data, mimeType, analyserNode |
| useWebRTCMeeting | `hooks/use-webrtc-meeting.ts` | Full WebRTC peer-to-peer meeting hook. Uses Supabase Realtime Broadcast channels for signaling (SDP offer/answer + ICE candidates). Google STUN servers for NAT traversal. Mixes local + remote audio via AudioContext.createMediaStreamDestination(). Presence tracking for peer join/leave. Connection state machine: idle → waiting → connecting → connected → disconnected → failed |
| useMobile | `hooks/use-mobile.ts` | SSR-safe mobile viewport detection |

### AI Library Layer

| Module | File | Description |
|---|---|---|
| Provider Factory | `lib/ai/provider.ts` | `createAIProvider(apiKey, model)` — auto-detects Google vs OpenAI from model name prefix. `parseAIError(error)` — maps raw errors to user-friendly messages with `isQuota` flag for quota/rate limit scenarios |
| Prompts | `lib/ai/prompts.ts` | `getMeetingProcessorPrompt(clientName, riskTolerance, aumValue)` — generates context-aware system prompt for meeting analysis. `COMPLIANCE_SENTINEL_PROMPT` — strict FINRA/SEC compliance officer persona. `TRANSCRIPTION_PROMPT` — financial meeting transcription with speaker identification. `getChatSystemPrompt(clientContext)` — dynamic prompt with injected client book data |
| Schemas | `lib/ai/schemas.ts` | Zod schemas: `MeetingOutputSchema` (summary, key_topics, tasks with priority/due_date, email_draft), `ComplianceFlagSchema` (flags with flagged_text/risk_category/severity/explanation, overall_risk_level) |
| Models | `lib/ai/models.ts` | `fetchGoogleModels(apiKey)` — fetches available Gemini models, marks free-tier models. `fetchOpenAIModels(apiKey)` — fetches GPT/o-series models. Default models: gemini-2.0-flash (Google), gpt-4o (OpenAI) |

### Utility Layer

| Module | File | Description |
|---|---|---|
| PII Redaction | `lib/utils/pii-redaction.ts` | Regex-based detection and redaction of phone numbers, emails, SSNs, account numbers. Returns redacted text + array of PIIEntity objects with type, original, replacement, and position. `getPIISummary()` for human-readable summary |
| Formatters | `lib/utils/formatters.ts` | `formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatRelativeTime`, `formatDueDate` |
| Constants | `lib/constants.ts` | App name, storage keys, provider definitions (Google/OpenAI with descriptions and docs URLs), color mappings for risk tolerance/status/priority, mock integrations list |

## Feature Details

### F1: Meeting Processing Hub (`/dashboard/meetings/new`)
**4 Input Modes via Tabs:**
1. **Paste** — Text area for pasting transcripts directly. Includes quick-load buttons for 3 sample transcripts with auto-client matching
2. **Record** — Live microphone recording via MediaRecorder API with real-time waveform visualization (canvas + AnalyserNode), pause/resume support, and post-recording playback. Recording auto-converts to base64 for AI transcription
3. **Upload Audio** — Drag-and-drop audio file upload (MP3, WAV, M4A, WebM, OGG up to 20MB) with file preview and validation
4. **Upload Notes** — Drag-and-drop text file upload (TXT, MD, CSV up to 5MB) with direct text extraction

**Processing Pipeline (all modes):**
1. Upload/Prepare → 2. AI Transcription (audio modes only, via Gemini multimodal) → 3. PII Redaction (regex-based) → 4. AI Analysis (summary + tasks + email via `generateObject`) → 5. Compliance Scan (FINRA/SEC review of email draft) → 6. Save to Supabase → Navigate to meeting detail

**Additional features:**
- Client selection dropdown (loaded from Supabase)
- Meeting title input
- Real-time PII vault preview (shows detected PII before processing)
- Visual pipeline progress with step status indicators
- Source type tracking (paste/audio_upload/file_upload) saved to database
- "Start Online Meeting" button generates UUID room and opens `/meeting/[roomId]`

### F2: Online Meeting Room (`/meeting/[roomId]`)
**Pre-Join Screen:**
- Role selection: Host (Advisor) or Guest (Client)
- Auto-detects role from URL hash (`#guest`)
- Shareable meeting link with copy-to-clipboard button
- Role-specific instructions

**In-Meeting Screen:**
- WebRTC peer-to-peer audio connection via Supabase Realtime Broadcast signaling
- Connection status badge (Waiting → Connecting → Connected → Disconnected)
- Participant presence indicators
- Mute/unmute toggle
- Leave meeting button

**Host-Only Features:**
- Recording controls (start/pause/resume/stop) with waveform visualization
- Records mixed audio (local + remote streams via AudioContext.createMediaStreamDestination)
- "Process with AI" button after recording stops — stores base64 recording in sessionStorage and opens `/dashboard/meetings/new?source=room`
- The meetings/new page auto-detects `?source=room` query param and loads the recording

**Guest Features:**
- Simple connection status display
- Privacy notice about peer-to-peer encryption

### F3: Meeting Workbench (`/dashboard/meetings/[id]`)
- Full transcript display with PII entity highlighting
- Source type badge (Audio Recording, File Upload, or Pasted Text) with appropriate icon
- AI-generated summary text
- Key topics as tags
- Extracted tasks with priority badges and due dates
- Email draft display with inline compliance flag highlighting
- Compliance flags panel with severity, category, and explanation for each flag
- Approval workflow: "Approve & Send" button (disabled until flags reviewed)
- Meeting metadata: client name, date, status

### F4: AI Chat (`/dashboard/chat`)
- Streaming AI responses via `streamText`
- Dynamic context injection from Supabase: all clients (name, AUM, risk profile, notes), recent 10 meetings (title, client, status), pending tasks (description, priority, due date)
- Message input with send button
- Mid-stream error handling (catches 429 quota errors during streaming)
- Markdown-formatted AI responses

### F5: Dashboard Overview (`/dashboard`)
- KPI stat cards: Total AUM, Active Clients, Recent Meetings, Pending Tasks
- Unresolved compliance flags alert banner
- Recent meetings list (clickable, shows status badge)
- Pending tasks list (shows priority badge and due date)
- All data fetched server-side from Supabase

### F6: Client Management
- **Client List** (`/dashboard/clients`): All clients with name, risk tolerance badge (color-coded), AUM formatted compact
- **Client Detail** (`/dashboard/clients/[id]`): Full profile with email, phone, notes, AUM, risk tolerance, related meetings and tasks

### F7: BYOK Settings (`/dashboard/settings`)
- **Provider Picker**: Google Gemini (free tier available) or OpenAI (requires billing)
- **API Key Input**: Validates key by fetching models, saves to localStorage only
- **Model Selection**: Dynamic dropdown populated from provider's model API. Google models show free-tier markers
- **Key Management**: Masked display, show/hide toggle, remove button
- **Connected Integrations**: Mock badges for Wealthbox CRM, Charles Schwab, Fidelity, SharePoint, Zoom

### F8: PII Vault
- Regex-based detection of: phone numbers, email addresses, SSNs (full and partial), account numbers (9-12 digit sequences)
- Real-time preview in meeting processing sidebar
- Automatic redaction before any LLM call
- Redacted entities shown with original (struck-through) and replacement labels

### F9: Compliance Sentinel
- Secondary AI scan on every generated email draft
- Scans for: Promissory language, Guarantees, Suitability issues, Misleading statements, Unauthorized promises
- Returns: exact flagged text, risk category, severity (high/medium/low), explanation with suggested fix
- Overall risk level assessment: clean, low, medium, high
- Flags displayed inline on email draft in meeting workbench

## User Flows

### Flow 1: Process a Pasted Transcript
1. Navigate to `/dashboard/meetings/new`
2. Select a client from the dropdown
3. Enter a meeting title
4. Stay on "Paste" tab, paste or load sample transcript
5. PII vault preview updates in real-time
6. Click "Process with AI"
7. Pipeline visualization shows progress: PII Redaction → AI Analysis → Compliance Scan
8. On completion, redirected to `/dashboard/meetings/[id]` with full workbench

### Flow 2: Record an In-Person Meeting
1. Navigate to `/dashboard/meetings/new`
2. Select client and enter title
3. Click "Record" tab
4. Click "Start Recording" → grant microphone permission
5. Real-time waveform displays during recording
6. Click "Stop Recording" when done
7. Preview the recording with built-in audio player
8. Click "Process with AI"
9. Pipeline: Prepare Recording → AI Transcription → PII Redaction → AI Analysis → Compliance Scan
10. Redirected to meeting workbench

### Flow 3: Upload an Audio File
1. Navigate to `/dashboard/meetings/new`
2. Select client and enter title
3. Click "Upload Audio" tab
4. Drag-and-drop or browse for audio file (MP3/WAV/M4A/WebM/OGG, max 20MB)
5. File preview shows name, size, type
6. Click "Process with AI"
7. Pipeline: Upload → AI Transcription → PII Redaction → AI Analysis → Compliance Scan
8. Redirected to meeting workbench

### Flow 4: Conduct an Online Meeting
1. Navigate to `/dashboard/meetings/new`
2. Click "Start Online Meeting" button in sidebar
3. Opens `/meeting/[roomId]` in new tab
4. Select "Host" role, copy shareable link
5. Send link to client (guest opens link, selects "Guest" role, joins)
6. Both grant microphone access → WebRTC peer-to-peer connection established
7. Host starts recording (captures both sides via mixed audio stream)
8. When meeting ends, host stops recording
9. Host clicks "Process with AI" → opens meetings/new page with recording pre-loaded
10. Select client, title, process through full pipeline

### Flow 5: AI Chat
1. Navigate to `/dashboard/chat`
2. Type a question about clients, meetings, or tasks
3. AI responds with streamed markdown, referencing actual Supabase data
4. Continue conversation with follow-up questions

### Flow 6: Configure API Key
1. Navigate to `/dashboard/settings`
2. Select provider (Google Gemini or OpenAI)
3. Enter API key → system validates by fetching available models
4. On success: key saved to localStorage, model dropdown populated
5. Select preferred model (defaults to gemini-2.0-flash or gpt-4o)

## Non-Goals
- Real custodian/CRM integrations (mocked as "connected" badges)
- User authentication (single-user demo)
- Mobile-first design (desktop-optimized, responsive is fine)
- Real-time collaborative editing
- Video in online meetings (audio-only via WebRTC)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://vjyzznmvbtnmyiuhidnk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```
No AI API keys are stored server-side — all keys come from client localStorage via BYOK pattern.

## Success Criteria
1. A user can open the app, enter an API key, and process a meeting in under 60 seconds
2. All 4 input modes (paste, record, upload audio, upload notes) work end-to-end
3. Online meeting room establishes WebRTC connection and records mixed audio
4. Compliance flags visually highlight risky text in the email draft
5. AI Chat returns accurate answers about seeded client data
6. PII is automatically detected and redacted before any LLM call
7. Code architecture demonstrates separation of concerns, type safety, and modern patterns
8. UI is enterprise-grade with dark/light theme support
