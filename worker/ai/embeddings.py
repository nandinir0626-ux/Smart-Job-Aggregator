import logging
import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from config import EMBEDDING_MODEL_NAME

logger = logging.getLogger(__name__)

class EmbeddingEngine:
    BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

    def __init__(self, model_name: str = None):
        self.model_name = model_name or EMBEDDING_MODEL_NAME
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            logger.info(f"Loading embedding model '{self.model_name}'...")
            self.model = SentenceTransformer(self.model_name)
            # Ensure model max sequence length is 512
            self.model.max_seq_length = 512
            logger.info(f"Embedding model loaded successfully. Dimension: {self.model.get_sentence_embedding_dimension()}")
        except Exception as e:
            logger.error(f"Failed to load SentenceTransformer model {self.model_name}: {e}")
            raise

    def embed_text(self, text: str, is_query: bool = False) -> List[float]:
        """
        Generates normalized embedding for given text.
        Applies BGE query prefix if is_query is True.
        """
        if not text or not self.model:
            return []

        clean_text = text.strip()
        if is_query:
            clean_text = f"{self.BGE_QUERY_PREFIX}{clean_text}"

        # SentenceTransformer encode with normalize_embeddings=True gives unit vectors
        embedding = self.model.encode(
            clean_text,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        return embedding.tolist()

    def embed_batch(self, texts: List[str], is_query: bool = False) -> List[List[float]]:
        if not texts or not self.model:
            return []

        processed_texts = [
            f"{self.BGE_QUERY_PREFIX}{t.strip()}" if is_query else t.strip()
            for t in texts
        ]

        embeddings = self.model.encode(
            processed_texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
            batch_size=32
        )
        return embeddings.tolist()

    @staticmethod
    def prepare_job_text(title: str, company: str, skills: List[str], description: str) -> str:
        """
        job text = title + company + skills + description (truncate to 512 tokens)
        """
        skills_str = ", ".join(skills) if skills else "None specified"
        text = f"Title: {title}\nCompany: {company}\nRequired Skills: {skills_str}\nDescription: {description}"
        return text

    @staticmethod
    def prepare_resume_text(summary: str, skills: List[str], experience: list, projects: list) -> str:
        """
        resume text = summary + skills + project/experience text
        """
        skills_str = ", ".join(skills) if skills else ""
        
        exp_texts = []
        if experience:
            for exp in experience:
                if isinstance(exp, dict):
                    role = exp.get("role", "")
                    company = exp.get("company", "")
                    bullets = " ".join(exp.get("bullets", []))
                    exp_texts.append(f"{role} at {company}. {bullets}")

        proj_texts = []
        if projects:
            for proj in projects:
                if isinstance(proj, dict):
                    name = proj.get("name", "")
                    desc = proj.get("description", "")
                    tech = ", ".join(proj.get("tech", []))
                    proj_texts.append(f"{name} ({tech}): {desc}")

        parts = [
            f"Summary: {summary}" if summary else "",
            f"Skills: {skills_str}" if skills_str else "",
            f"Experience: {' | '.join(exp_texts)}" if exp_texts else "",
            f"Projects: {' | '.join(proj_texts)}" if proj_texts else "",
        ]
        return "\n".join([p for p in parts if p])

_engine = None

def get_embedding_engine():
    global _engine
    if _engine is None:
        _engine = EmbeddingEngine()
    return _engine
