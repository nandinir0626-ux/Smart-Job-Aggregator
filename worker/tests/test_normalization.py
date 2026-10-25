import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.skill_normalizer import get_skill_normalizer

def test_canonical_and_alias_mapping():
    normalizer = get_skill_normalizer()
    
    # Exact canonical
    assert normalizer.normalize_skill("Python") == "Python"
    assert normalizer.normalize_skill("React") == "React"

    # Known aliases
    assert normalizer.normalize_skill("py") == "Python"
    assert normalizer.normalize_skill("python3") == "Python"
    assert normalizer.normalize_skill("reactjs") == "React"
    assert normalizer.normalize_skill("golang") == "Go"
    assert normalizer.normalize_skill("k8s") == "Kubernetes"
    assert normalizer.normalize_skill("ts") == "TypeScript"

def test_rapidfuzz_fuzzy_matching():
    normalizer = get_skill_normalizer()
    
    # Slight typos with >= 90 ratio
    assert normalizer.normalize_skill("PostgreSql") == "PostgreSQL"
    assert normalizer.normalize_skill("Docker ") == "Docker"
    assert normalizer.normalize_skill("Kubernetes ") == "Kubernetes"

def test_drop_unknown_junk():
    normalizer = get_skill_normalizer()
    
    # Junk strings that shouldn't match anything
    assert normalizer.normalize_skill("xyz_totally_fake_technology_999") is None
    assert normalizer.normalize_skill("asdfghjkl12345") is None
    assert normalizer.normalize_skill("") is None
    assert normalizer.normalize_skill(None) is None

def test_phrase_boundary_extraction():
    normalizer = get_skill_normalizer()
    
    sample_job_text = """
    We are looking for a Senior Full Stack Engineer experienced with Python, React,
    FastAPI, and PostgreSQL. Familiarity with Docker and AWS is required.
    """
    extracted = normalizer.extract_skills_from_text(sample_job_text)
    
    assert "Python" in extracted
    assert "React" in extracted
    assert "FastAPI" in extracted
    assert "PostgreSQL" in extracted
    assert "Docker" in extracted
    assert "AWS" in extracted
