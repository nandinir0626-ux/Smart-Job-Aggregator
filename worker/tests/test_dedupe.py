import pytest
import sys
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.deduplicator import compute_fingerprint, cosine_similarity

def test_fingerprint_generation():
    fp1 = compute_fingerprint("Senior Python Engineer", "Acme Corp", "Remote")
    fp2 = compute_fingerprint("senior python engineer", "acme corp ", " remote ")
    
    assert fp1 == fp2, "Fingerprint must be case-insensitive and whitespace-invariant"
    assert len(fp1) == 40, "SHA-1 hex digest must be 40 characters"

def test_fingerprint_different_jobs():
    fp1 = compute_fingerprint("Senior Python Engineer", "Acme Corp", "Remote")
    fp2 = compute_fingerprint("Senior React Engineer", "Acme Corp", "Remote")
    
    assert fp1 != fp2, "Different job titles must yield different fingerprints"

def test_cosine_similarity():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.0, 1.0, 0.0]
    
    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0
    assert pytest.approx(cosine_similarity(v1, v3), 0.001) == 0.0

def test_near_duplicate_threshold():
    # Two identical vectors have cosine 1.0 > 0.92
    v1 = np.random.randn(384).tolist()
    assert cosine_similarity(v1, v1) > 0.92

    # Two orthogonal or different vectors
    v2 = np.random.randn(384).tolist()
    # Random 384-d vectors typically have cosine near 0
    assert cosine_similarity(v1, v2) < 0.92
