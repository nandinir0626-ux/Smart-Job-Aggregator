import json
import re
import logging
from typing import List, Set, Optional, Dict
from rapidfuzz import process, fuzz
from config import SKILLS_FILE, RAPIDFUZZ_SKILL_THRESHOLD

logger = logging.getLogger(__name__)

class SkillNormalizer:
    def __init__(self, skills_path=None):
        self.skills_path = skills_path or SKILLS_FILE
        self.canonical_skills: Set[str] = set()
        self.alias_to_canonical: Dict[str, str] = {}
        self.all_lookup_terms: List[str] = []
        self._load_skills()

    def _load_skills(self):
        try:
            with open(self.skills_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for entry in data:
                canonical = entry["canonical"]
                self.canonical_skills.add(canonical)
                # Lowercase map
                self.alias_to_canonical[canonical.lower()] = canonical

                for alias in entry.get("aliases", []):
                    clean_alias = alias.strip().lower()
                    if clean_alias:
                        self.alias_to_canonical[clean_alias] = canonical

            self.all_lookup_terms = list(self.alias_to_canonical.keys())
            logger.info(f"Loaded {len(self.canonical_skills)} canonical skills and {len(self.all_lookup_terms)} lookup terms.")
        except Exception as e:
            logger.error(f"Failed to load skills from {self.skills_path}: {e}")

    def normalize_skill(self, raw_skill: str) -> Optional[str]:
        if not raw_skill or not isinstance(raw_skill, str):
            return None

        clean = raw_skill.strip()
        lower_clean = clean.lower()

        # 1. Exact match in canonical / aliases
        if lower_clean in self.alias_to_canonical:
            return self.alias_to_canonical[lower_clean]

        # 2. RapidFuzz match against all terms (score >= RAPIDFUZZ_SKILL_THRESHOLD)
        if len(lower_clean) >= 2 and self.all_lookup_terms:
            match = process.extractOne(
                lower_clean,
                self.all_lookup_terms,
                scorer=fuzz.ratio,
                score_cutoff=RAPIDFUZZ_SKILL_THRESHOLD
            )
            if match:
                best_term, score, _ = match
                canonical = self.alias_to_canonical[best_term]
                return canonical

        # Drop unknown junk
        return None

    def normalize_skill_list(self, raw_skills: List[str]) -> List[str]:
        seen = set()
        normalized = []
        for s in raw_skills:
            norm = self.normalize_skill(s)
            if norm and norm not in seen:
                seen.add(norm)
                normalized.append(norm)
        return normalized

    def extract_skills_from_text(self, text: str) -> List[str]:
        """
        Matches canonical skills and aliases against job title + description
        using phrase matching on word boundaries.
        """
        if not text:
            return []

        found_skills = set()
        lower_text = " " + text.lower() + " "

        # Sort terms by length descending to match longer multi-word phrases first
        sorted_terms = sorted(self.all_lookup_terms, key=len, reverse=True)

        for term in sorted_terms:
            # Escape regex special characters in term (e.g., C++, .NET, C#)
            pattern = r'(?:\b|(?<=\W))' + re.escape(term) + r'(?:\b|(?=\W))'
            if re.search(pattern, lower_text):
                canonical = self.alias_to_canonical[term]
                found_skills.add(canonical)

        return sorted(list(found_skills))

# Singleton instance
_normalizer = None

def get_skill_normalizer():
    global _normalizer
    if _normalizer is None:
        _normalizer = SkillNormalizer()
    return _normalizer
