# Generates a valid standard PDF-1.4 file without external dependencies
import os

pdf_content = """%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
  /Resources <<
    /Font <<
      /F1 4 0 R
      /F2 5 0 R
    >>
  >>
  /Contents 6 0 R
>>
endobj
4 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica-Bold
>>
endobj
5 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
6 0 obj
<<
  /Length 1850
>>
stream
BT
/F1 20 Tf
50 740 Td
(ALEX MORGAN) Tj
/F2 10 Tf
0 -18 Td
(Email: alex.morgan.dev@example.com | Phone: +1-555-019-2834 | LinkedIn: linkedin.com/in/alexmorgan-dev) Tj
0 -14 Td
(GitHub: github.com/alexmorgandev | Location: San Francisco, CA / Remote) Tj
/F1 12 Tf
0 -26 Td
(PROFESSIONAL SUMMARY) Tj
/F2 10 Tf
0 -15 Td
(Senior Full Stack & Machine Learning Engineer with 5+ years of experience designing scalable distributed) Tj
0 -13 Td
(web applications and deploying production AI/NLP pipelines. Expert in Python, TypeScript, React, Node.js,) Tj
0 -13 Td
(FastAPI, Docker, Kubernetes, and Vector Search systems.) Tj
/F1 12 Tf
0 -24 Td
(TECHNICAL SKILLS) Tj
/F2 10 Tf
0 -15 Td
(Programming Languages: Python, JavaScript, TypeScript, Go, SQL, Bash) Tj
0 -13 Td
(Frontend Development: React, Next.js, Redux, Tailwind CSS, HTML5, CSS3, Vite) Tj
0 -13 Td
(Backend Development: Node.js, Express.js, FastAPI, Django, REST API, GraphQL, WebSockets) Tj
0 -13 Td
(Databases & Messaging: PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka) Tj
0 -13 Td
(AI, ML & NLP: PyTorch, Hugging Face, Sentence Transformers, FAISS, LangChain, Large Language Models) Tj
0 -13 Td
(DevOps & Cloud: Docker, Kubernetes, AWS, Terraform, CI/CD, Linux, Git) Tj
/F1 12 Tf
0 -24 Td
(WORK EXPERIENCE) Tj
/F1 10 Tf
0 -15 Td
(Senior Software Engineer | CloudScale Tech | 2021 - Present) Tj
/F2 10 Tf
0 -13 Td
(- Architected high-throughput microservices using Node.js, FastAPI, and PostgreSQL serving 2M daily requests.) Tj
0 -13 Td
(- Implemented semantic search engine using FAISS and Sentence Transformers reducing query latency by 45%.) Tj
0 -13 Td
(- Led migration to containerized Kubernetes infrastructure on AWS with automated CI/CD GitHub Actions.) Tj
/F1 10 Tf
0 -18 Td
(Full Stack Developer | DataNova Solutions | 2019 - 2021) Tj
/F2 10 Tf
0 -13 Td
(- Developed interactive real-time analytics dashboards using React, TypeScript, Tailwind CSS, and WebSockets.) Tj
0 -13 Td
(- Built RESTful APIs and background job processing pipelines using Python, Celery, and RabbitMQ.) Tj
0 -13 Td
(- Optimized MongoDB aggregation queries and established Redis caching layers improving response times by 60%.) Tj
/F1 12 Tf
0 -24 Td
(EDUCATION) Tj
/F2 10 Tf
0 -15 Td
(Bachelor of Science in Computer Science | University of California, Berkeley | 2015 - 2019) Tj
/F1 12 Tf
0 -24 Td
(KEY PROJECTS) Tj
/F1 10 Tf
0 -15 Td
(AI-Powered Job Recommendation System) Tj
/F2 10 Tf
0 -13 Td
(Built real-time job aggregation and FAISS-based vector matching using Python, React, and MongoDB.) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000262 00000 n 
0000000341 00000 n 
0000000416 00000 n 
trailer
<<
  /Size 7
  /Root 1 0 R
>>
startxref
2330
%%EOF
"""

os.makedirs('data', exist_ok=True)
with open('data/sample_resume.pdf', 'wb') as f:
    f.write(pdf_content.strip().encode('latin-1'))

print("Generated valid data/sample_resume.pdf")
