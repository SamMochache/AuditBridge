"""
payments/services/smart_match.py

Fuzzy-matching suggestion engine for failed payments.

When a payment fails because the parent typed the wrong admission
number (e.g. NA2026001 instead of NA20260001), the bursar currently
has to manually scroll through 120+ students to find the right one.

This service returns the top-K most likely student matches using:
1. Levenshtein edit distance on the admission number (catches typos,
   missing zeros, transposed digits)
2. Token-set ratio on the student's full name against the admission
   number string (catches cases where the parent entered their name
   instead of the admission number)

No external ML dependencies — uses only Python's standard library
difflib plus the optional rapidfuzz package for better performance.
Falls back to difflib gracefully if rapidfuzz is not installed.

Usage:
    from payments.services.smart_match import suggest_students

    candidates = suggest_students(payment, school, top_k=3)
    # [{'student_id': 5, 'admission_number': 'NA20260001',
    #   'name': 'James Kamau', 'confidence': 0.92}]
"""

import difflib
from typing import Any

from academics.models import Student
from payments.models import Payment


def _levenshtein_similarity(a: str, b: str) -> float:
    """
    Returns a similarity score in [0, 1] using difflib's SequenceMatcher.
    For short strings (admission numbers) this is fast and accurate.
    Replaced by rapidfuzz.fuzz.ratio when available for 10–20× speedup.
    """
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def suggest_students(
    payment: Payment,
    school,
    top_k: int = 3,
) -> list[dict[str, Any]]:
    """
    Return up to `top_k` student matches for a failed payment.

    Each result is a dict:
        student_id       — pk of the Student row
        admission_number — the student's actual student_id field
        name             — full name
        confidence       — float in [0, 1]; ≥ 0.7 is a strong match

    The threshold of 0.5 filters out clearly irrelevant results before
    ranking, keeping the response payload small.
    """
    query = payment.student_admission_number.strip().upper()

    students = list(
        Student.objects.filter(school=school).values(
            "id", "student_id", "first_name", "last_name"
        )
    )

    if not students:
        return []

    # Try to import rapidfuzz for faster/better scoring.
    try:
        from rapidfuzz import fuzz  # type: ignore

        def score(student) -> float:
            id_score = fuzz.ratio(query, student["student_id"].upper()) / 100.0
            name_str = f"{student['first_name']} {student['last_name']}".upper()
            name_score = fuzz.partial_ratio(query, name_str) / 100.0
            return max(id_score, name_score * 0.8)  # weight name matches lower

    except ImportError:
        # Fallback to stdlib — slower but correct
        def score(student) -> float:  # type: ignore[misc]
            id_score = _levenshtein_similarity(query, student["student_id"])
            name_str = f"{student['first_name']} {student['last_name']}"
            name_score = _levenshtein_similarity(query, name_str) * 0.8
            return max(id_score, name_score)

    scored = [
        {
            "student_id": s["id"],
            "admission_number": s["student_id"],
            "name": f"{s['first_name']} {s['last_name']}",
            "confidence": round(score(s), 3),
        }
        for s in students
    ]

    # Filter noise and return top matches
    filtered = [r for r in scored if r["confidence"] >= 0.5]
    filtered.sort(key=lambda r: r["confidence"], reverse=True)
    return filtered[:top_k]
