"""
Phase 12 Completion Checker Backend Tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.completion.schemas import (
    CompletionStatus,
    RequirementType,
    ConsistencyStatus,
)
from app.completion.checker import evaluate_completion
from app.completion.consistency import evaluate_cross_field_consistency

client = TestClient(app)


def test_completion_health_endpoint():
    response = client.get("/api/v1/completion/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["module"] == "completion"
    assert data["authoritative"] == "deterministic"


def test_completion_all_required_fields_populated_complete():
    rep = {
        "fields": [
            {
                "id": "applicant_full_name",
                "name": "applicant_full_name",
                "label": "Full Name",
                "required": True,
                "hasValue": True,
                "sectionId": "sec-applicant",
            },
            {
                "id": "applicant_email",
                "name": "applicant_email",
                "label": "Email Address",
                "required": True,
                "hasValue": True,
                "sectionId": "sec-applicant",
            },
        ],
        "errors": [],
    }
    result = evaluate_completion(page_representation=rep)
    assert result.overall_status == CompletionStatus.COMPLETE
    assert result.completion_percent == 100
    assert len(result.blocking_issues) == 0
    assert len(result.completed_requirements) == 2


def test_completion_one_required_field_missing_incomplete():
    rep = {
        "fields": [
            {
                "id": "applicant_full_name",
                "name": "applicant_full_name",
                "label": "Full Name",
                "required": True,
                "hasValue": True,
                "sectionId": "sec-applicant",
            },
            {
                "id": "applicant_email",
                "name": "applicant_email",
                "label": "Email Address",
                "required": True,
                "hasValue": False,
                "sectionId": "sec-applicant",
            },
        ],
        "errors": [],
    }
    result = evaluate_completion(page_representation=rep)
    assert result.overall_status == CompletionStatus.INCOMPLETE
    assert result.completion_percent == 50
    assert len(result.blocking_issues) == 1
    assert result.blocking_issues[0].target_element_id == "applicant_email"
    assert "missing or empty" in result.blocking_issues[0].reason


def test_completion_optional_field_missing_does_not_block():
    rep = {
        "fields": [
            {
                "id": "applicant_full_name",
                "name": "applicant_full_name",
                "label": "Full Name",
                "required": True,
                "hasValue": True,
                "sectionId": "sec-applicant",
            },
            {
                "id": "applicant_nickname",
                "name": "applicant_nickname",
                "label": "Nickname",
                "required": False,
                "hasValue": False,
                "sectionId": "sec-applicant",
            },
        ],
        "errors": [],
    }
    result = evaluate_completion(page_representation=rep)
    assert result.overall_status == CompletionStatus.COMPLETE
    assert len(result.blocking_issues) == 0


def test_completion_validation_error_blocks():
    rep = {
        "fields": [
            {
                "id": "applicant_email",
                "name": "applicant_email",
                "label": "Email Address",
                "required": True,
                "hasValue": True,
                "sectionId": "sec-applicant",
            }
        ],
        "errors": [
            {
                "fieldId": "applicant_email",
                "text": "Invalid email syntax, missing @ domain",
            }
        ],
    }
    result = evaluate_completion(page_representation=rep)
    assert result.overall_status == CompletionStatus.INVALID
    assert len(result.blocking_issues) == 1
    assert "Validation error" in result.blocking_issues[0].reason


def test_completion_sensitive_field_state_reported_without_exposing_value():
    rep = {
        "fields": [
            {
                "id": "bank_account_number",
                "name": "bank_account_number",
                "label": "Bank Account Number",
                "required": True,
                "hasValue": True,
                "sensitive": True,
                "sectionId": "sec-bank",
            }
        ],
        "errors": [],
    }
    form_values = {"bank_account_number": "998877665544"}
    result = evaluate_completion(page_representation=rep, form_values=form_values)

    # Sensitive field is marked complete and sensitive: True
    req = result.completed_requirements[0]
    assert req.sensitive is True
    assert req.status == CompletionStatus.COMPLETE

    # Verify sensitive account number does NOT appear anywhere in the result
    dumped = result.model_dump_json()
    assert "998877665544" not in dumped


def test_completion_document_matching_states():
    rep = {"fields": [], "errors": []}
    doc_matches = [
        {
            "requirementId": "req-income",
            "documentType": "INCOME_CERTIFICATE",
            "title": "Income Certificate",
            "matchStatus": "MATCH",
            "documentName": "income.pdf",
            "confidence": 0.95,
            "evidence": "Annual Income: 120,000 INR",
        },
        {
            "requirementId": "req-marksheet",
            "documentType": "ACADEMIC_MARKSHEET",
            "title": "Qualifying Marksheet",
            "matchStatus": "NO_MATCH",
            "documentName": "photo.jpg",
        },
    ]
    result = evaluate_completion(page_representation=rep, document_matches=doc_matches)
    assert result.overall_status == CompletionStatus.BLOCKED
    assert len(result.blocking_issues) == 1
    assert result.blocking_issues[0].id == "req-doc-req-marksheet"
    assert result.document_requirements[0].is_satisfied is True
    assert result.document_requirements[1].is_satisfied is False


def test_cross_field_consistency_checks():
    fields_map = {
        "personal_domicile_state": {"value": "Maharashtra"},
        "address_state": {"value": "Karnataka"},
        "applicant_full_name": {"value": "Devansh Varma"},
        "bank_account_holder": {"value": "Sunita Varma"},  # Mismatch
        "family_other_scholarship_flag": {"value": "yes"},
        "family_other_scholarship_name": {"value": None},   # Missing details
    }
    checks = evaluate_cross_field_consistency(fields_map)
    checks_by_id = {c.rule_id: c for c in checks}

    assert checks_by_id["CONSISTENCY_DOMICILE_ADDRESS"].status == ConsistencyStatus.INCONSISTENT
    assert checks_by_id["CONSISTENCY_NAME_ACCOUNT_HOLDER"].status == ConsistencyStatus.INCONSISTENT
    assert checks_by_id["CONSISTENCY_NAME_ACCOUNT_HOLDER"].is_blocking is True
    assert checks_by_id["CONSISTENCY_SCHOLARSHIP_DETAILS"].status == ConsistencyStatus.INCONSISTENT
    assert checks_by_id["CONSISTENCY_SCHOLARSHIP_DETAILS"].is_blocking is True


def test_evaluate_endpoint_post():
    payload = {
        "representation": {
            "fields": [
                {
                    "id": "applicant_full_name",
                    "name": "applicant_full_name",
                    "label": "Full Name",
                    "required": True,
                    "hasValue": True,
                }
            ],
            "errors": [],
        },
        "formValues": {"applicant_full_name": "Devansh Varma"},
        "documentMatches": [],
        "currentStageIndex": 0,
    }
    response = client.post("/api/v1/completion/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "COMPLETE"
    assert data["completion_percent"] == 100
