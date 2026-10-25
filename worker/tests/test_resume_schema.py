import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.resume_parser import ResumeSchema, EducationItem, ExperienceItem, ProjectItem

def test_resume_schema_valid_full():
    data = {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+1-555-123-4567",
        "links": ["https://linkedin.com/in/janedoe"],
        "skills": ["Python", "FastAPI", "React", "PostgreSQL"],
        "education": [
            {"degree": "B.S. in Computer Science", "institution": "Tech University", "years": "2016-2020"}
        ],
        "experience": [
            {
                "role": "Senior Engineer",
                "company": "Cloud Systems",
                "duration": "2021-Present",
                "bullets": ["Designed scalable services.", "Optimized queries."]
            }
        ],
        "projects": [
            {
                "name": "Job Aggregator",
                "description": "Smart real-time recommendation engine",
                "tech": ["Python", "React", "MongoDB"]
            }
        ],
        "summary": "Experienced full-stack developer specializing in scalable cloud applications."
    }

    schema = ResumeSchema.model_validate(data)
    assert schema.name == "Jane Doe"
    assert schema.email == "jane@example.com"
    assert len(schema.skills) == 4
    assert len(schema.education) == 1
    assert len(schema.experience) == 1
    assert len(schema.projects) == 1

def test_resume_schema_defaults_on_empty():
    schema = ResumeSchema.model_validate({})
    assert schema.name == ""
    assert schema.email == ""
    assert schema.skills == []
    assert schema.education == []
    assert schema.experience == []
    assert schema.projects == []
    assert schema.summary == ""
