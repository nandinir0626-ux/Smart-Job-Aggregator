import faiss
import numpy as np
import logging
from typing import List, Tuple, Dict

logger = logging.getLogger(__name__)

class FaissIndexCache:
    DIMENSION = 384  # Dimension for BAAI/bge-small-en-v1.5

    def __init__(self, dimension: int = 384):
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(self.dimension)
        self.id_to_job_id: Dict[int, str] = {}
        self.job_id_to_id: Dict[str, int] = {}
        self.current_id = 0

    def clear(self):
        self.index = faiss.IndexFlatIP(self.dimension)
        self.id_to_job_id.clear()
        self.job_id_to_id.clear()
        self.current_id = 0

    def add_job(self, job_id: str, embedding: List[float]):
        if not embedding or len(embedding) != self.dimension:
            return

        # If already in index, skip or update
        str_job_id = str(job_id)
        if str_job_id in self.job_id_to_id:
            return

        vec = np.array([embedding], dtype=np.float32)
        # Normalize just in case
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        self.index.add(vec)
        self.id_to_job_id[self.current_id] = str_job_id
        self.job_id_to_id[str_job_id] = self.current_id
        self.current_id += 1

    def search(self, query_embedding: List[float], top_k: int = 100) -> List[Tuple[str, float]]:
        if not query_embedding or self.index.ntotal == 0:
            return []

        vec = np.array([query_embedding], dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        actual_k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(vec, actual_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx != -1 and idx in self.id_to_job_id:
                job_id = self.id_to_job_id[idx]
                results.append((job_id, float(score)))

        return results

    def rebuild_from_db(self, db):
        logger.info("Rebuilding in-memory FAISS index from MongoDB...")
        self.clear()
        cursor = db.jobs.find({"embedding": {"$exists": True, "$ne": []}}, {"_id": 1, "embedding": 1})
        count = 0
        for doc in cursor:
            emb = doc.get("embedding")
            if emb and len(emb) == self.dimension:
                self.add_job(str(doc["_id"]), emb)
                count += 1
        logger.info(f"FAISS index successfully rebuilt with {count} job vectors (ntotal={self.index.ntotal}).")

_faiss_cache = None

def get_faiss_cache():
    global _faiss_cache
    if _faiss_cache is None:
        _faiss_cache = FaissIndexCache()
    return _faiss_cache
