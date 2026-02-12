# AI Admin Assistant for Wealth Management

A production-architected AI admin assistant built for financial advisors. Automates meeting processing, compliance review, client communication drafting, and task extraction — eliminating the majority of post-meeting administrative overhead.

Built as a technical demonstration of a full-stack AI application with real-time capabilities, structured LLM output, regulatory compliance automation, and a BYOK (Bring Your Own Key) architecture that supports multiple AI providers.

---

## Table of Contents

- [Technical Architecture](#technical-architecture)
- [Core Stack](#core-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Feature Breakdown](#feature-breakdown)
- [AI Pipeline Architecture](#ai-pipeline-architecture)
- [Database Schema](#database-schema)
- [PII Redaction Engine](#pii-redaction-engine)
- [WebRTC Meeting Rooms](#webrtc-meeting-rooms)
- [BYOK Provider Architecture](#byok-provider-architecture)
- [Automated Testing](#automated-testing)
- [Integration Roadmap](#integration-roadmap)
- [CI/CD Pipeline Strategy](#cicd-pipeline-strategy)
- [Scaling to Production with Authentication](#scaling-to-production-with-authentication)
- [Scripts](#scripts)

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (React 19)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard │ │ Clients  │ │ Meetings │ │ AI Chat  │ │ Settings │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │            │             │            │       │
│  ┌────┴─────────────┴────────────┴─────────────┴────────────┴────┐ │
│  │              BYOK Key Manager (localStorage)                  │ │
│  └───────────────────────────┬───────────────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ API Key in request body
┌──────────────────────────────┼──────────────────────────────────────┐
│                    Next.js 16 API Routes                            │
│  ┌───────────────┐ ┌────────────────┐ ┌──────────────────────────┐ │
│  │ /process-     │ │ /compliance-   │ │ /chat (streamText)       │ │
│  │  meeting      │ │  check         │ │ /transcribe (multimodal) │ │
│  │ (genObject)   │ │ (genObject)    │ │                          │ │
│  └───────┬───────┘ └───────┬────────┘ └────────────┬─────────────┘ │
│          │                 │                        │               │
│  ┌───────┴─────────────────┴────────────────────────┴─────────────┐ │
│  │            Provider Factory (auto-detect model)                │ │
│  │         @ai-sdk/google  |  @ai-sdk/openai                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                     Supabase (PostgreSQL)                           │
│  ┌─────────┐ ┌──────────┐ ┌───────────────┐ ┌───────┐ ┌─────────┐ │
│  │ clients │ │ meetings │ │meeting_outputs│ │ tasks │ │complianc│ │
│  │         │ │          │ │               │ │       │ │e_flags  │ │
│  └─────────┘ └──────────┘ └───────────────┘ └───────┘ └─────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Realtime Broadcast (WebRTC Signaling)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router, Turbopack) | 16.1.6 |
| **Language** | TypeScript | 5.x |
| **UI Library** | React | 19.2.3 |
| **Styling** | Tailwind CSS v4 | 4.x |
| **Component Library** | shadcn/ui (new-york style, stone base) | latest |
| **Icons** | Lucide React | 0.563 |
| **Database** | Supabase (PostgreSQL) | `@supabase/supabase-js` 2.95 |
| **Server-Side Auth Utils** | `@supabase/ssr` | 0.8 |
| **AI SDK** | Vercel AI SDK | 6.0 |
| **AI Providers** | `@ai-sdk/google`, `@ai-sdk/openai` | 3.x |
| **Schema Validation** | Zod | 4.3 |
| **Theming** | next-themes | 0.4 |
| **Notifications** | Sonner | 2.x |
| **Command Palette** | cmdk | 1.1 |
| **Real-time** | Supabase Realtime Broadcast | built-in |

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm
- A Supabase project with the schema applied (see [Database Schema](#database-schema))

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

No AI API keys are stored server-side. Users configure their own keys via the Settings page (BYOK pattern). Keys are persisted in `localStorage` only and passed per-request in the POST body — they never touch the server's environment or database.

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app redirects to `/dashboard`.

---

## Project Structure

```
src/
├── app/
│   ├── api/ai/
│   │   ├── chat/route.ts              # Streaming AI chat with Supabase context injection
│   │   ├── compliance-check/route.ts  # FINRA/SEC compliance scanning via generateObject
│   │   ├── process-meeting/route.ts   # Meeting transcript → structured output pipeline
│   │   └── transcribe/route.ts        # Multimodal audio transcription + text extraction
│   ├── dashboard/
│   │   ├── page.tsx                   # Server Component — KPI overview, compliance alerts
│   │   ├── chat/page.tsx              # Client Component — streaming AI chat interface
│   │   ├── clients/
│   │   │   ├── page.tsx               # Server Component — client list with AUM/risk badges
│   │   │   └── [id]/page.tsx          # Server Component — client detail with meetings/tasks
│   │   ├── meetings/
│   │   │   ├── new/page.tsx           # Client Component — 4-mode meeting processing hub
│   │   │   └── [id]/page.tsx          # Client Component — meeting workbench with approval flow
│   │   ├── settings/page.tsx          # Client Component — BYOK provider/key/model config
│   │   └── layout.tsx                 # Dashboard shell — sidebar + header
│   ├── meeting/[roomId]/page.tsx      # WebRTC peer-to-peer online meeting room
│   └── layout.tsx                     # Root layout — theme provider, toaster, tooltip provider
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx            # Collapsible sidebar with navigation
│   │   └── header.tsx                 # Top bar — API key status, theme toggle
│   ├── meeting/
│   │   ├── audio-recorder.tsx         # MediaRecorder UI with live waveform visualization
│   │   ├── file-upload-zone.tsx       # Drag-and-drop file upload with base64 encoding
│   │   └── processing-pipeline.tsx    # Animated step-by-step pipeline visualization
│   ├── providers/
│   │   └── theme-provider.tsx         # next-themes wrapper
│   └── ui/                            # 21 shadcn/ui components (card, badge, dialog, etc.)
├── data/
│   └── sample-transcripts.ts          # Pre-built demo transcripts for quick testing
├── hooks/
│   ├── use-api-key.ts                 # BYOK key/model/provider state (localStorage-backed)
│   ├── use-audio-recorder.ts          # MediaRecorder + Web Audio API (waveform, pause/resume)
│   ├── use-mobile.ts                  # Viewport breakpoint detection
│   └── use-webrtc-meeting.ts          # Full WebRTC lifecycle (ICE, SDP, Supabase signaling)
├── lib/
│   ├── ai/
│   │   ├── models.ts                  # Dynamic model fetching (Google + OpenAI list endpoints)
│   │   ├── prompts.ts                 # Domain-specific prompt templates (meeting, compliance, chat)
│   │   ├── provider.ts               # Provider factory + unified error parser
│   │   └── schemas.ts                # Zod schemas for structured AI output
│   ├── supabase/
│   │   ├── client.ts                  # Browser Supabase client (createBrowserClient)
│   │   └── server.ts                  # Server Supabase client (createServerClient + cookies)
│   ├── utils/
│   │   ├── formatters.ts             # Currency, date, relative time formatters
│   │   └── pii-redaction.ts          # Regex-based PII detection and redaction engine
│   ├── constants.ts                   # App constants, provider config, color maps
│   └── utils.ts                       # Tailwind cn() utility
└── types/
    └── database.ts                    # TypeScript interfaces matching Supabase schema
```

---

## Feature Breakdown

### 1. Meeting Processing Hub

Four distinct input modes, each feeding into the same AI analysis pipeline:

| Mode | Implementation | Details |
|---|---|---|
| **Paste** | Direct textarea input | Includes sample transcript loader for demos |
| **Record** | `MediaRecorder` + Web Audio API | Live waveform visualization via `AnalyserNode`, pause/resume support |
| **Upload Audio** | Drag-and-drop + base64 encoding | MP3, WAV, M4A, WebM, OGG — up to 20MB; sent to Gemini multimodal |
| **Upload Notes** | Text file extraction | TXT, Markdown, CSV — up to 5MB; decoded from base64 server-side |

The processing pipeline executes the following steps sequentially, with real-time animated status feedback:

1. **Upload / Extraction** — File reading or recording preparation
2. **AI Transcription** — Multimodal audio-to-text via `generateText` (audio modes only)
3. **PII Redaction** — Client-side regex scanning before any LLM call
4. **AI Analysis** — `generateObject` with Zod schema enforcement → summary, key topics, tasks, email draft
5. **Compliance Scan** — Separate `generateObject` call scanning the email draft for FINRA/SEC violations
6. **Persistence** — Meeting record, output, tasks, and compliance flags written to Supabase

### 2. Meeting Workbench

A three-column review interface for processed meetings:

- **Column 1**: Original transcript with PII redaction overlay
- **Column 2**: AI-generated summary, key topics (badge list), and extracted action items with priority/due date
- **Column 3**: Editable email draft with inline compliance flag highlighting (wavy underline + tooltip), resolve workflow, and approval gate

High-severity compliance flags block the approval action until resolved.

### 3. AI Chat

Streaming chat interface backed by `streamText` from the Vercel AI SDK. On each request, the server route builds a context string by querying Supabase for:

- Full client book (name, AUM, risk tolerance, status, notes)
- Last 10 meetings (title, client, status, date)
- All pending tasks (description, priority, due date, client)

This context is injected into the system prompt, enabling natural-language queries like "Which clients have a Conservative risk profile?" or "What are the pending tasks for this week?"

Mid-stream error handling catches quota/rate-limit errors and surfaces them inline with `[STREAM_ERROR]` markers.

### 4. Compliance Sentinel

Automated FINRA and SEC compliance scanning on all AI-generated client-facing communications. Detects:

- **Promissory language** — statements implying guaranteed returns
- **Guarantees** — explicit or implied performance guarantees
- **Suitability issues** — recommendations misaligned with client risk tolerance
- **Misleading statements** — inaccurate risk/fee/outcome representations
- **Unauthorized promises** — commitments beyond advisor authority

Each flag includes: exact flagged substring, risk category, severity (high/medium/low), explanation, and suggested fix. Flags are stored in Supabase and linked to the meeting output for audit trail.

### 5. Online Meeting Rooms (WebRTC)

Peer-to-peer audio rooms using WebRTC with Supabase Realtime Broadcast for signaling:

- **STUN servers**: Google public STUN for NAT traversal
- **Signaling**: Supabase Realtime channel broadcast for SDP offer/answer and ICE candidate exchange
- **Mixed recording**: `AudioContext` mixes local + remote streams into a single `MediaStreamAudioDestinationNode` for unified recording
- **Flow**: Recording → sessionStorage → redirect to Meeting Processing Hub → automatic AI transcription

### 6. BYOK (Bring Your Own Key) Architecture

- API keys stored exclusively in `localStorage` — never persisted server-side
- Keys passed in the POST body to API routes, used for a single request, then discarded
- Provider auto-detection from model name prefix (`gemini-*` → Google, else → OpenAI)
- Dynamic model list fetching from provider APIs with live validation
- Unified error handling via `parseAIError()` — maps quota, rate-limit, invalid key, and model-not-found errors to user-friendly messages

---

## AI Pipeline Architecture

All AI operations use the **Vercel AI SDK v6** with Zod schema enforcement:

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│ API Route   │────▶│ Provider     │────▶│ Google Gemini  │
│ (Next.js)   │     │ Factory      │     │ or OpenAI      │
│             │     │              │     │                │
│ - apiKey    │     │ detectProv() │     │ generateObject │
│ - model     │     │ createAI()   │     │ streamText     │
│ - payload   │     │              │     │ generateText   │
└─────────────┘     └──────────────┘     └────────────────┘
```

### Structured Output with Zod

The `MeetingOutputSchema` enforces:

```typescript
{
  summary: string,           // 2-3 paragraph professional summary
  key_topics: string[],      // 3-6 concise topic labels
  tasks: [{
    description: string,     // Actionable task description
    priority: "high" | "medium" | "low",
    due_date_suggestion: string | null  // ISO date or null
  }],
  email_draft: string        // Professional follow-up email
}
```

The `ComplianceFlagSchema` enforces:

```typescript
{
  flags: [{
    flagged_text: string,    // Exact problematic substring
    risk_category: "Promissory" | "Guarantee" | "Suitability" | "Misleading" | "Unauthorized",
    severity: "high" | "medium" | "low",
    explanation: string      // Why it's a risk + suggested fix
  }],
  overall_risk_level: "clean" | "low" | "medium" | "high"
}
```

### Error Handling

Every AI route uses `parseAIError()` which normalizes errors across providers:

| Error Class | Detection | HTTP Status | User Message |
|---|---|---|---|
| Quota exceeded | `429`, `resource_exhausted`, `insufficient_quota` | 402 | Switch model or wait |
| Invalid API key | `invalid_api_key`, `api_key_invalid` | 401 | Check Settings |
| Model not found | `model_not_found`, `not found` | 500 | Try different model |
| Generic | Fallback | 500 | Raw error message |

---

## Database Schema

Six tables with foreign key relationships enforced at the database level:

```
clients (5 seeded)
├── id (uuid, PK)
├── name, email, phone
├── risk_tolerance (CHECK: Conservative | Balanced | Growth | Aggressive)
├── aum_value (numeric)
├── status (CHECK: Active | Prospect | Inactive)
├── notes, created_at, updated_at
│
├──< meetings (FK: client_id)
│   ├── id (uuid, PK)
│   ├── title, transcript_text, transcript_redacted
│   ├── pii_entities (jsonb)
│   ├── source_type (CHECK: paste | audio_upload | file_upload)
│   ├── source_file_name
│   ├── status (CHECK: processing | review_needed | approved | completed)
│   │
│   ├──< meeting_outputs (FK: meeting_id, UNIQUE)
│   │   ├── summary_text, key_topics (jsonb)
│   │   ├── client_email_draft
│   │   ├── is_approved, approved_at
│   │   │
│   │   └──< compliance_flags (FK: meeting_output_id)
│   │       ├── flagged_text, risk_category, severity
│   │       ├── explanation, is_resolved, advisor_comment
│   │
│   └──< tasks (FK: meeting_id, client_id)
│       ├── description, due_date, priority, status
│
└── chat_messages
    ├── role (CHECK: user | assistant | system)
    ├── content, metadata (jsonb)
```

All primary keys use `gen_random_uuid()`. Timestamps default to `now()`. Check constraints enforce enum values at the database level.

---

## PII Redaction Engine

Client-side PII detection runs **before** any transcript reaches an LLM endpoint. The engine uses a multi-pattern regex approach:

| PII Type | Pattern | Replacement |
|---|---|---|
| SSN | `\d{3}-?\s?\d{2}-?\s?\d{4}` | `[REDACTED_SSN]` |
| SSN Partial | `ending in \d{4}`, `last four \d{4}` | `[REDACTED_SSN_PARTIAL]` |
| Email | Standard email regex | `[REDACTED_EMAIL]` |
| Phone | US phone with optional country code | `[REDACTED_PHONE]` |
| Account Number | 9-12 digit sequences | `[REDACTED_ACCOUNT]` |

The engine handles:
- **Overlap deduplication** — prevents double-redacting overlapping matches
- **Offset tracking** — correctly adjusts indices after each replacement
- **Entity list** — returns full before/after entity list for the PII Vault UI display
- **Summary generation** — human-readable count by type ("2 phones, 1 SSN")

Both the original and redacted transcripts are stored in Supabase for audit purposes.

---

## WebRTC Meeting Rooms

### Signaling Architecture

```
Host Browser                 Supabase Realtime              Guest Browser
     │                       Broadcast Channel                    │
     │──── join(roomId) ────────────▶│                            │
     │                               │◀──── join(roomId) ────────│
     │                               │                            │
     │◀──── peer-joined ────────────│──── peer-joined ──────────▶│
     │                               │                            │
     │──── SDP offer ───────────────▶│──── SDP offer ───────────▶│
     │                               │                            │
     │◀──── SDP answer ─────────────│◀──── SDP answer ──────────│
     │                               │                            │
     │◀───▶ ICE candidates ◀───────▶│◀───▶ ICE candidates ◀────▶│
     │                               │                            │
     │═══════════ P2P Audio Stream (WebRTC) ═══════════════════│
```

- ICE candidate queuing until remote description is set
- Mixed-audio recording via `AudioContext` → `MediaStreamAudioDestinationNode`
- Automatic handoff to the Meeting Processing Hub via `sessionStorage`

---

## BYOK Provider Architecture

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ Settings UI  │────▶│ fetchModels()     │────▶│ Google/OpenAI    │
│              │     │                   │     │ List Endpoints   │
│ Provider     │     │ google: /v1beta/  │     │                  │
│ Picker       │     │   models?key=...  │     │ Returns model    │
│              │     │ openai: /v1/      │     │ catalog          │
│ Key Input    │     │   models          │     │                  │
│              │     │   Authorization:  │     │                  │
│ Model Select │     │   Bearer ...      │     │                  │
└──────────────┘     └───────────────────┘     └──────────────────┘
```

Google models are filtered to `generateContent`-capable models, sorted by free-tier availability. OpenAI models are filtered to chat-capable prefixes (`gpt-4`, `gpt-3.5`, `o1`, `o3`, `o4`), excluding audio/realtime/transcribe variants.

---

## Automated Testing

### TestSprite Test Suite

A comprehensive frontend test suite was generated and executed using [TestSprite](https://testsprite.com), covering 18 test cases across all major user flows:

| Test ID | Coverage Area | Priority |
|---|---|---|
| TC001 | Dashboard overview load, KPI cards, data accuracy | High |
| TC002 | Client list display, profile navigation, detail view | High |
| TC003 | Meeting processing — paste transcript flow | High |
| TC006 | Meeting processing — upload notes file flow | High |
| TC007 | Meeting workbench display, navigation, approval workflow | High |
| TC008 | Online meeting room — connection and audio controls | High |
| TC010 | AI chat — query/response, streaming, error handling | High |
| TC011 | BYOK API key input and validation | High |
| TC012 | PII vault — detection and redaction accuracy | High |
| TC013 | Compliance sentinel — risk detection scenarios | High |
| TC014 | BYOK model selection — fetch and dropdown population | Medium |
| TC015 | Dark/light theme toggle and persistence | Medium |
| TC018 | BYOK key storage security, isolation, and UI masking | High |

Test artifacts are stored in `testsprite_tests/` including:
- Individual test scripts (Python/Selenium-based)
- Structured test plan (`testsprite_frontend_test_plan.json`)
- Standardized PRD (`standard_prd.json`)

### Testing Strategy

The test suite validates:
- **Functional correctness** — each feature works end-to-end as designed
- **Data integrity** — database reads/writes reflect correctly in the UI
- **Error handling** — quota errors, invalid keys, empty states all handled gracefully
- **Security** — API keys masked in UI, not leaked to server environment, isolated per provider
- **Accessibility** — theme persistence, responsive layout, keyboard navigation

---

## Integration Roadmap

The current architecture is designed to support real integrations via Next.js API routes as middleware. Each integration below has a verified public API and can be implemented as an additional route handler without modifying the existing pipeline.

### CRM Integrations

| Platform | API | Integration Path |
|---|---|---|
| **Wealthbox CRM** | [REST API](https://dev.wealthbox.com/) — full read/write access to contacts, tasks, events, notes | Sync `clients` table bi-directionally; push AI-generated tasks and meeting notes to Wealthbox activity feed. OAuth 2.0 authentication. |
| **Redtail CRM** | [REST API](https://corporate.redtailtechnology.com/api/) — 100+ endpoints for contacts, activities, workflows | Sync client profiles; auto-create Redtail activities from processed meetings. API key authentication. |
| **Salesforce Financial Services Cloud** | [Wealth Management API](https://developer.salesforce.com/docs/industries/fsc/references/fsc_wealth_mgmt) — accounts, financial goals, referrals | Deep integration with financial planning data; push meeting summaries as Case notes. OAuth 2.0 + connected app. |

**Implementation approach**: Create `/api/integrations/[provider]/sync` route handlers. Store OAuth tokens in Supabase (encrypted) per user. Use Supabase Edge Functions for webhook receivers.

### Custodian Integrations

| Platform | API | Integration Path |
|---|---|---|
| **Charles Schwab** | [Schwab Developer Portal](https://developer.schwab.com/) + [OpenView Gateway](https://advisorservices.schwab.com/managing-your-business/tech-integration/api-integration) — account data, positions, transactions | Pull real-time AUM and position data into client profiles; enrich meeting context with current portfolio state. OAuth 2.0. |
| **Fidelity** | [Integration Xchange](https://integrationxchange.wealthscape.com/) + [Wealthscape APIs](https://clearingcustody.fidelity.com/solutions/technology/brokerage) — brokerage platform with account onboarding, reporting | Sync portfolio data, account balances; attach custodial data to meeting transcripts for richer AI analysis. Partner API program. |

**Implementation approach**: Add a `portfolio_snapshots` table in Supabase. Schedule periodic syncs via Supabase `pg_cron` or Edge Functions. Feed portfolio data into meeting processing prompts for more contextually aware AI output.

### Meeting & Communication Platform Integrations

| Platform | API | Integration Path |
|---|---|---|
| **Zoom** | [Meeting APIs](https://developers.zoom.us/docs/api/meetings/) + [OAuth 2.0](https://developers.zoom.us/docs/integrations/oauth/) — meeting management, cloud recordings, transcripts | Auto-import cloud recording transcripts post-meeting; create scheduled meetings from AI-generated tasks. OAuth 2.0 with scopes for `recording:read`, `meeting:write`. |
| **Google Meet** | [Meet REST API](https://developers.google.com/workspace/meet/api/guides/overview) — meeting spaces, recordings, transcript entries | Fetch post-meeting recordings and transcripts; create meeting spaces from the app. Google Workspace OAuth 2.0. |
| **Microsoft Teams / Outlook** | [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) — calendar events, emails, Teams meetings | Send approved email drafts directly via Graph API; sync calendar events with meetings table; import Teams meeting transcripts. OAuth 2.0 with `Mail.Send`, `Calendars.ReadWrite` scopes. |

**Implementation approach**: Add an `/api/integrations/calendar/sync` route. Store OAuth refresh tokens per user in Supabase. For email sending, add an "Send Email" button on the meeting workbench that calls Graph API or Gmail API with the approved draft.

### Document & Storage Integrations

| Platform | API | Integration Path |
|---|---|---|
| **SharePoint / OneDrive** | [Microsoft Graph Files API](https://learn.microsoft.com/en-us/graph/api/resources/onedrive) | Auto-archive approved meeting outputs (summary PDF, email draft) to client folders in SharePoint. |
| **Google Drive** | [Drive API v3](https://developers.google.com/drive/api/guides/about-sdk) | Export meeting outputs as Google Docs; organize by client folder structure. |

### How Integrations Fit the Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Current Architecture                     │
│                                                              │
│  Meeting Input ──▶ PII Redaction ──▶ AI Pipeline ──▶ Output │
│                                                              │
│                     ▼ (New Integration Layer) ▼              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐ │
│  │ CRM Sync │  │Custodian │  │ Calendar  │  │ Document   │ │
│  │ (Wealthb │  │ Data     │  │ + Email   │  │ Archive    │ │
│  │  ox/RT/  │  │ (Schwab/ │  │ (Zoom/    │  │ (SP/       │ │
│  │  SF)     │  │  Fidelity│  │  Meet/    │  │  GDrive)   │ │
│  │          │  │          │  │  Graph)   │  │            │ │
│  └──────────┘  └──────────┘  └───────────┘  └────────────┘ │
│         │            │             │              │          │
│         └────────────┴─────────────┴──────────────┘          │
│                           │                                  │
│                    /api/integrations/*                        │
│                    (Next.js Route Handlers)                   │
└─────────────────────────────────────────────────────────────┘
```

Each integration is isolated in its own route handler, authenticated via stored OAuth tokens, and communicates with the existing Supabase tables. No modifications to the core AI pipeline are required — integrations extend the system at the input (data ingestion) and output (data export) layers.

---

## CI/CD Pipeline Strategy

The current stack (Next.js + Supabase + Netlify) supports a robust CI/CD pipeline using GitHub Actions:

### Proposed Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

  deploy-preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: .next
          production-deploy: false
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: .next
          production-deploy: true
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  migrate-database:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: deploy-production
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
      - run: supabase db push
```

### Pipeline Capabilities

| Stage | Tool | What It Validates |
|---|---|---|
| **Lint** | ESLint 9 | Code style, import order, unused variables |
| **Type Check** | `tsc --noEmit` | Full TypeScript compilation without output |
| **Unit Tests** | Vitest (recommended addition) | Utility functions, PII redaction, formatters |
| **E2E Tests** | Playwright / TestSprite | Full user flow validation against running app |
| **Preview Deploy** | Netlify Deploy Previews | Per-PR preview URLs for manual QA |
| **Production Deploy** | Netlify | Auto-deploy on `main` merge |
| **DB Migrations** | Supabase CLI | Schema changes applied post-deploy |

### Supabase Branching for PR Environments

Supabase supports [database branching](https://supabase.com/docs/guides/deployment/branching) — each PR can get its own ephemeral Postgres instance with all migrations applied. This enables:
- Isolated testing per feature branch
- Schema migration validation before production
- Safe parallel development without data conflicts

---

## Scaling to Production with Authentication

The application is architecturally prepared for multi-user production use. The following changes would be required:

### 1. Supabase Auth Integration

```
Current:  Anonymous access → single-user demo
Target:   Supabase Auth → multi-user with RLS
```

**Implementation steps**:

1. Enable Supabase Auth with email/password + OAuth providers (Google, Microsoft)
2. Add a `profiles` table linked to `auth.users`
3. Add a `user_id` column to `clients`, `meetings`, `tasks`, `chat_messages`
4. Add Next.js middleware for session management (Supabase already has `@supabase/ssr` installed)
5. Enable Row Level Security (RLS) on all tables:

```sql
-- Example: Users can only see their own clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id);
```

### 2. Role-Based Access Control

```
advisor  → Full access to their own clients, meetings, tasks
manager  → Read access to all advisors under their team
admin    → Full platform access, user management
compliance_officer → Read-only access to all compliance flags
```

Implementable via a `user_roles` table and conditional RLS policies referencing `auth.jwt() ->> 'role'`.

### 3. API Key Vault Migration

```
Current:  localStorage (client-only)
Target:   Supabase Vault (encrypted server-side storage)
```

[Supabase Vault](https://supabase.com/docs/guides/database/vault) provides column-level encryption using `pgsodium`. API keys would be encrypted at rest and decrypted only during API route execution — eliminating client-side key storage entirely.

### 4. Additional Production Considerations

| Concern | Solution |
|---|---|
| **Rate limiting** | Supabase Edge Functions or Next.js middleware with `upstash/ratelimit` |
| **Audit logging** | Postgres triggers on all write operations → `audit_log` table |
| **File storage** | Supabase Storage for meeting recordings, exported PDFs |
| **Email delivery** | Resend or SendGrid API for sending approved email drafts |
| **Search** | Supabase Full-Text Search or `pg_trgm` for client/meeting search |
| **Analytics** | Supabase `pg_stat_statements` + custom dashboard queries |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint 9 |

---

## License

This project is a technical demonstration. Not licensed for commercial use without permission.
