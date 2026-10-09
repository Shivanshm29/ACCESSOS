"""
ACCESSOS Cross-Field Consistency Engine (Phase 12)
Deterministic consistency checking across available non-sensitive fields.
"""

from typing import Dict, Any, List
from app.completion.schemas import ConsistencyCheckResult, ConsistencyStatus


def evaluate_cross_field_consistency(
    fields_map: Dict[str, Dict[str, Any]]
) -> List[ConsistencyCheckResult]:
    """
    Evaluates deterministic consistency checks across available form fields.
    Does NOT infer sensitive facts or make legal/fraud accusations.
    """
    results: List[ConsistencyCheckResult] = []

    # 1. Domicile State vs Permanent Address State
    domicile_state = fields_map.get("personal_domicile_state", {}).get("value")
    address_state = fields_map.get("address_state", {}).get("value")

    if domicile_state and address_state:
        dom_clean = str(domicile_state).strip().lower()
        addr_clean = str(address_state).strip().lower()
        if dom_clean == addr_clean:
            results.append(
                ConsistencyCheckResult(
                    rule_id="CONSISTENCY_DOMICILE_ADDRESS",
                    rule_name="State of Domicile & Address State Alignment",
                    status=ConsistencyStatus.CONSISTENT,
                    field_ids=["personal_domicile_state", "address_state"],
                    explanation="Domicile state and residential address state match.",
                    is_blocking=False,
                )
            )
        else:
            results.append(
                ConsistencyCheckResult(
                    rule_id="CONSISTENCY_DOMICILE_ADDRESS",
                    rule_name="State of Domicile & Address State Alignment",
                    status=ConsistencyStatus.INCONSISTENT,
                    field_ids=["personal_domicile_state", "address_state"],
                    explanation=(
                        f"State of domicile ('{domicile_state}') differs from residential address state ('{address_state}'). "
                        "Please verify jurisdictional quota eligibility."
                    ),
                    is_blocking=False,
                )
            )
    else:
        results.append(
            ConsistencyCheckResult(
                rule_id="CONSISTENCY_DOMICILE_ADDRESS",
                rule_name="State of Domicile & Address State Alignment",
                status=ConsistencyStatus.INSUFFICIENT_EVIDENCE,
                field_ids=["personal_domicile_state", "address_state"],
                explanation="One or both state fields have not been populated yet.",
                is_blocking=False,
            )
        )

    # 2. Existing Scholarship Conditional Flag vs Details
    scholarship_flag = fields_map.get("family_other_scholarship_flag", {}).get("value")
    scholarship_name = fields_map.get("family_other_scholarship_name", {}).get("value")
    scholarship_amount = fields_map.get("family_other_scholarship_amount", {}).get("value")

    if scholarship_flag == "yes":
        if scholarship_name and scholarship_amount:
            results.append(
                ConsistencyCheckResult(
                    rule_id="CONSISTENCY_SCHOLARSHIP_DETAILS",
                    rule_name="Existing Scholarship Declaration Details",
                    status=ConsistencyStatus.CONSISTENT,
                    field_ids=["family_other_scholarship_flag", "family_other_scholarship_name", "family_other_scholarship_amount"],
                    explanation="Existing scholarship aid details are fully specified.",
                    is_blocking=False,
                )
            )
        else:
            results.append(
                ConsistencyCheckResult(
                    rule_id="CONSISTENCY_SCHOLARSHIP_DETAILS",
                    rule_name="Existing Scholarship Declaration Details",
                    status=ConsistencyStatus.INCONSISTENT,
                    field_ids=["family_other_scholarship_flag", "family_other_scholarship_name", "family_other_scholarship_amount"],
                    explanation="You indicated receipt of existing scholarship aid, but scheme name or amount is missing.",
                    is_blocking=True,
                )
            )
    elif scholarship_flag == "no":
        results.append(
            ConsistencyCheckResult(
                rule_id="CONSISTENCY_SCHOLARSHIP_DETAILS",
                rule_name="Existing Scholarship Declaration Details",
                status=ConsistencyStatus.CONSISTENT,
                field_ids=["family_other_scholarship_flag"],
                explanation="No existing scholarship declared.",
                is_blocking=False,
            )
        )
    else:
        results.append(
            ConsistencyCheckResult(
                rule_id="CONSISTENCY_SCHOLARSHIP_DETAILS",
                rule_name="Existing Scholarship Declaration Details",
                status=ConsistencyStatus.INSUFFICIENT_EVIDENCE,
                field_ids=["family_other_scholarship_flag"],
                explanation="Existing scholarship question has not been answered.",
                is_blocking=False,
            )
        )

    # 3. Applicant Full Name vs Account Holder Name
    applicant_name = fields_map.get("applicant_full_name", {}).get("value")
    account_holder = fields_map.get("bank_account_holder", {}).get("value")

    if applicant_name and account_holder:
        app_norm = " ".join(str(applicant_name).strip().lower().split())
        acc_norm = " ".join(str(account_holder).strip().lower().split())
        if app_norm == acc_norm:
            results.append(
                ConsistencyCheckResult(
                    rule_id="CONSISTENCY_NAME_ACCOUNT_HOLDER",
                    rule_name="Applicant Legal Name & Bank Account Holder Name",
                    status=ConsistencyStatus.CONSISTENT,
                    field_ids=["applicant_full_name", "bank_account_holder"],
                    explanation="Applicant name and DBT bank account holder name match exactly.",
                    is_blocking=False,
                )
            )
        else:
            results.append(
                ConsistencyCheckResult(
                    rule_id="CONSISTENCY_NAME_ACCOUNT_HOLDER",
                    rule_name="Applicant Legal Name & Bank Account Holder Name",
                    status=ConsistencyStatus.INCONSISTENT,
                    field_ids=["applicant_full_name", "bank_account_holder"],
                    explanation=(
                        f"Applicant name ('{applicant_name}') does not match bank account holder name ('{account_holder}'). "
                        "DBT disbursements require an account in the applicant's own name."
                    ),
                    is_blocking=True,
                )
            )
    else:
        results.append(
            ConsistencyCheckResult(
                rule_id="CONSISTENCY_NAME_ACCOUNT_HOLDER",
                rule_name="Applicant Legal Name & Bank Account Holder Name",
                status=ConsistencyStatus.INSUFFICIENT_EVIDENCE,
                field_ids=["applicant_full_name", "bank_account_holder"],
                explanation="Applicant name or bank account holder name is not yet entered.",
                is_blocking=False,
            )
        )

    return results
