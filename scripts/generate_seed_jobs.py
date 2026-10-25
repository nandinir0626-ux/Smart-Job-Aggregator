import json
import random
import hashlib
from datetime import datetime, timedelta, timezone

job_titles = [
    # Full Stack & Backend
    ("Senior Full Stack Engineer", ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS", "REST API"], "TechFlow Labs", "San Francisco, CA", True),
    ("Full Stack Developer", ["JavaScript", "Python", "Django", "React", "MongoDB", "Git"], "Elevate Global", "New York, NY", False),
    ("Senior Backend Engineer", ["Go", "Kubernetes", "gRPC", "PostgreSQL", "Redis", "Microservices"], "StreamCloud Systems", "Remote", True),
    ("Backend Engineer (Python)", ["Python", "FastAPI", "PostgreSQL", "Celery", "RabbitMQ", "Docker"], "DataPulse AI", "Bangalore, India", False),
    ("Staff Backend Engineer", ["Java", "Spring Boot", "Kafka", "PostgreSQL", "Distributed Systems", "AWS"], "Nexis Fintech", "Bengaluru, India", True),
    ("Node.js Backend Developer", ["Node.js", "Express.js", "MongoDB", "Redis", "WebSockets", "Docker"], "HyperScale Apps", "London, UK", True),
    ("Software Engineer - Distributed Systems", ["Rust", "Linux", "TCP/IP", "Raft", "Distributed Systems", "Docker"], "InfraMesh", "Remote", True),
    ("C# / .NET Core Backend Engineer", ["C#", "ASP.NET", "SQL Server", "Azure", "Microservices", "REST API"], "Enterprise Solutions Group", "Hyderabad, India", False),
    ("Ruby on Rails Developer", ["Ruby on Rails", "PostgreSQL", "Redis", "Sidekiq", "JavaScript", "HTML", "CSS"], "SaaSify Co", "Austin, TX", True),
    ("Elixir / Phoenix Backend Engineer", ["Elixir", "Phoenix", "PostgreSQL", "WebSockets", "Docker"], "LiveStream Media", "Remote", True),

    # Frontend
    ("Senior Frontend Engineer", ["React", "TypeScript", "Next.js", "Tailwind CSS", "Redux", "Jest"], "PixelCraft Studio", "San Francisco, CA", True),
    ("Staff UI Engineer", ["React", "TypeScript", "Design Systems", "WebAssembly", "WebGPU", "Vite"], "Canvas Interactive", "Remote", True),
    ("Frontend Developer (Vue.js)", ["Vue.js", "TypeScript", "Pinia", "Tailwind CSS", "Vite", "Cypress"], "Verve Digital", "Berlin, Germany", True),
    ("Angular Frontend Engineer", ["Angular", "TypeScript", "RxJS", "Sass", "Jest", "CI/CD"], "Global Banking Corp", "Mumbai, India", False),
    ("Mobile App Developer (React Native)", ["React Native", "TypeScript", "Redux", "iOS", "Android", "REST API"], "MobileFirst Tech", "Remote", True),
    ("Flutter Mobile Engineer", ["Flutter", "Dart", "Firebase", "State Management", "Git"], "SwiftPay Mobile", "Delhi, India", False),
    ("Senior iOS Engineer", ["Swift", "SwiftUI", "UIKit", "Combine", "Core Data", "Git"], "AppVibe Inc", "Cupertino, CA", False),
    ("Android Engineer", ["Kotlin", "Jetpack Compose", "Coroutines", "Android SDK", "Retrofit"], "DroidSphere", "Remote", True),

    # AI, ML & Data
    ("Senior Machine Learning Engineer", ["Python", "PyTorch", "Transformers", "FAISS", "Hugging Face", "Docker", "MLflow"], "CognitiveAI Solutions", "San Jose, CA", True),
    ("AI Research Engineer (LLM & RAG)", ["Python", "LangChain", "Sentence Transformers", "Vector Database", "PyTorch", "Large Language Models"], "NeuralMatrix Labs", "Remote", True),
    ("Computer Vision Engineer", ["Python", "OpenCV", "PyTorch", "YOLO", "TensorRT", "C++"], "VisionEdge Systems", "Boston, MA", False),
    ("Natural Language Processing Specialist", ["Python", "NLP", "Hugging Face", "SpaCy", "BERT", "Large Language Models"], "LinguaTech Corp", "Remote", True),
    ("Senior Data Scientist", ["Python", "Pandas", "Scikit-Learn", "SQL", "Statistical Analysis", "XGBoost", "Tableau"], "MarketSignals", "Chicago, IL", True),
    ("Lead Data Engineer", ["Python", "Spark", "Kafka", "Airflow", "Snowflake", "dbt", "AWS"], "DataFlow Pipeline", "Bengaluru, India", False),
    ("Big Data Analytics Engineer", ["Scala", "Spark", "Hadoop", "Hive", "SQL", "BigQuery"], "PentaScale Analytics", "Pune, India", False),
    ("MLOps Engineer", ["Python", "Docker", "Kubernetes", "Kubeflow", "MLflow", "AWS", "CI/CD"], "AutoML Cloud", "Remote", True),

    # DevOps, Cloud & SRE
    ("Senior DevOps Engineer", ["Docker", "Kubernetes", "Terraform", "AWS", "GitHub Actions", "Linux", "Prometheus"], "CloudForge Tech", "Seattle, WA", True),
    ("Site Reliability Engineer (SRE)", ["Linux", "Go", "Kubernetes", "Prometheus", "Grafana", "Terraform", "Ansible"], "UptimeZero", "Remote", True),
    ("Cloud Infrastructure Architect", ["AWS", "Terraform", "Kubernetes", "Microservices", "Security", "Cost Optimization"], "Enterprise Cloud Works", "Dallas, TX", False),
    ("Platform Engineer", ["Go", "Kubernetes", "Helm", "ArgoCD", "Docker", "Linux"], "CorePlatform Labs", "Remote", True),
    ("Azure Cloud Engineer", ["Azure", "Terraform", "PowerShell", "CI/CD", "Docker", "Kubernetes"], "Skyline Cloud", "Chennai, India", False),

    # Security & Systems
    ("Application Security Engineer", ["Security", "OWASP", "Penetration Testing", "Python", "CI/CD", "Docker"], "SecureNet Defense", "Washington, DC", True),
    ("Cybersecurity Specialist", ["Security", "SIEM", "Splunk", "Network Security", "Linux", "Wireshark"], "ShieldPoint", "Remote", True),
    ("Embedded Software Engineer", ["C", "C++", "RTOS", "ARM", "Linux Kernel", "Microcontroller"], "NanoCircuits Ltd", "Noida, India", False),
    ("Systems Performance Engineer", ["C++", "Linux", "eBPF", "Debugging", "Performance Tuning"], "DeepCore Engines", "Remote", True),

    # QA & Testing
    ("Senior QA Automation Engineer", ["Python", "Selenium", "Playwright", "Pytest", "CI/CD", "Docker"], "QualityMatrix", "Gurugram, India", False),
    ("SDET (Software Development Engineer in Test)", ["TypeScript", "Playwright", "Jest", "Node.js", "Docker", "CI/CD"], "TestWave Systems", "Remote", True),
    ("Lead Performance Test Engineer", ["JMeter", "Linux", "Performance Tuning", "Java", "Grafana"], "LoadScale Labs", "Remote", True),
]

locations = [
    "Bengaluru, India", "Hyderabad, India", "Pune, India", "Mumbai, India", "Gurugram, India", "Noida, India", "Chennai, India", "Delhi, India",
    "San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA", "Boston, MA", "London, UK", "Berlin, Germany", "Toronto, Canada", "Remote"
]

companies_prefixes = ["Apex", "Vertex", "Nova", "Starlight", "Horizon", "Quantum", "Cyber", "Aura", "Prime", "Synapse", "Nimbus", "Vanguard", "Krypton", "Omni", "Aero"]
companies_suffixes = ["Technologies", "Software", "Labs", "Digital", "Systems", "AI", "Cloud", "Solutions", "Dynamics", "Networks"]

descriptions_templates = [
    "We are seeking an experienced {title} to join our high-performing team at {company}. In this role, you will architect, build, and deploy mission-critical software solutions using {skills_str}. You will collaborate closely with cross-functional teams of engineers, product managers, and designers to deliver robust features at scale. Ideal candidates possess strong problem-solving abilities, clean coding practices, and deep experience with modern development workflows.",
    "Join {company} as our new {title}! As a key technical contributor, you will drive development of next-generation cloud services and distributed platforms leveraging {skills_str}. Our engineering organization values autonomy, automated testing, continuous integration, and engineering excellence. You will participate in architecture reviews, mentor junior peers, and build resilient systems that power millions of transactions daily.",
    "{company} is looking for a talented {title} to spearhead technical initiatives across our product suite. Working with cutting-edge tools including {skills_str}, you will design scalable endpoints, optimize data processing pipelines, and ensure high availability. We offer a competitive package, collaborative work environment, and exceptional career growth opportunities.",
    "Are you passionate about building modern software? {company} is hiring a {title} to expand our core infrastructure. You will work directly with {skills_str} to solve challenging technical problems, streamline operations, and deliver seamless user experiences. Come help us build software that transforms the industry!"
]

def make_fingerprint(title, company, location):
    raw = f"{title.strip().lower()}::{company.strip().lower()}::{location.strip().lower()}"
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()

seed_jobs = []
now = datetime.now(timezone.utc)

for i in range(165):
    template = job_titles[i % len(job_titles)]
    title = template[0]
    skills = list(template[1])
    is_remote = template[4] or (i % 3 == 0)
    
    if i < len(job_titles):
        company = template[2]
        location = template[3]
    else:
        prefix = companies_prefixes[(i * 3 + 1) % len(companies_prefixes)]
        suffix = companies_suffixes[(i * 7 + 2) % len(companies_suffixes)]
        company = f"{prefix} {suffix}"
        location = "Remote" if is_remote else locations[i % len(locations)]

    # Add random variations to make 165 diverse jobs
    if i >= len(job_titles):
        modifiers = ["Lead ", "Senior ", "Staff ", "Principal ", "", "Junior ", "Associate "]
        title = f"{modifiers[i % len(modifiers)]}{title.replace('Senior ', '').replace('Staff ', '').replace('Lead ', '')}".strip()

    skills_str = ", ".join(skills)
    desc_template = descriptions_templates[i % len(descriptions_templates)]
    description = desc_template.format(title=title, company=company, skills_str=skills_str)

    salary_min = random.choice([500000, 800000, 1200000, 1500000, 2000000, 2500000]) if "India" in location else random.choice([80000, 110000, 130000, 150000, 180000, 210000])
    salary_max = int(salary_min * random.uniform(1.25, 1.55))
    posted_days_ago = random.randint(0, 28)
    posted_at = (now - timedelta(days=posted_days_ago, hours=random.randint(1, 23))).isoformat()
    fingerprint = make_fingerprint(title, company, location)

    job = {
        "source": "seed",
        "sourceId": f"seed_{i+1:04d}",
        "title": title,
        "company": company,
        "location": location,
        "remote": is_remote or location.lower() == "remote",
        "description": description,
        "skills": skills,
        "salaryMin": salary_min,
        "salaryMax": salary_max,
        "url": f"https://example.com/jobs/seed-{i+1:04d}",
        "postedAt": posted_at,
        "fingerprint": fingerprint,
        "createdAt": posted_at
    }
    seed_jobs.append(job)

with open('data/seed_jobs.json', 'w', encoding='utf-8') as f:
    json.dump(seed_jobs, f, indent=2)

print(f"Generated data/seed_jobs.json with {len(seed_jobs)} jobs.")
