<div align="center">
  <h1>SmartJobs</h1>
  <p><strong>Real-time AI job aggregator and recommendation engine</strong></p>
  <p>Crawl live tech jobs, deduplicate them with fingerprints and embeddings, parse your resume into structured data, and get explainable matches pushed to you the moment they appear.</p>
  <p>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" /></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" /></a>
    <a href="https://docs.celeryq.dev/"><img src="https://img.shields.io/badge/Celery-37814A?style=flat-square&logo=celery&logoColor=white" alt="Celery" /></a>
    <a href="https://www.rabbitmq.com/"><img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ" /></a>
    <a href="https://www.mongodb.com/"><img src="https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" /></a>
    <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
  </p>
  <p>
    <a href="#features">Features</a> &middot;
    <a href="#architecture">Architecture</a> &middot;
    <a href="#quick-start">Quick start</a> &middot;
    <a href="#configuration">Configuration</a> &middot;
    <a href="#api-reference">API</a> &middot;
    <a href="#testing-and-evaluation">Testing</a> &middot;
    <a href="#known-limitations-and-roadmap">Roadmap</a>
  </p>
</div>

---

## Screenshots

| Dashboard and live notification bell | Ranked recommendations with explanations |
| :---: | :---: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Recommendations](docs/screenshots/recommendations.png) |

| Preferences and match threshold |
| :---: |
| ![Preferences](docs/screenshots/preferences.png) |

A 3-minute guided walkthrough is available in [scripts/demo.md](scripts/demo.md).

---

## Why SmartJobs

Standard job portals frequently present duplicate listings, rely on raw keyword matching, and offer no transparency regarding why a specific job matches a candidate's background. SmartJobs addresses these limitations directly:

- **Unified Catalog**: Postings aggregated across multiple sources are normalized, with redundant entries consolidated rather than duplicated.
- **Explainable Matching**: Every recommended position details its composite match percentage, aligned competencies, missing skill gaps, and a plain-text rationale.
- **Focused Notifications**: High-confidence opportunities trigger immediate in-app WebSocket updates, accompanied by strictly rate-limited email dispatches.

---

## Features

### Job Ingestion and Deduplication
- **Pluggable Sources**: Built-in support for Remotive, Arbeitnow, Greenhouse, Lever, and a bundled dataset of 165 offline seed postings. New sources subclass `JobSource` and register in `worker/sources/__init__.py`.
- **Scheduled Crawling**: Celery Beat runs ingestion tasks at regular intervals (`CRAWL_INTERVAL_MINUTES`, default 15 minutes).
- **Two-Tier Deduplication**:
  - *Exact*: Cryptographic `SHA-1(title + company + location)` fingerprint verified in an initial batched query before queuing background processing.
  - *Near-Duplicate*: Same company and embedding cosine similarity of 0.92 or greater. Near-duplicates are merged into the canonical posting and tracked in `alsoOn[]`.
- **Normalization**: Skills mapped to a 431-term canonical tech dictionary via RapidFuzz token matching (e.g., `k8s` maps to `Kubernetes`), alongside multi-currency salary normalization.

### Resume Intelligence
- **Multi-Format Extraction**: Ingests PDF and DOCX files through PyMuPDF and python-docx without external binary dependencies.
- **Strict Schema Enforcement**: Candidate data (skills, experience, projects, education) is parsed and validated against strict Pydantic models with automated JSON repair retries.
- **Swappable LLM Providers**: Configurable between Google Gemini, local Ollama, and an offline heuristic parser fallback.
- **Privacy Shield**: A PII redactor removes telephone numbers, physical addresses, and postal codes before sending text to external LLM providers.
- **Profile Synchronization**: Extracted skills remain fully editable within the user profile interface; modifications trigger automatic vector re-indexing.

### Explainable Hybrid Ranking
Recommendations are calculated using a weighted multi-signal scoring function:

$$\text{Score} = 0.50 \cdot S_{\text{semantic}} + 0.30 \cdot S_{\text{skills}} + 0.10 \cdot S_{\text{location}} + 0.10 \cdot S_{\text{recency}}$$

| Signal | Evaluation Method |
|---|---|
| Semantic | Cosine similarity of `BAAI/bge-small-en-v1.5` embeddings (384 dimensions, evaluated via FAISS `IndexFlatIP`) |
| Skills | Ratio of overlapping canonical skills: $\frac{|\text{User Skills} \cap \text{Job Skills}|}{|\text{Job Skills}|}$ |
| Location | Alignment between candidate remote preferences and job requirements |
| Recency | Exponential half-life decay function over a 14-day duration |

Weights, thresholds, and decay parameters are fully configurable through environment variables. Every output includes `matchedSkills`, `missingSkills`, and an explainability summary.

### Real-Time Delivery
- Matches trigger `notification.created` events dispatched to a RabbitMQ topic exchange.
- The Node.js API layer consumes AMQP messages and routes them directly to user-specific Socket.IO channels for instant in-app alerts without page refreshes. Resume extraction status updates (`resume.processed`) follow the same pathway.
- Email alerts are dispatched exclusively for high-confidence matches ($\ge 75\%$), capped at 5 emails per rolling 24-hour window per user. Supported providers include standard SMTP, Brevo, Resend, and local console logging.

### Application and Career Tooling
- **Application Pipeline**: Kanban-style status tracking covering Saved, Applied, Interview, and Rejected states.
- **Market Skill Gap Analysis**: Aggregated market analytics identifying high-demand technologies missing from the candidate's profile.
- **Career Intelligence Endpoints**: Automated utilities for resume tailoring, interview prep questions, cover letter generation, and skill-learning roadmaps.

### Authentication and Security
- Complete authentication flow: email verification codes, login, token refresh, logout, and password recovery.
- Passwords secured with bcrypt (10 salt rounds); API protected via Bearer JWT authentication.
- Request rate limiting: 300 requests per 15-minute window per IP globally, and 30 requests per 15-minute window on authentication endpoints.

---

## Architecture

![SmartJobs Architecture Diagram](docs/architecture.png)

### Lifecycle Flows

- **Job Ingestion Lifecycle**:
  `Celery Beat` triggers `crawl_sources` &rarr; Unseen postings queued to `process_job` &rarr; Skills normalized, embeddings computed, and duplicates merged &rarr; Job saved to MongoDB and vector index &rarr; `match_job_to_users` scores job against active profiles &rarr; Qualifying matches generate notifications &rarr; Events dispatched across RabbitMQ to Socket.IO and qualifying emails sent via SMTP.

- **Resume Parsing Lifecycle**:
  Resume uploaded to `/api/resumes` &rarr; File stored securely and `parse_resume` task queued &rarr; Worker extracts text and redacts PII &rarr; LLM parses structure and Pydantic validates fields &rarr; Skills normalized and embeddings generated &rarr; Profile persisted and `resume.processed` emitted via WebSockets &rarr; Matching pipeline updates candidate recommendation feed.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, Socket.IO Client, TanStack Virtual |
| API Gateway | Node.js, Express, Mongoose, Socket.IO, amqplib, JWT, Multer, Helmet, bcrypt |
| Background Workers | Python 3.11, Celery, Celery Beat, sentence-transformers, FAISS, RapidFuzz, PyMuPDF, python-docx, Pydantic |
| Message Broker | RabbitMQ 3.12 (Task queue and topic event exchange) |
| Storage & Cache | MongoDB 6 (Primary data store), FAISS In-Memory (Vector index), Qdrant (Optional vector store), Redis (Optional cache) |
| AI & Embeddings | `BAAI/bge-small-en-v1.5` embeddings, Google Gemini / Ollama / Offline Heuristic parser |

---

## Quick Start

### Option A: Docker Compose (Recommended)

Requires Docker Engine and Compose v2.

```bash
git clone https://github.com/nandinir0626-ux/Smart-Job-Aggregator.git
cd Smart-Job-Aggregator

# Create environment file from template
cp .env.example .env

# Build and start services
docker compose up --build
```

| Service | Address |
|---|---|
| Web Application | `http://localhost:5173` |
| REST API | `http://localhost:5000` (Health check: `/api/health`) |
| RabbitMQ Management UI | `http://localhost:15672` (Default credentials: `guest` / `guest`) |

*Note: Initial setup downloads the embedding model into a persistent volume cache. When running without external API keys, the application executes fully offline using bundled seed postings, heuristic resume extraction, and console email output.*

---

### Option B: Local Development

**Prerequisites**: Node.js 18+, Python 3.11, MongoDB running on `localhost:27017`, RabbitMQ running on `localhost:5672`.

```bash
# 1. Start Node.js API (Terminal 1)
cd api
npm install
npm run dev

# 2. Start Celery Worker (Terminal 2)
cd worker
pip install -r requirements.txt
# Note: append '-P solo' when running on Windows
celery -A celery_app.celery worker --loglevel=info

# 3. Start Celery Beat Scheduler (Terminal 3)
cd worker
celery -A celery_app.celery beat --loglevel=info

# 4. Start React Frontend (Terminal 4)
cd frontend
npm install
npm run dev
```

### Initial Run & Verification
1. Open `http://localhost:5173` in your browser and register a new user account.
2. Enter the verification code (logged to the API console when `EMAIL_PROVIDER=console`).
3. Navigate to the Profile section and upload a resume (a reference sample is located at `data/sample_resume.pdf`).
4. View real-time ranked recommendations on the Dashboard and observe the notification counter update as background jobs are ingested.

---

## Configuration

Copy `.env.example` to `.env`. All default settings function out-of-the-box for local execution.

### Core Settings

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/job_aggregator` | MongoDB connection URI |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | AMQP broker connection |
| `PORT` | `5000` | Node.js API port |
| `JWT_SECRET` | None | Secret key for signing authorization tokens |
| `JWT_EXPIRES_IN` | `7d` | Authorization token expiration period |
| `FRONTEND_URL` | `http://localhost:5173` | Client origin for CORS and email links |
| `UPLOAD_DIR` | `./uploads` | Shared resume storage directory |

### AI and Matching Settings

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `mock` | Resume parsing engine: `gemini`, `ollama`, or `mock` |
| `GEMINI_API_KEY` | None | API key required when using Google Gemini |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Endpoint for local Ollama instances |
| `EMBEDDING_MODEL_NAME` | `BAAI/bge-small-en-v1.5` | Pretrained sentence-transformers embedding model |
| `WEIGHT_SEMANTIC` | `0.50` | Scoring weight for semantic cosine similarity |
| `WEIGHT_SKILL` | `0.30` | Scoring weight for canonical skill overlap |
| `WEIGHT_LOCATION` | `0.10` | Scoring weight for remote/location match |
| `WEIGHT_RECENCY` | `0.10` | Scoring weight for job posting recency |
| `RECENCY_HALF_LIFE_DAYS`| `14` | Half-life duration in days for recency decay |
| `COSINE_DEDUPE_THRESHOLD`| `0.92` | Cosine similarity threshold for near-duplicate jobs |
| `RAPIDFUZZ_SKILL_THRESHOLD`| `90` | Fuzzy matching threshold for skill normalization |
| `DEFAULT_MIN_MATCH_SCORE`| `0.60` | Default user notification threshold (60%) |

### Crawling and Ingestion

| Variable | Default | Purpose |
|---|---|---|
| `CRAWL_INTERVAL_MINUTES` | `15` | Frequency of scheduled Celery Beat crawls |
| `REMOTIVE_API_URL` | `https://remotive.com/api/remote-jobs` | Remotive public API endpoint |

### Email Dispatch

| Variable | Default | Purpose |
|---|---|---|
| `EMAIL_PROVIDER` | `console` | Dispatch transport: `smtp`, `brevo`, `resend`, or `console` |
| `SMTP_HOST` / `SMTP_PORT` | None | SMTP server connection settings |
| `SMTP_USER` / `SMTP_PASS` | None | SMTP credentials (use an App Password for Gmail) |
| `BREVO_API_KEY` | None | Brevo transactional API key |
| `RESEND_API_KEY` | None | Resend API key |
| `EMAIL_FROM` | `notifications@smartjobs.local` | Default sender email address |

### Optional Infrastructure

| Variable | Default | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Cache backend; falls back to internal memory if omitted |
| `QDRANT_HOST` / `QDRANT_PORT`| `localhost` / `6333` | Vector database; falls back to FAISS if omitted |

---

## API Reference

Base URL: `http://localhost:5000/api`. Endpoints marked with `[Auth]` require a valid `Authorization: Bearer <jwt>` header.

<details open>
<summary><strong>Authentication Endpoints</strong></summary>

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/auth/register` | Register user account and dispatch verification code | No |
| `POST` | `/auth/verify-email` | Confirm account via 6-digit verification code | No |
| `POST` | `/auth/resend-code` | Request a new verification code | No |
| `POST` | `/auth/login` | Authenticate credentials and receive JWT | No |
| `POST` | `/auth/logout` | Invalidate active user session | No |
| `POST` | `/auth/forgot-password`| Request password reset code via email | No |
| `POST` | `/auth/reset-password` | Update account password using reset token | No |
| `GET` | `/auth/me` | Retrieve currently authenticated user profile | Yes |

</details>

<details open>
<summary><strong>Jobs, Recommendations, and Tracking</strong></summary>

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/jobs` | Paginated job search with keyword, location, and skill filters | No |
| `GET` | `/jobs/:id` | Fetch detailed posting data and merged source listings | No |
| `GET` | `/recommendations` | Retrieve ranked matches with explainability scores | Yes |
| `POST` | `/saved` | Track a job or update status (saved, applied, interview, rejected) | Yes |
| `GET` | `/saved` | Retrieve full application tracking pipeline | Yes |
| `PATCH` | `/saved/:id` | Update job application status or stage notes | Yes |
| `DELETE` | `/saved/:id` | Remove job listing from application tracker | Yes |

</details>

<details open>
<summary><strong>Profile, Resumes, and Notifications</strong></summary>

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `PUT` | `/users/preferences` | Update target roles, locations, threshold, and alert settings | Yes |
| `POST` | `/resumes` | Upload candidate resume (multipart/form-data, PDF/DOCX) | Yes |
| `GET` | `/resumes/latest` | Retrieve parsed candidate record and canonical skills | Yes |
| `PUT` | `/resumes/latest` | Modify extracted skills and trigger embedding re-index | Yes |
| `GET` | `/notifications` | List user notification history | Yes |
| `PATCH` | `/notifications/:id/read` | Mark individual notification as read | Yes |
| `PATCH` | `/notifications/read-all` | Mark all user notifications as read | Yes |

</details>

<details open>
<summary><strong>Career Intelligence</strong></summary>

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/career/jobs/:id/tailor-resume` | Generate role-specific resume customization suggestions | Yes |
| `GET` | `/career/jobs/:id/interview-prep` | Generate targeted interview questions and preparation advice | Yes |
| `POST` | `/career/jobs/:id/cover-letter` | Draft tailored cover letter based on candidate profile | Yes |
| `GET` | `/career/skills/:skillName/roadmap` | Retrieve structured learning roadmap for an identified skill | Yes |

</details>

System health endpoint: `GET /health` reports active database, broker, and service statuses.

---

## Real-Time Events

| Event (Routing Key) | Delivery Mechanism | Description |
|---|---|---|
| `notification.created` | Socket.IO event in room `user:<id>` | High-relevance match or system notification created |
| `resume.processed` | Socket.IO event in room `user:<id>` | Resume extraction completed or failed |

---

## Project Structure

```
.
├── api/                   # Node.js Express API service
│   └── src/
│       ├── controllers/   # Route handlers (auth, jobs, resumes, recommendations, career)
│       ├── models/        # Mongoose data schemas (User, Resume, Job, SavedJob, Notification)
│       ├── services/      # Service layer (rabbitmq, socket, cache, email)
│       └── middleware/    # Authentication, rate limiting, file upload, error handling
├── worker/                # Python Celery background worker service
│   ├── sources/           # Ingestion adapters (Remotive, Arbeitnow, Greenhouse, Lever, seed)
│   ├── tasks/             # Task definitions (crawler, job, resume, notification, email)
│   ├── ai/                # Embeddings, matcher, deduplicator, normalizers, parsers, FAISS
│   ├── eval/              # Benchmark evaluation scripts
│   └── tests/             # Pytest test suite
├── frontend/              # React 18 single-page application (Vite, Tailwind CSS)
├── data/                  # Canonical skill taxonomy (431 skills) and 165 seed jobs
├── scripts/               # Seed generation, testing, and walkthrough guides
├── docs/                  # Screenshots and architecture assets
└── docker-compose.yml     # Distributed multi-container definition
```

---

## Testing and Evaluation

```bash
# Execute Python worker test suite (deduplication, normalization, schemas, scoring)
cd worker && pytest

# Execute Node.js API test suite (authentication, route validation, rate limits)
cd api && npm test
```

### Ranking Benchmark

Evaluated across 30 labeled resume-job pairs across 5 technical disciplines:

| Ranking Engine | Precision@5 | Latency |
|---|:---:|:---:|
| Keyword Matching (BM25 / Jaccard) | 76.0% | ~2 ms |
| Dense Embeddings Only (BGE-Small) | 76.0% | ~12 ms |
| **Hybrid Engine (SmartJobs)** | **84.0%** | **~14 ms** |

Reproduce the benchmark evaluation:
```bash
python worker/eval/evaluate_ranking.py
```

---

## Security and Privacy

- **Protected Secrets**: Sensitive configuration keys reside exclusively in `.env`, which is strictly ignored by version control.
- **Data Privacy**: Uploaded candidate documents stored under `uploads/` are excluded from Git. Personal Identifiable Information (phone numbers, addresses) is scrubbed before LLM submission.
- **Defensive Safeguards**: Passwords hashed with bcrypt (salt factor: 10). Authentication endpoints enforce strict rate limiting to mitigate brute-force attempts.
- **Production Recommendations**: Ensure a cryptographically random `JWT_SECRET` is configured, change default RabbitMQ broker credentials, restrict CORS origins to trusted client hosts, and terminate traffic via TLS/HTTPS.

---

## Known Limitations and Roadmap

- **Vector Persistence**: Default vector store operates as an in-memory FAISS index per worker; configure Qdrant for distributed, shared vector persistence across multi-node deployments.
- **Source Rate Limits**: External job aggregators rely on public endpoints which may enforce rate limits or alter schemas.
- **Offline Heuristic Parser**: The bundled offline parser utilizes rule-based heuristics and exhibits lower extraction accuracy compared to Gemini or Ollama models.
- **Future Enhancements**: Expanded benchmark evaluations with statistical confidence bounds, additional ATS ingestion adapters, and automated CI pipelines for backend and worker suites.

---

## Contributing

1. Fork the repository and create a distinct feature branch.
2. Verify that both `pytest` and `npm test` suites pass before submitting modifications.
3. To introduce a new job provider, inherit from `JobSource` in `worker/sources/`, implement the `fetch_jobs(limit)` method, and register the class in `worker/sources/__init__.py`.

---

## License

This project is licensed under the [MIT License](LICENSE).
