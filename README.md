# Cubot — City University Peshawar AI Assistant

![Cubot](https://img.shields.io/badge/Cubot-CU%20Peshawar-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

**Cubot** is the official AI-powered assistant of City University Peshawar, Pakistan. It is a production-grade RAG (Retrieval-Augmented Generation) system that provides instant answers about admissions, courses, fees, departments, and campus life.

## What is Cubot?

Cubot is an intelligent chatbot built with modern AI technologies to assist prospective and current students, parents, and visitors with their queries about City University Peshawar. Powered by Google Gemini and Pinecone vector search, Cubot delivers accurate, context-aware responses based on the university's official data.

The system is designed with a warm, professional personality — like a senior university staff member who genuinely wants to help. Cubot responds in the same language the user writes in (English or Urdu), making it accessible and friendly for all audiences.

## Tech Stack

| Layer | Technology | Notes |
|-------|-------------|-------|
| Framework | Next.js 14 (App Router) | SSR + SEO |
| Language | TypeScript 5 | strict mode |
| Styling | Tailwind CSS v3 + Framer Motion | Animations |
| Primary LLM | Google Gemini Flash (gemini-1.5-flash) | Streaming responses |
| Fallback LLM | Groq (llama3-70b-8192) | Auto-triggers on Gemini fail |
| Embeddings | Google text-embedding-004 | 768 dimensions |
| Vector Store | Pinecone (serverless) | Namespace per department |
| Rate Limiting | @upstash/ratelimit + Redis | 10 req/min per IP |
| Icons | lucide-react | — |
| Analytics | @vercel/analytics + Speed Insights | Free tier |
| Deployment | Vercel | cubot-cu.vercel.app |

## Prerequisites

- Node.js 18+ and npm
- Pinecone account (free tier)
- Google AI Studio account (for Gemini API key)
- Upstash account (free Redis for rate limiting)
- Groq account (optional, for fallback)

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd cubot-cu
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `GEMINI_API_KEY` — Get from Google AI Studio
- `GROQ_API_KEY` — Get from Groq (optional but recommended)
- `PINECONE_API_KEY` — Get from Pinecone
- `PINECONE_INDEX_NAME` — e.g., cubot-cu
- `PINECONE_DIMENSION` — Must be **768** (critical!)
- `UPSTASH_REDIS_REST_URL` — Get from Upstash
- `UPSTASH_REDIS_REST_TOKEN` — Get from Upstash
- `ADMIN_SECRET` — Generate with: `openssl rand -hex 32`

### 3. Create Pinecone Index

In Pinecone dashboard:
- Create index named `cubot-cu`
- Dimension: **768** (NOT 1536!)
- Metric: cosine

### 4. Add Data

Add `.txt` files to folders under `/data/`:
- `data/general/` — About, admissions, contacts, etc.
- `data/cs_it/` — CS/IT department info
- `data/bba/` — Business admin department
- `data/pharmacy/` — Pharmacy department
- `data/nursing/` — Nursing department

### 5. Run Ingestion

```bash
npm run ingest
```

This embeds your data and uploads to Pinecone. It's idempotent — running twice produces the same result.

### 6. Start Development

```bash
npm run dev
```

Visit http://localhost:3000

## Data Management

All knowledge data lives in the `/data/` folder as `.txt` files. Each department has its own subfolder. The ingestion script reads these files, splits them into chunks, embeds them, and uploads to Pinecone.

To update Cubot's knowledge:
1. Edit or add `.txt` files in `/data/`
2. Run `npm run ingest` again
3. Cubot immediately has updated knowledge

## Deployment to Vercel

1. Push your code to GitHub
2. Connect repo in Vercel dashboard
3. Add all environment variables in Vercel Settings → Environment Variables
4. Deploy

Your free URL will be: `https://cubot-cu.vercel.app`

To add a custom domain later (e.g., `cubot.cu`):
- Go to Vercel Dashboard → Domains → Add Domain
- Update `NEXT_PUBLIC_BASE_URL` to your custom domain
- Zero code changes needed

## Environment Variables Guide

| Variable | Description | Required |
|----------|-------------|----------|
| GEMINI_API_KEY | Google Gemini API key | Yes |
| GROQ_API_KEY | Groq API key for fallback | Optional |
| ENABLE_GROQ_FALLBACK | Set to `true` to enable fallback | Optional |
| PINECONE_API_KEY | Pinecone vector database key | Yes |
| PINECONE_INDEX_NAME | Name of your Pinecone index | Yes |
| PINECONE_DIMENSION | Must be 768 | Yes |
| UPSTASH_REDIS_REST_URL | Upstash Redis REST URL | Yes |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis token | Yes |
| ADMIN_SECRET | Secret for admin endpoints | Yes |
| NEXT_PUBLIC_UNIVERSITY_NAME | Display name | Yes |
| NEXT_PUBLIC_CHATBOT_NAME | Display name | Yes |
| NEXT_PUBLIC_BASE_URL | Public URL for SEO | Yes |

## Architecture Notes

1. **mammoth stays local**: The docx parser mammoth is in devDependencies and only used in `scripts/ingest.ts`. It's never imported in the app API or components, keeping the production bundle small.

2. **768 dimensions**: Google text-embedding-004 outputs 768-dimensional vectors. Your Pinecone index MUST be created with dimension=768 or all vector operations will silently fail.

3. **Streaming**: The chat API returns a ReadableStream for real-time typewriter effect. The frontend reads chunks as they arrive.

4. **Rate limiting**: First operation in the chat API is rate limiting (10 req/min per IP) using Upstash Redis.

5. **Admin security**: The ingest endpoint is protected with a Bearer token check against ADMIN_SECRET.

6. **Singleton clients**: Gemini, Pinecone, and rate limiter are initialized at module scope to avoid repeated initialization in serverless environments.