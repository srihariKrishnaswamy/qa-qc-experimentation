# QA-QC Frontend

Next.js 14 app for uploading specbook PDFs and viewing generated rules. Supports both a synchronous “quick ingestion” flow and an async presign/upload flow with live rules via AppSync events.

## How to run

**Prerequisites:** Node.js 18+

```bash
# From the frontend folder
npm install
npm run dev
```

The app is available at **http://localhost:3000**.

### Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start the dev server (port 3000) |
| `npm run build`| Production build               |
| `npm run start`| Run the production build       |
| `npm run lint` | Run ESLint                     |

---

## Project structure

```
frontend/
├── app/                    # Next.js App Router (routes + layout)
├── components/              # Reusable React components
├── public/                  # Static assets (sample JSON for testing)
├── package.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── next-env.d.ts
```

---

## Routes

| Path | Purpose |
|------|--------|
| `/` | Home – quick-ingestion upload (sync; small PDFs only). |
| `/listener` | Presign upload – upload PDF via S3 presign, then click **Next** to go to rules. |
| `/listener/rules` | Generated rules – from a real upload (`?s3Key=...`) or sample data (`?sample=1` or `?sample=02`). |

---

## File overview

### App (`app/`)

| File | Purpose |
|------|--------|
| **layout.tsx** | Root layout (metadata, fonts, global wrapper). |
| **page.tsx** | Home route (`/`). Renders the quick-ingestion upload component. |
| **globals.css** | Global styles and Tailwind imports. |
| **listener/page.tsx** | Listener route (`/listener`). Renders the presign upload component and a “Test with sample rules” link. |
| **listener/rules/page.tsx** | Rules route (`/listener/rules`). Wraps `ListenerRulesView` in Suspense and exports the page. |

### Components (`components/`)

| File | Purpose |
|------|--------|
| **UploadSpecbook.tsx** | Quick-ingestion upload: sends a small PDF directly to the API and shows returned rules (sync). Used on `/`. |
| **UploadSpecbookAndListen.tsx** | Presign upload: gets presigned URL, uploads PDF to S3, subscribes to AppSync events for rules, stores `s3Key` and rules; **Next** navigates to `/listener/rules`. Used on `/listener`. |
| **ListenerRulesView.tsx** | Full rules page logic: reads `s3Key` or `sample` from URL, loads rules from sessionStorage or fetches sample JSON or subscribes to AppSync events; shows loading/processing/error and renders `GeneratedRulesDisplay`. |
| **GeneratedRulesDisplay.tsx** | Presentational rules UI: renders rules as rounded gray cards with subtitle (description/rule) and body (requirements/shall_statement); supports both trade-keyed (01) and flat-array (02) JSON formats. |

### Public (`public/`)

| File | Purpose |
|------|--------|
| **sample-rules.json** | Sample rules in trade-keyed format (e.g. steel, carpenter). Used when opening `/listener/rules?sample=1`. |
| **sample-rules-02.json** | Sample rules in flat array format (rule + shall_statement). Used when opening `/listener/rules?sample=02`. |

### Config and types

| File | Purpose |
|------|--------|
| **package.json** | Dependencies and npm scripts. |
| **next.config.js** | Next.js configuration. |
| **tailwind.config.ts** | Tailwind CSS theme and content paths. |
| **postcss.config.js** | PostCSS (Tailwind). |
| **tsconfig.json** | TypeScript compiler options. |
| **next-env.d.ts** | Next.js TypeScript declarations. |

---

## Testing without AWS

You can test the rules page using sample JSON only (no backend):

- Open **http://localhost:3000/listener** and click **“Test with sample rules”**, or
- Open **http://localhost:3000/listener/rules?sample=1** (trade-keyed) or **?sample=02** (flat list).

Data is loaded from `public/sample-rules.json` and `public/sample-rules-02.json`.

---

## Environment variables (optional)

Create `.env.local` in the frontend folder to override defaults:

| Variable | Purpose |
|---------|--------|
| `NEXT_PUBLIC_INGEST_API_URL` | Base URL for presign and quick-ingestion APIs. |
| `NEXT_PUBLIC_EVENTS_HTTP_URL` | AppSync Events HTTP endpoint. |
| `NEXT_PUBLIC_EVENTS_API_KEY` | AppSync API key. |
| `NEXT_PUBLIC_EVENTS_CHANNEL` | Event channel (default: `specbook/processed`). |
| `NEXT_PUBLIC_EVENTS_REGION` | AWS region (default: `us-west-2`). |

All of these have fallbacks in code; set them when pointing at your own backend.
