"""Document classification engine (Phase 9).

Categorizes documents into domain-specific types (Identity, Domicile, Marksheet,
Income, Bank, Declaration) using deterministic semantic evidence patterns.
Never claims legal authenticity or official validity.
"""

import re
from typing import List, Tuple
from app.document.schemas import (
    DocumentClassification,
    DocumentRepresentation,
    DocumentType,
)
from app.document.sanitization import truncate_evidence


# Domain keyword patterns with confidence weights
_PATTERNS: List[Tuple[DocumentType, List[Tuple[str, float]]]] = [
    (
        DocumentType.INCOME_CERTIFICATE,
        [
            (r"(?i)income\s+certificate", 0.5),
            (r"(?i)annual\s+(?:family\s+)?income", 0.3),
            (r"(?i)(?:tahsildar|revenue\s+officer|taluk\s+office)", 0.2),
            (r"(?i)gross\s+annual\s+income", 0.2),
            (r"(?i)financial\s+year\s+20\d\d", 0.1),
        ],
    ),
    (
        DocumentType.ACADEMIC_MARKSHEET,
        [
            (r"(?i)(?:statement\s+of\s+marks|marksheet|grade\s+card|transcript)", 0.5),
            (r"(?i)(?:board\s+of\s+secondary|university|examination|semester)", 0.25),
            (r"(?i)(?:cgpa|percentage|total\s+marks|maximum\s+marks)", 0.25),
            (r"(?i)(?:roll\s+no|registration\s+no|seat\s+no)", 0.15),
            (r"(?i)(?:passed|grade|division)", 0.1),
        ],
    ),
    (
        DocumentType.DOMICILE_CERTIFICATE,
        [
            (r"(?i)domicile\s+certificate", 0.5),
            (r"(?i)residence\s+certificate", 0.4),
            (r"(?i)(?:ordinarily\s+resident|permanent\s+resident)", 0.3),
            (r"(?i)(?:state\s+of\s+|government\s+of\s+)(?:maharashtra|karnataka|delhi|uttar\s+pradesh|tamil\s+nadu|rajasthan|gujarat)", 0.2),
        ],
    ),
    (
        DocumentType.BANK_DOCUMENT,
        [
            (r"(?i)(?:bank\s+passbook|passbook|account\s+statement|statement\s+of\s+account|cheque)", 0.45),
            (r"(?i)(?:ifsc\s+code|ifsc\s*:|ifsc)", 0.3),
            (r"(?i)(?:account\s+number|a/c\s+no|a/c\s+number)", 0.25),
            (r"(?i)(?:state\s+bank|hdfc|icici|punjab\s+national|canara|bank\s+of\s+baroda|axis)", 0.2),
            (r"(?i)(?:branch\s+manager|savings\s+bank\s+account|current\s+account)", 0.15),
        ],
    ),
    (
        DocumentType.IDENTITY_DOCUMENT,
        [
            (r"(?i)(?:aadhaar|uidai|unique\s+identification)", 0.5),
            (r"(?i)(?:voter\s+identity|election\s+commission|epic\s+no)", 0.45),
            (r"(?i)(?:passport|republic\s+of\s+india|government\s+of\s+india\s+identity)", 0.45),
            (r"(?i)(?:permanent\s+account\s+number|income\s+tax\s+department|pan\s+card)", 0.4),
            (r"(?i)(?:date\s+of\s+birth|gender|male|female)", 0.1),
        ],
    ),
    (
        DocumentType.DECLARATION,
        [
            (r"(?i)(?:statutory\s+declaration|solemnly\s+affirm|hereby\s+declare)", 0.5),
            (r"(?i)(?:affidavit|undertaking|declaration)", 0.35),
            (r"(?i)signature\s+of\s+the\s+applicant", 0.2),
        ],
    ),
]


def classify_document(doc: DocumentRepresentation) -> DocumentClassification:
    """Classify document based on extracted text content across all pages.
    
    Does NOT claim legal authenticity. Relies on internal content evidence,
    not merely on filename.
    """
    # Concatenate all page text
    full_text = " ".join(page.text for page in doc.pages)
    if not full_text.strip():
        # Empty or unreadable text
        return DocumentClassification(
            category=DocumentType.UNKNOWN,
            confidence=0.0,
            reason="No readable text available for classification",
            evidence=None,
        )

    best_category = DocumentType.UNKNOWN
    best_score = 0.0
    best_evidence: str = ""
    best_matched_term: str = ""

    for category, patterns in _PATTERNS:
        category_score = 0.0
        category_evidence = ""
        category_term = ""

        for pattern, weight in patterns:
            match = re.search(pattern, full_text)
            if match:
                category_score += weight
                if not category_evidence:
                    # Capture surrounding context as evidence snippet
                    start = max(0, match.start() - 20)
                    end = min(len(full_text), match.end() + 60)
                    category_evidence = truncate_evidence(full_text[start:end])
                    category_term = match.group(0)

        # Cap score at 0.95 (conservative confidence; never 1.0 since not an official verifier)
        final_score = min(0.95, category_score)
        if final_score > best_score:
            best_score = final_score
            best_category = category
            best_evidence = category_evidence
            best_matched_term = category_term

    if best_score < 0.35:
        return DocumentClassification(
            category=DocumentType.UNKNOWN,
            confidence=round(best_score, 3),
            reason="Insufficient content markers to determine category with high confidence",
            evidence=best_evidence or None,
        )

    reason = (
        f"Identified as {best_category.value.replace('_', ' ').title()} based on key text marker '{best_matched_term}' "
        f"and supporting semantic terminology."
    )

    return DocumentClassification(
        category=best_category,
        confidence=round(best_score, 3),
        reason=reason,
        evidence=best_evidence or None,
    )
