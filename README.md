# LMS-AI: Production-Grade Learning Management System with AI Tutor

An AI-augmented Learning Management System built for students, instructors, and administrators. The platform combines enterprise LMS workflows (course authoring, module & lecture management, progress tracking, quizzes, assignment rubrics, badges, streaks, and certificates) with an embedded **RAG (Retrieval-Augmented Generation) AI Tutor** that provides grounded answers with clickable lecture timestamp citations.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Responsive SPA with Student, Instructor, and Admin views |
| **Core LMS Backend** | Node.js, Express, TypeScript, pg, Redis, Multer | REST API, JWT access & refresh tokens, RBAC middleware |
| **AI Service & RAG** | Python 3.13, FastAPI, Uvicorn, NumPy | Vector retrieval, text chunking, embedding generation, LLM client |
| **Primary Database** | PostgreSQL 16 | Relational persistence, transactions, and foreign key integrity |
| **Vector Database** | `pgvector` extension | High-dimensional (1536-dim) vector indexing & cosine similarity search |
| **Cache & Limiting** | Redis 7 Alpine | Rate limiting, session caching, and background queues |
| **Storage** | Local disk / S3-compatible | Video lectures, course slides, assignment submissions, attachments |
| **Containerization** | Docker & Docker Compose | Multi-container local development and deployment parity |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure you have the following installed:
- Docker & Docker Compose
- Node.js (v18+) & npm
- Python (v3.10+)

### 2. Configure Environment
Clone the repository and copy the environment configuration:
```bash
cp .env.example .env
```

### 3. Start Infrastructure (PostgreSQL + pgvector, Redis)
Start the vector-enabled PostgreSQL database and Redis:
```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Database Migrations & Seed Data
Apply database schema and populate realistic courses, lectures, quizzes, and demo personas:
```bash
cd backend
npm install
npm run migrate
npm run seed
cd ..
```

### 5. Start Backend, AI Service, and Frontend Locally

#### Terminal 1 — Backend (Port 5000)
```bash
cd backend
npm run dev
```

#### Terminal 2 — AI Service (Port 8000)
```bash
cd ai-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 3 — Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

The frontend will be accessible at: **http://localhost:5173**

---

## 👥 Demo Accounts & Role Personas

All test accounts use the password: `Password123!`

| Role | Name | Email | Capabilities |
| :--- | :--- | :--- | :--- |
| **Student** | Alex Johnson | `student@lms.local` | Browse catalog, enroll, watch lectures, take quizzes, submit assignments, consult AI Tutor with citations, view flashcards & study plan |
| **Instructor** | Dr. Priya Sharma | `instructor@lms.local` | Author courses & lectures, transcript editor, auto-generate AI quizzes, grade student submissions with rubric feedback |
| **Admin** | Admin Supervisor | `admin@lms.local` | Review & approve/reject submitted courses, manage user roles & suspensions, inspect platform analytics & audit logs |

> **Pro-Tip:** The frontend includes a **one-click demo persona switcher** directly in the top navigation bar and login screen for instantaneous role testing.

---

## 📡 Core API Surface (`/api/v1`)

### Authentication & Profiles
- `POST /api/v1/auth/register` — Register student or instructor
- `POST /api/v1/auth/login` — Returns access (15m) and refresh (7d) tokens
- `POST /api/v1/auth/refresh` — Generates refreshed access token
- `GET /api/v1/auth/me` — Authenticated profile, streak status, and earned badges

### Course Catalog & Learning Player
- `GET /api/v1/courses` — Search and filter catalog by category & difficulty
- `GET /api/v1/courses/:id` — Course curriculum details with modules & lectures
- `POST /api/v1/courses` — Author course (`instructor` / `admin`)
- `POST /api/v1/courses/:id/enroll` — Student enrollment
- `POST /api/v1/lectures/:id/progress` — Track watched time & completion
- `POST /api/v1/lectures/:id/notes` — Timestamped lecture notes
- `POST /api/v1/lectures/:id/bookmarks` — Timestamped bookmarks

### AI Tutor & RAG Engine
- `POST /api/v1/ai/chat/sessions` — Initialize course-scoped tutor session
- `POST /api/v1/ai/chat/sessions/:id/messages` — Grounded Q&A with lecture source citations
- `PUT /api/v1/ai/chat/sessions/:id/mode` — Switch explanation mode (`beginner`, `intermediate`, `advanced`)
- `POST /api/v1/ai/lectures/:id/summarize` — Generate concise summary & key takeaways
- `POST /api/v1/ai/lectures/:id/generate-quiz` — Auto-generate assessment questions from lecture transcript
- `POST /api/v1/ai/modules/:id/flashcards` — Generate active recall flashcards
- `POST /api/v1/ai/study-plan` — Personalized learning roadmap based on student progress

### Quizzes & Assignments
- `GET /api/v1/quizzes/courses/:id/quizzes` — Course assessments list
- `POST /api/v1/attempts/:id/submit` — Submit quiz attempt, auto-grade, return answer review
- `POST /api/v1/assignments/:id/submit` — Student code / written submission
- `PUT /api/v1/submissions/:id/grade` — Instructor grading with rubric criteria & feedback

### Admin & Governance
- `GET /api/v1/admin/analytics/overview` — Platform KPI metrics & distribution
- `GET /api/v1/admin/courses/pending` — Approval queue for unapproved courses
- `POST /api/v1/courses/:id/approve` — Approve or reject with feedback
- `PUT /api/v1/admin/users/:id/role` — Promote/demote user roles
- `PUT /api/v1/admin/users/:id/suspend` — Deactivate / reactivate user access

---

## 🔒 Security & Performance Features
- **Stateless JWT Tokens**: 15-minute access token lifespan with secure 7-day refresh tokens.
- **Role-Based Access Control (RBAC)**: Strict role barriers verified on every protected endpoint.
- **Tenant & Course Vector Isolation**: RAG queries are explicitly filtered by `course_id` to prevent cross-course information leakage.
- **Redis Rate Limiting**: Token-bucket rate limiting protecting auth and AI endpoints.
- **Offline Development Parity**: Deterministic semantic vector hashing and mock generator allow full end-to-end operation locally without external API keys.

---

## 🛑 How to Stop Services
```bash
# Stop Docker infrastructure
docker compose -f infra/docker-compose.yml down
```
