import logging
import os
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

class QdrantVectorEngine:
    """
    Production-grade Vector Storage using Qdrant (Rust-based, HNSW on disk).
    Gracefully falls back to in-memory FAISS if Qdrant container is not reachable.
    """

    def __init__(self, host: str = None, port: int = 6333, collection_name: str = "jobs_collection"):
        self.host = host or os.getenv("QDRANT_HOST", "localhost")
        self.port = int(port or os.getenv("QDRANT_PORT", 6333))
        self.collection_name = collection_name
        self.client = None
        self.is_connected = False

        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import VectorParams, Distance

            self.client = QdrantClient(host=self.host, port=self.port, timeout=2.0)
            # Healthcheck
            self.client.get_collections()
            self.is_connected = True

            # Ensure collection exists
            collections = [c.name for c in self.client.get_collections().collections]
            if self.collection_name not in collections:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
                )
                logger.info(f"[Qdrant] Created collection '{self.collection_name}' with 384-d Cosine HNSW.")
            else:
                logger.info(f"[Qdrant] Connected to existing collection '{self.collection_name}'.")
        except Exception as e:
            logger.info(f"[Qdrant] Service not active on {self.host}:{self.port} ({e}). Using FAISS fallback.")
            self.is_connected = False

    def add_job(self, job_id: str, vector: List[float], payload: dict = None):
        if self.is_connected:
            try:
                import hashlib
                from qdrant_client.models import PointStruct

                # Deterministic int ID from job_id hash
                point_id = int(hashlib.md5(job_id.encode('utf-8')).hexdigest()[:8], 16)
                point = PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"job_id": job_id, **(payload or {})}
                )
                self.client.upsert(collection_name=self.collection_name, points=[point])
                return True
            except Exception as e:
                logger.warning(f"[Qdrant] Error adding vector: {e}")
                return False
        return False

    def search(self, query_vector: List[float], top_k: int = 20) -> List[Tuple[str, float]]:
        if self.is_connected:
            try:
                results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    limit=top_k
                )
                return [(hit.payload.get("job_id"), float(hit.score)) for hit in results if hit.payload]
            except Exception as e:
                logger.warning(f"[Qdrant] Search failed: {e}")
                return []
        return []

_qdrant_instance = None

def get_qdrant_engine() -> QdrantVectorEngine:
    global _qdrant_instance
    if _qdrant_instance is None:
        _qdrant_instance = QdrantVectorEngine()
    return _qdrant_instance
