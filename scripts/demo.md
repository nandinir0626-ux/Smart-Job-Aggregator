# 3-Minute Demo Walkthrough: SmartJobs AI Recommendation Engine

Follow these exact steps to demonstrate the end-to-end functionality of the platform in under 3 minutes.

---

## Prerequisites (10 seconds)
Ensure the stack is running:
```bash
# Option A: One-command full Docker deployment
docker compose up --build

# Option B: Local development mode
# Terminal 1 (API):
cd api && npm start
# Terminal 2 (Worker):
cd worker && celery -A celery_app.celery worker --loglevel=info
# Terminal 3 (Beat):
cd worker && celery -A celery_app.celery beat --loglevel=info
# Terminal 4 (Frontend):
cd frontend && npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Step 1: Register and Explore Seeding (30 seconds)
1. Navigate to `http://localhost:5173/register`.
2. Fill in:
   - **Name:** `Alex Morgan`
   - **Email:** `alex.morgan@demo.com`
   - **Password:** `DemoPassword123!`
   - **Target Roles:** `Full Stack Engineer, Backend Engineer`
   - Click **Create Account**.
3. You are redirected to `/profile`. Notice the **Job Preferences** on the left with a **Minimum Match Threshold** slider (set to 60%).

---

## Step 2: Upload Resume & Live AI Processing (45 seconds)
1. On the **Profile** page (`/profile`), locate the **Upload Resume** drag-and-drop zone.
2. Select the provided `data/sample_resume.pdf`.
3. Click **Upload & Analyze**:
   - The status immediately switches to `processing` with an animated badge.
   - The backend dispatches the Celery `tasks.parse_resume` task.
   - The worker runs PyMuPDF text extraction, LLM field extraction with Pydantic validation, RapidFuzz skill normalization (mapping 44 canonical skills), and SentenceTransformer embedding generation.
   - **Live Socket.IO Event:** Within 2-3 seconds, the card status automatically flips to `done` without refreshing the page!
4. The **Extracted AI Profile** on the right instantly displays:
   - Full Name: `ALEX MORGAN`
   - Professional Summary
   - 44 Normalized Skill Chips (`Python`, `React`, `FastAPI`, `Docker`, `PostgreSQL`, `FAISS`, etc.)
5. Try adding a skill tag (e.g. `Next.js`) or removing one, then click **Save & Re-Index**.

---

## Step 3: Personalized Recommendations & Hybrid Scoring (45 seconds)
1. Click **Recommendations** in the top navigation bar to visit the Dashboard (`/`).
2. Notice the ranked job postings:
   - Each card displays a high-contrast **Match Percentage** pill (e.g., `88% Match`).
   - Color-coded **Matched Skills** (green check chips) and **Missing Skills** (slate chips).
   - An explainability banner: e.g. *"Outstanding skill alignment! Matched all 6 key skills (Python, FastAPI, PostgreSQL, Celery, RabbitMQ, Docker)."*
3. Check the right sidebar **Market Skill Gap Analysis**:
   - Displays real-time progress bars showing the top missing skills across the top 20 recommendations (e.g., `gRPC`, `MLflow`, `Prometheus`).
4. Click the **Bookmark** icon on any top job to save it to your pipeline.

---

## Step 4: Live Real-Time Notification & Deduplication (30 seconds)
1. Keep the browser open on the Dashboard or Search page.
2. In a terminal, simulate a newly crawled matching job entering the pipeline:
   ```bash
   python -c "
   import sys
   sys.path.insert(0, 'worker')
   from tasks.job_tasks import process_job
   from datetime import datetime, timezone
   process_job({
       'source': 'remotive',
       'sourceId': 'demo-live-101',
       'title': 'Senior Full Stack Python/React Architect',
       'company': 'HyperScale Cloud',
       'location': 'Remote',
       'remote': True,
       'description': 'Looking for an experienced engineer skilled in Python, React, PostgreSQL, Docker and AWS microservices.',
       'skills': ['Python', 'React', 'PostgreSQL', 'Docker', 'AWS'],
       'salaryMin': 160000,
       'salaryMax': 210000,
       'url': 'https://remotive.com/demo-live-101',
       'postedAt': datetime.now(timezone.utc).isoformat()
   })
   "
   ```
3. Watch the browser in real time:
   - **Socket.IO Real-Time Banner:** A dark floating alert slides in at the bottom right announcing *"Real-Time Job Match! Senior Full Stack Python/React Architect (88% Match)"*.
   - **Navbar Bell Badge:** The red badge updates immediately from `0` to `1`.
   - Clicking the bell opens the live notifications dropdown with the full explanation.

---

## Step 5: Explore Search & Application Tracker (20 seconds)
1. Click **Search Jobs** (`/jobs`):
   - Test search keywords (e.g., `Python`), toggle `Remote Only`, or filter by `Source: Remotive`.
   - View pagination and instantaneous sub-30ms response times.
2. Click **Saved Tracker** (`/saved`):
   - View your saved jobs pipeline.
   - Change the status dropdown from `Saved` to `Applied` or `Interview`.
   - Add recruiter interview notes.

---
**Demo Complete!** All objectives and flows verified.
