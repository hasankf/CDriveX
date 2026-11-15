# CDriveX

A full-stack cloud file manager and AI document assistant. Upload files, organize folders, and chat with your documents using Retrieval-Augmented Generation (RAG) powered by Google Gemini and Supabase `pgvector`.

**Live Demo:** [https://cdrivexfrontend.vercel.app](https://cdrivexfrontend.vercel.app)
---

## Features

- **Cloud File & Folder Management:** Create nested folders, upload files to Supabase Storage, browse directories, and manage assets through a clean web interface.
- **Automated Document Indexing:** Extracts text from uploaded documents, splits content into chunks, and stores vector embeddings in PostgreSQL via `pgvector`.
- **RAG AI Assistant:** Ask natural-language questions across your uploaded files in an interactive AI drawer backed by semantic vector search and Google Gemini.
- **Authentication & Isolation:** User authentication and per-user data isolation powered by JWT and Supabase.
- **Containerized Stack:** Multi-container Docker Compose setup pairing an Nginx reverse proxy with an Alpine Linux Node.js API server.

---

## Tech Stack

- **Frontend:** React, Vite, Nginx (production static serving & `/api` reverse proxy)
- **Backend:** Node.js 22, Express, Prisma ORM
- **Database & Storage:** Supabase (PostgreSQL + `pgvector`, Supabase Storage)
- **AI & Embeddings:** Google Gemini API (`@google/genai`)
- **DevOps & Hosting:** Docker, Docker Compose, Vercel

---

## Architecture

```text
Browser ──► Nginx (:8080) ──┬──► Static React Bundle (/usr/share/nginx/html)
                            └──► /api/* ──► Express API (:3000) ──┬──► Supabase (Auth, Storage, pgvector)
                                                                  └──► Google Gemini API
```

---

## Run Locally with Docker (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Supabase](https://supabase.com/) project (with `pgvector` enabled and a storage bucket configured)
- A [Google Gemini API key](https://aistudio.google.com/)

### Steps

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/CDriveX.git
   cd CDriveX
   ```

2. **Configure environment variables:**
   Copy the example template and fill in your Supabase and Gemini credentials:
   ```bash
   cp backend/.env.example
   backend/.env
   ```

3. **Build and start the containers:**
   ```bash
   docker compose up --build
   ```

4. **Open the app:**
   Visit `http://localhost:8080` in your browser.

5. **Stop the containers when finished:**
   ```bash
   docker compose down
   ```

---

## Run Locally from Source (Without Docker)

### Prerequisites
- Node.js **22+** and npm

### 1. Start the Backend
```bash
cd backend
cp .env.example .env   # Add your credentials
npm install
npx prisma generate
node app.js
```
The API server starts on `http://localhost:3000`.

### 2. Start the Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
The frontend dev server starts on `http://localhost:5173`.

---

## Project Structure

```text
CDriveX/
├── backend/
│   ├── prisma/              # Prisma schema & migrations
│   ├── routes/              # Express API routes
│   ├── services/            # RAG search, embeddings, & storage services
│   ├── app.js               # Express entry point
│   ├── Dockerfile           # Node 22 Alpine + OpenSSL backend image
│   └── .env.example         # Required environment variable template
├── frontend/
│   ├── public/              # Static assets
│   ├── src/                 # React components & pages
│   ├── nginx.conf           # SPA routing & /api reverse proxy config
│   └── Dockerfile           # Multi-stage Vite build -> Nginx image
└── docker-compose.yml       # Multi-container orchestration
```
