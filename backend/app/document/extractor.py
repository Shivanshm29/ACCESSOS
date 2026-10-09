"""Document fact extraction engine (Phase 9).

Extracts structured, grounded facts from document pages with explicit evidence snippets,
page numbers, confidence ratings, and sensitivity classifications.
Conservative design: never invents facts or fabricates evidence.
"""

import re
from typing import List
from app.document.constants import MAX_FACTS_COUNT
from app.document.schemas import (
    DocumentPageRepresentation,
    DocumentRepresentation,
    ExtractedFact,
    FactSensitivity,
    FactType,
)
from app.document.sanitization import truncate_evidence


def _extract_page_facts(page: DocumentPageRepresentation) -> List[ExtractedFact]:
    """Extract candidate facts from a single page's text."""
    facts: List[ExtractedFact] = []
    text = page.text
    page_num = page.pageNumber

    # 1. Applicant Name / Student Name / Candidate Name
    name_patterns = [
        r"(?i)(?:Candidate\s+Name|Applicant\s+Name|Student\s+Name|Name\s+of\s+(?:the\s+)?Candidate|Name\s+of\s+(?:the\s+)?Applicant|Name\s+of\s+(?:the\s+)?Student|Full\s+Name)\s*[:\-]\s*([A-Za-z\s\.]{3,50})",
        r"(?i)(?:This\s+is\s+to\s+certify\s+that\s+(?:Shri|Kumari|Mr\.|Ms\.)?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text)
        if match:
            raw_val = match.group(1).strip()
            # Clean up line breaks or trailing words
            clean_val = re.split(r"[\n\r,;]", raw_val)[0].strip()
            if len(clean_val.split()) >= 2 and len(clean_val) < 60:
                start = max(0, match.start() - 10)
                end = min(len(text), match.end() + 40)
                facts.append(
                    ExtractedFact(
                        factType=FactType.APPLICANT_NAME,
                        value=clean_val,
                        confidence=0.90,
                        sourcePage=page_num,
                        evidence=truncate_evidence(text[start:end]),
                        sensitivity=FactSensitivity.NON_SENSITIVE,
                    )
                )
                break

    # 2. Bank Account Holder Name
    holder_pattern = r"(?i)(?:Account\s+Holder(?:\s+Name)?|A/c\s+Holder(?:\s+Name)?|In\s+the\s+Name\s+of)\s*[:\-]\s*([A-Za-z\s\.]{3,50})"
    holder_match = re.search(holder_pattern, text)
    if holder_match:
        raw_val = holder_match.group(1).strip()
        clean_val = re.split(r"[\n\r,;]", raw_val)[0].strip()
        if len(clean_val.split()) >= 2:
            start = max(0, holder_match.start() - 10)
            end = min(len(text), holder_match.end() + 40)
            facts.append(
                ExtractedFact(
                    factType=FactType.BANK_ACCOUNT_HOLDER,
                    value=clean_val,
                    confidence=0.92,
                    sourcePage=page_num,
                    evidence=truncate_evidence(text[start:end]),
                    sensitivity=FactSensitivity.SENSITIVE,
                )
            )

    # 3. Bank Account Number
    acc_pattern = r"(?i)(?:Account\s+No|Account\s+Number|A/c\s+No|A/c\s+Number)\s*[:\-\.]?\s*(\d{9,18})"
    acc_match = re.search(acc_pattern, text)
    if acc_match:
        val = acc_match.group(1).strip()
        start = max(0, acc_match.start() - 10)
        end = min(len(text), acc_match.end() + 20)
        facts.append(
            ExtractedFact(
                factType=FactType.BANK_ACCOUNT_NUMBER,
                value=val,
                confidence=0.95,
                sourcePage=page_num,
                evidence=truncate_evidence(text[start:end]),
                sensitivity=FactSensitivity.HIGHLY_SENSITIVE,
            )
        )

    # 4. Bank IFSC Code
    ifsc_pattern = r"\b([A-Z]{4}0[A-Z0-9]{6})\b"
    ifsc_match = re.search(ifsc_pattern, text)
    if ifsc_match:
        val = ifsc_match.group(1).strip()
        start = max(0, ifsc_match.start() - 15)
        end = min(len(text), ifsc_match.end() + 20)
        facts.append(
            ExtractedFact(
                factType=FactType.BANK_IFSC_CODE,
                value=val,
                confidence=0.95,
                sourcePage=page_num,
                evidence=truncate_evidence(text[start:end]),
                sensitivity=FactSensitivity.HIGHLY_SENSITIVE,
            )
        )

    # 5. Bank Name
    bank_patterns = [
        r"(?i)\b(State\s+Bank\s+of\s+India|HDFC\s+Bank|ICICI\s+Bank|Punjab\s+National\s+Bank|Bank\s+of\s+Baroda|Canara\s+Bank|Axis\s+Bank|Union\s+Bank\s+of\s+India)\b",
    ]
    for b_pat in bank_patterns:
        b_match = re.search(b_pat, text)
        if b_match:
            val = b_match.group(1).strip()
            start = max(0, b_match.start() - 15)
            end = min(len(text), b_match.end() + 25)
            facts.append(
                ExtractedFact(
                    factType=FactType.BANK_NAME,
                    value=val,
                    confidence=0.92,
                    sourcePage=page_num,
                    evidence=truncate_evidence(text[start:end]),
                    sensitivity=FactSensitivity.NON_SENSITIVE,
                )
            )
            break

    # 6. Income Amount
    income_patterns = [
        r"(?i)(?:Annual\s+(?:Family\s+)?Income|Gross\s+Income|Total\s+Income)\s*[:\-]?\s*(?:Rs\.?|INR)?\s*([0-9,]+(?:\.\d{2})?)",
        r"(?i)(?:Rs\.?|INR)\s*([0-9,]+(?:\.\d{2})?)\s*(?:/-\s*)?(?:per\s+annum|\(Annual\))",
    ]
    for in_pat in income_patterns:
        in_match = re.search(in_pat, text)
        if in_match:
            raw_val = in_match.group(1).strip()
            start = max(0, in_match.start() - 15)
            end = min(len(text), in_match.end() + 30)
            facts.append(
                ExtractedFact(
                    factType=FactType.INCOME_AMOUNT,
                    value=f"Rs. {raw_val}",
                    confidence=0.88,
                    sourcePage=page_num,
                    evidence=truncate_evidence(text[start:end]),
                    sensitivity=FactSensitivity.SENSITIVE,
                )
            )
            break

    # 7. Percentage Marks or CGPA
    marks_patterns = [
        (r"(?i)(?:Percentage|Aggregate\s+Marks|Percentage\s+of\s+Marks)\s*[:\-]?\s*([0-9]{2}(?:\.[0-9]{1,2})?)\s*%", FactType.PERCENTAGE_MARKS),
        (r"(?i)(?:CGPA|Cumulative\s+Grade\s+Point\s+Average)\s*[:\-]?\s*([0-9]\.[0-9]{1,2}(?:\s*/\s*10)?)", FactType.GRADE_OR_CGPA),
    ]
    for m_pat, f_type in marks_patterns:
        m_match = re.search(m_pat, text)
        if m_match:
            val = m_match.group(1).strip()
            if f_type == FactType.PERCENTAGE_MARKS:
                val = f"{val}%"
            start = max(0, m_match.start() - 15)
            end = min(len(text), m_match.end() + 25)
            facts.append(
                ExtractedFact(
                    factType=f_type,
                    value=val,
                    confidence=0.90,
                    sourcePage=page_num,
                    evidence=truncate_evidence(text[start:end]),
                    sensitivity=FactSensitivity.NON_SENSITIVE,
                )
            )
            break

    # 8. Examination Year
    year_pattern = r"(?i)(?:Passing\s+Year|Year\s+of\s+Passing|Examination\s+Year|Academic\s+Year)\s*[:\-]?\s*(20\d\d)"
    year_match = re.search(year_pattern, text)
    if year_match:
        val = year_match.group(1).strip()
        start = max(0, year_match.start() - 15)
        end = min(len(text), year_match.end() + 20)
        facts.append(
            ExtractedFact(
                factType=FactType.EXAMINATION_YEAR,
                value=val,
                confidence=0.88,
                sourcePage=page_num,
                evidence=truncate_evidence(text[start:end]),
                sensitivity=FactSensitivity.NON_SENSITIVE,
            )
        )

    # 9. Institution Name
    inst_patterns = [
        r"(?i)(?:Institution|College|School|University)\s*[:\-]\s*([A-Za-z0-9\s,\.]{4,60})",
        r"(?i)\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:University|Institute\s+of\s+Technology|College\s+of\s+Engineering))\b",
    ]
    for i_pat in inst_patterns:
        i_match = re.search(i_pat, text)
        if i_match:
            val = i_match.group(1).strip()
            clean_val = re.split(r"[\n\r]", val)[0].strip()
            if len(clean_val) > 5 and len(clean_val) < 80:
                start = max(0, i_match.start() - 10)
                end = min(len(text), i_match.end() + 30)
                facts.append(
                    ExtractedFact(
                        factType=FactType.INSTITUTION_NAME,
                        value=clean_val,
                        confidence=0.85,
                        sourcePage=page_num,
                        evidence=truncate_evidence(text[start:end]),
                        sensitivity=FactSensitivity.NON_SENSITIVE,
                    )
                )
                break

    # 10. Domicile State
    state_pattern = r"(?i)(?:Domicile\s+State|State\s+of\s+Domicile|Resident\s+of\s+State)\s*[:\-]?\s*([A-Za-z\s]{3,30})"
    state_match = re.search(state_pattern, text)
    if state_match:
        val = state_match.group(1).strip()
        clean_val = re.split(r"[\n\r,]", val)[0].strip()
        start = max(0, state_match.start() - 15)
        end = min(len(text), state_match.end() + 25)
        facts.append(
            ExtractedFact(
                factType=FactType.DOMICILE_STATE,
                value=clean_val,
                confidence=0.88,
                sourcePage=page_num,
                evidence=truncate_evidence(text[start:end]),
                sensitivity=FactSensitivity.NON_SENSITIVE,
            )
        )

    # 11. Certificate Number
    cert_pattern = r"(?i)(?:Certificate\s+No|Certificate\s+Number|Cert\s+No|Ref\s+No)\s*[:\-\.]?\s*([A-Z0-9\/\-]{4,30})"
    cert_match = re.search(cert_pattern, text)
    if cert_match:
        val = cert_match.group(1).strip()
        start = max(0, cert_match.start() - 15)
        end = min(len(text), cert_match.end() + 25)
        facts.append(
            ExtractedFact(
                factType=FactType.CERTIFICATE_NUMBER,
                value=val,
                confidence=0.92,
                sourcePage=page_num,
                evidence=truncate_evidence(text[start:end]),
                sensitivity=FactSensitivity.NON_SENSITIVE,
            )
        )

    return facts


def extract_document_facts(doc: DocumentRepresentation) -> List[ExtractedFact]:
    """Extract and aggregate facts from all pages in the document.
    
    Grounds each fact with page number and evidence snippet.
    Deduplicates and limits total facts to MAX_FACTS_COUNT.
    """
    all_facts: List[ExtractedFact] = []
    seen_keys: set[str] = set()

    for page in doc.pages:
        page_facts = _extract_page_facts(page)
        # Store facts in page representation
        page.detectedFacts = page_facts

        for fact in page_facts:
            key = f"{fact.factType}:{fact.value.lower()}"
            if key not in seen_keys:
                seen_keys.add(key)
                all_facts.append(fact)
                if len(all_facts) >= MAX_FACTS_COUNT:
                    break
        if len(all_facts) >= MAX_FACTS_COUNT:
            break

    return all_facts
