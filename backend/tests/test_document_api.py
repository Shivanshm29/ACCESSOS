"""Integration tests for Document Intelligence API endpoints (Phase 9)."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.document.schemas import DocumentType, MatchStatus


@pytest.mark.asyncio
async def test_document_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/document/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["phase"] == 9
        assert "application/pdf" in data["supportedMimeTypes"]


@pytest.mark.asyncio
async def test_document_analyze_endpoint_success():
    payload = {
        "filename": "income_cert.txt",
        "text": (
            "GOVERNMENT OF MAHARASHTRA\n"
            "INCOME CERTIFICATE\n"
            "Candidate Name: Devansh Varma\n"
            "Annual Family Income: Rs. 1,80,000\n"
            "Issued by: Tahsildar, Pune\n"
        ),
        "mimeType": "text/plain",
        "pageRequirements": [
            {
                "requirementId": "req_income",
                "targetFieldId": "doc_income_certificate",
                "requirementType": "FILE_UPLOAD",
                "description": "Annual Household Income Certificate",
                "expectedDocumentType": "INCOME_CERTIFICATE",
                "expectedValues": {"applicant_name": "Devansh Varma"},
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/document/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["document"]["documentType"]["category"] == "INCOME_CERTIFICATE"
        assert len(data["extractedFacts"]) >= 2
        assert len(data["requirementMatches"]) == 1
        assert data["requirementMatches"][0]["matchStatus"] == "MATCH"
        assert data["requirementMatches"][0]["suggestedUploadFieldId"] == "doc_income_certificate"
        assert "Devansh Varma" in data["summary"] or "income" in data["summary"].lower()


@pytest.mark.asyncio
async def test_document_analyze_mismatch_endpoint():
    payload = {
        "filename": "bank_statement.txt",
        "text": (
            "STATE BANK OF INDIA\n"
            "PASSBOOK\n"
            "Account Holder Name: Rahul Varma\n"
            "Account Number: 123456789012\n"
            "IFSC: SBIN0001234\n"
        ),
        "mimeType": "text/plain",
        "pageRequirements": [
            {
                "requirementId": "req_bank",
                "targetFieldId": "doc_bank_passbook",
                "requirementType": "FILE_UPLOAD",
                "description": "Bank Passbook Copy",
                "expectedDocumentType": "BANK_DOCUMENT",
                "expectedValues": {"applicant_name": "Devansh Varma"},
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/document/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["document"]["documentType"]["category"] == "BANK_DOCUMENT"
        assert data["requirementMatches"][0]["matchStatus"] == "AMBIGUOUS"
        assert len(data["requirementMatches"][0]["warnings"]) > 0
        assert "mismatch" in data["requirementMatches"][0]["warnings"][0].lower()


@pytest.mark.asyncio
async def test_document_analyze_empty_payload_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/document/analyze", json={"filename": "empty.pdf"})
        assert response.status_code == 400
