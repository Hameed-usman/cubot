# Cubot — City University Peshawar AI Assistant

![Cubot](https://img.shields.io/badge/Cubot-CU%20Peshawar-blue)
![Version](https://img.shields.io/badge/version-1.1.0-green)

**Cubot** is the official AI-powered assistant of City University Peshawar, Pakistan. It is a production-grade RAG (Retrieval-Augmented Generation) system that provides instant answers about admissions, courses, fees, departments, and campus life.

## What is Cubot?

Cubot is an intelligent chatbot built with modern AI technologies. It delivers accurate, context-aware responses based on the university's official data stored in Neon PostgreSQL and Pinecone vector database.

## Architecture Overview

1. **Data Layer**: All knowledge is stored in a serverless **Neon PostgreSQL** database.
2. **Admin Panel**: Authorized staff (via **NextAuth.js**) can add/edit knowledge in the `/admin` portal.
3. **Embedding Workflow**: When knowledge is saved, it is simultaneously embedded (using Groq/OpenAI APIs) and upserted into **Pinecone** vector DB, using the Neon DB row ID as the vector ID.
4. **Chat Interface**: User queries are embedded, matched via Pinecone similarity search, and sent to **Groq LLM** to generate conversational, context-aware answers.
5. **Rate Limiting**: **Upstash Redis** protects the chat endpoint (10 req/min/IP).

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Framework | Next.js (App Router) + TypeScript |
| Relational DB | Neon PostgreSQL |
| Vector DB | Pinecone (Serverless) |
| LLM & Embeddings | Groq / Google AI |
| Authentication | NextAuth.js (Credentials Provider) |
| Rate Limiting | Upstash Redis |

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and add your keys:

- `NEON_DATABASE_URL` — Get from [Neon](https://neon.tech)
- `NEXTAUTH_SECRET` — Generate using `openssl rand -base64 32`
- `ADMIN_USERNAME` & `ADMIN_PASSWORD` — Your desired admin credentials
- `PINECONE_API_KEY` & `PINECONE_INDEX_NAME` — Get from Pinecone
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` — Get from Upstash

### 3. Setup Database Schema

Run the script found in `db/schema.sql` inside your Neon SQL Editor to create the `knowledge_entries` table.

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`. To access the admin panel, go to `/admin`.