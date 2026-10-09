"""Deterministic fallback and offline explanation generator for Phase 7 Explain Anything."""
import re
from typing import Dict, List, Optional
from app.explain.schemas import (
    ExplainAnythingRequest,
    ExplainAnythingResponse,
    ExplanationMode,
    TermDefinition,
)

# Known institutional, legal, and scholarship portal terminology definitions
KNOWN_DOMAIN_EXPLANATIONS: Dict[str, Dict[str, any]] = {
    "statutory quota": {
        "simple": "A portion of openings or grants legally reserved for specific applicant categories by government regulations.",
        "detailed": "A statutory quota refers to seat or funding allocations mandated by law for designated social, regional, or economic groups to ensure equitable access.",
        "whyItMatters": "This determines whether your application is reviewed under general competition or a reserved legal quota.",
        "keyPoints": [
            "Mandated by statutory government regulations.",
            "Requires specific documentation to prove quota qualification.",
            "Affects reservation percentages and ranking thresholds."
        ],
        "terms": [
            ("Statutory", "Required by official law or legal statutes."),
            ("Quota", "A set portion or guaranteed limit of allocated spots or funds.")
        ],
        "example": "For example, if 15% of scholarships are set aside for regional domicile applicants, that designated 15% is a statutory quota."
    },
    "statutory quota sub-allocation": {
        "simple": "A smaller reserved group inside a larger legally protected category.",
        "detailed": "A statutory quota sub-allocation divides an existing legally reserved quota into more specific sub-categories, such as allocations for rural candidates within a state quota.",
        "whyItMatters": "You may qualify for an even more targeted allocation if you meet sub-category residency or community criteria.",
        "keyPoints": [
            "A division within a primary legal quota.",
            "Requires verification for both the primary quota and the specific sub-category.",
            "Helps distribute opportunities fairly among subgroups."
        ],
        "terms": [
            ("Statutory", "Mandated by formal legal enactment."),
            ("Sub-allocation", "A secondary division of a main assigned portion.")
        ],
        "example": "If a state reserves 20 scholarships, and divides 5 of them specifically for border district residents, those 5 are a statutory quota sub-allocation."
    },
    "domicile": {
        "simple": "Your official permanent legal residence according to government records.",
        "detailed": "Domicile is the state or region where you legally and permanently reside, distinct from temporary accommodation.",
        "whyItMatters": "Scholarship eligibility and state-funded quotas frequently depend on proving permanent residency in that jurisdiction.",
        "keyPoints": [
            "Represents official legal residence, not temporary student housing.",
            "Usually proven via a formal Domicile Certificate or residency card.",
            "Determines state-level scholarship eligibility."
        ],
        "terms": [
            ("Domicile", "The jurisdiction where a person has their permanent legal home.")
        ],
        "example": "If you study in State B but your permanent family home and legal registration are in State A, your domicile is State A."
    },
    "statutory domicile reservation quota": {
        "simple": "Scholarship positions specifically reserved by law for permanent state residents.",
        "detailed": "A statutory domicile reservation quota is a legally enforced policy setting aside a specific percentage of scholarships exclusively for applicants who legally reside in the sponsoring state or region.",
        "whyItMatters": "Applicants holding an official domicile certificate can apply for these reserved spots rather than the nationwide general category.",
        "keyPoints": [
            "Reserved exclusively for verified permanent residents.",
            "Requires submitting a government-certified domicile document.",
            "Often has distinct selection criteria compared to general open categories."
        ],
        "terms": [
            ("Domicile", "Official permanent legal residence."),
            ("Reservation Quota", "A percentage of allocations legally protected for specific groups.")
        ],
        "example": "A scholarship program may reserve 40% of its grants exclusively for students possessing a valid domicile certificate in that province."
    },
    "annual gross household income": {
        "simple": "The total amount of money earned by all family members combined in a year, before taxes or deductions.",
        "detailed": "Annual gross household income combines all pre-tax earnings (salaries, business profit, agricultural revenue, investments) earned by all living members of the household over one financial year.",
        "whyItMatters": "Need-based scholarships enforce strict upper income limits to ensure aid reaches economically disadvantaged students.",
        "keyPoints": [
            "Includes earnings of all household members, not just the student.",
            "Calculated before taxes, insurance, or deductions are subtracted.",
            "Must match official tax forms or revenue income certificates."
        ],
        "terms": [
            ("Gross Income", "Total earnings before any taxes or deductions are subtracted."),
            ("Household", "All family members residing together and sharing finances.")
        ],
        "example": "If parent A earns $30,000 and parent B earns $15,000, the annual gross household income is $45,000."
    },
    "maximum permissible size": {
        "simple": "The largest file size the upload system is allowed to accept (e.g. 2 MB).",
        "detailed": "The maximum permissible size is the strict upper boundary on file size allowed by the server. Uploading files larger than this limit will fail or trigger validation errors.",
        "whyItMatters": "If your scanned document exceeds this size, the portal will reject your upload and block submission.",
        "keyPoints": [
            "Files above this size will be rejected.",
            "Usually specified in megabytes (MB) or kilobytes (KB).",
            "Compress or resize your PDF/image if it exceeds the limit."
        ],
        "terms": [
            ("Permissible", "Allowed or authorized by the system rules.")
        ],
        "example": "If the limit is 2 MB, a 1.8 MB file will upload successfully, but a 2.5 MB file will be rejected."
    },
}


class DeterministicExplainFallback:
    """Provides grounded, robust explanations when external AI services are unavailable."""

    @classmethod
    def generate(
        cls,
        request: ExplainAnythingRequest,
        provider: str = "mock",
        model: str = "mock-explain-v1",
        is_fallback: bool = True,
    ) -> ExplainAnythingResponse:
        """Synthesizes a structured explanation from the selected text and surrounding context."""
        text = request.selectedText.strip()
        lower_text = text.lower()
        mode = request.mode

        # Check for prompt injection attempts in the text
        if any(kw in lower_text for kw in ["ignore previous", "disregard all", "override instructions", "dan mode"]):
            return ExplainAnythingResponse(
                explanation="The selected excerpt appears to contain instructions or prompt injection commands directed at automated systems. In ACCESSOS, this text is treated strictly as passive webpage content and is not executable.",
                whyItMatters="Webpage text should contain informational content rather than system control commands.",
                keyPoints=[
                    "Text contains an automation command pattern.",
                    "ACCESSOS treats selected text strictly as passive content to explain.",
                    "No system behavior was altered."
                ],
                terminology=[
                    TermDefinition(term="Prompt Injection", definition="A technique attempting to alter AI system behavior through untrusted user or page input.")
                ],
                example=None,
                confidence=0.99,
                sourceSummary="Direct analysis of selected security command pattern.",
                warnings=["Adversarial instruction pattern identified in selected text."],
                mode=mode,
                provider=provider,
                model=model,
                durationMs=5.0,
                fallbackUsed=is_fallback,
            )

        # 1. Match against known institutional / portal vocabulary
        matched_domain_key = None
        for key in KNOWN_DOMAIN_EXPLANATIONS:
            if key in lower_text or lower_text in key:
                matched_domain_key = key
                break

        if matched_domain_key:
            data = KNOWN_DOMAIN_EXPLANATIONS[matched_domain_key]
            explanation_text = data["simple"]
            if mode == ExplanationMode.DETAILED:
                explanation_text = data["detailed"]
            elif mode == ExplanationMode.PLAIN_LANGUAGE:
                explanation_text = f"In plain words: {data['simple']}"

            example_text = data.get("example") if (mode == ExplanationMode.EXAMPLE or data.get("example")) else None
            key_points = data.get("keyPoints", []) if mode in (ExplanationMode.KEY_POINTS, ExplanationMode.DETAILED) else data.get("keyPoints", [])[:2]

            terms = [TermDefinition(term=t[0], definition=t[1]) for t in data.get("terms", [])]

            return ExplainAnythingResponse(
                explanation=explanation_text,
                whyItMatters=data.get("whyItMatters"),
                keyPoints=key_points,
                terminology=terms,
                example=example_text,
                confidence=0.95,
                sourceSummary=f"Grounded in verified institutional terminology for '{matched_domain_key}'.",
                warnings=[],
                mode=mode,
                provider=provider,
                model=model,
                durationMs=6.5,
                fallbackUsed=is_fallback,
            )

        # 2. General fallback for arbitrary selected text
        # Clean up text and create a concise plain-language explanation
        clean_text = re.sub(r"\s+", " ", text)
        is_instruction = bool(re.search(r"\b(must|shall|please|upload|enter|provide|select|submit|ensure)\b", clean_text, re.I))

        if is_instruction:
            explanation_text = f"This is an instruction telling you what is required: '{clean_text}'."
            why_it_matters = "Following this requirement is necessary to advance or complete the form without errors."
            key_points = [
                f"Action requirement: {clean_text}",
                "Ensure your entered or uploaded details fulfill this condition."
            ]
        else:
            explanation_text = f"This phrase refers to: '{clean_text}'. It describes a specific detail or category on this webpage."
            why_it_matters = "Understanding this term helps ensure you supply the correct information."
            key_points = [
                f"Information term: {clean_text}",
                "Review the surrounding section to verify how it applies to your situation."
            ]

        if mode == ExplanationMode.DETAILED:
            explanation_text = f"Detailed breakdown: {explanation_text} In the context of this portal, this guideline communicates specific criteria you need to review."
        elif mode == ExplanationMode.PLAIN_LANGUAGE:
            explanation_text = f"Plain explanation: {explanation_text}"
        elif mode == ExplanationMode.EXAMPLE:
            example_text = f"For instance, when encountering '{clean_text}', confirm that your personal documents or answers reflect this guideline."
        else:
            example_text = None

        return ExplainAnythingResponse(
            explanation=explanation_text,
            whyItMatters=why_it_matters,
            keyPoints=key_points,
            terminology=[],
            example=example_text if mode == ExplanationMode.EXAMPLE else None,
            confidence=0.88,
            sourceSummary="Direct contextual synthesis from selected webpage text.",
            warnings=["AI provider response unavailable or offline; generated via deterministic explanation fallback."] if is_fallback else [],
            mode=mode,
            provider=provider,
            model=model,
            durationMs=8.0,
            fallbackUsed=is_fallback,
        )
