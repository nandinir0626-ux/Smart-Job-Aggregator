import sys
from pathlib import Path
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "worker"))

from db import get_db
from tasks.resume_tasks import parse_resume

def verify_phase3():
    print("--- RUNNING PHASE 3 ACCEPTANCE CHECK ---")
    db = get_db()

    # Find or create a test user
    user = db.users.find_one({"email": "resume.test@example.com"})
    if not user:
        user_id = db.users.insert_one({
            "name": "Alex Morgan",
            "email": "resume.test@example.com",
            "passwordHash": "$2b$10$xyz",
            "preferences": {
                "roles": ["Full Stack Engineer", "Machine Learning Engineer"],
                "locations": ["San Francisco, CA", "Remote"],
                "remote": True,
                "minMatchScore": 0.60,
                "emailAlerts": True
            }
        }).inserted_id
    else:
        user_id = user["_id"]

    sample_pdf_path = str(Path(__file__).resolve().parent.parent / "data" / "sample_resume.pdf")
    print(f"Testing with sample PDF: {sample_pdf_path}")

    # Create initial resume record with status 'processing'
    resume_doc = {
        "userId": user_id,
        "filePath": sample_pdf_path,
        "status": "processing",
        "createdAt": "2026-10-14T12:00:00Z"
    }
    resume_id = db.resumes.insert_one(resume_doc).inserted_id
    print(f"Created resume document in Mongo: {resume_id} (status: processing)")

    # Execute parse_resume pipeline
    print("Executing parse_resume task...")
    result = parse_resume(str(resume_id), str(user_id), sample_pdf_path)
    print(f"parse_resume result: {result}")

    # Verify updated resume document
    updated = db.resumes.find_one({"_id": ObjectId(resume_id)})
    assert updated is not None, "Resume document not found"
    print(f"Updated status: {updated.get('status')}")
    assert updated.get("status") == "done", f"Expected status 'done', got {updated.get('status')}"

    parsed = updated.get("parsed", {})
    print(f"Parsed Name: {parsed.get('name')}")
    print(f"Parsed Email: {parsed.get('email')}")
    print(f"Parsed Skills: {parsed.get('skills')}")
    print(f"Normalized Skills ({len(updated.get('normalizedSkills', []))}): {updated.get('normalizedSkills')}")
    print(f"Embedding length: {len(updated.get('embedding', []))}")

    assert updated.get("normalizedSkills"), "Normalized skills must not be empty"
    assert len(updated.get("embedding", [])) == 384, f"Expected 384-dim embedding, got {len(updated.get('embedding', []))}"
    assert "Python" in updated.get("normalizedSkills"), "Expected 'Python' in normalized skills"
    assert "React" in updated.get("normalizedSkills"), "Expected 'React' in normalized skills"

    print(">>> PHASE 3 ACCEPTANCE CHECK PASSED! <<<")

if __name__ == "__main__":
    verify_phase3()
