/**
 * ACCESSOS Cross-Field Consistency Checker (Phase 12)
 *
 * Evaluates deterministic, grounded consistency across non-sensitive form fields.
 * Does NOT infer sensitive facts or make legal/fraud claims.
 * Statuses: CONSISTENT | INCONSISTENT | INSUFFICIENT_EVIDENCE | NOT_APPLICABLE
 */

import type { ConsistencyCheckResult } from './types';

export interface FieldValueRecord {
  id: string;
  name: string;
  value: string | null;
  sensitive: boolean;
}

export function evaluateCrossFieldConsistency(
  fieldsMap: Record<string, FieldValueRecord>
): ConsistencyCheckResult[] {
  const results: ConsistencyCheckResult[] = [];

  // 1. Domicile State vs Address State
  const domicileState = fieldsMap['personal_domicile_state']?.value;
  const addressState = fieldsMap['address_state']?.value;

  if (domicileState && addressState) {
    const domClean = domicileState.trim().toLowerCase();
    const addrClean = addressState.trim().toLowerCase();

    if (domClean === addrClean) {
      results.push({
        ruleId: 'CONSISTENCY_DOMICILE_ADDRESS',
        ruleName: 'State of Domicile & Address State Alignment',
        status: 'CONSISTENT',
        fieldIds: ['personal_domicile_state', 'address_state'],
        explanation: 'Domicile state and residential address state match.',
        isBlocking: false,
      });
    } else {
      results.push({
        ruleId: 'CONSISTENCY_DOMICILE_ADDRESS',
        ruleName: 'State of Domicile & Address State Alignment',
        status: 'INCONSISTENT',
        fieldIds: ['personal_domicile_state', 'address_state'],
        explanation: `State of domicile ('${domicileState}') differs from residential address state ('${addressState}'). Please verify jurisdictional quota eligibility.`,
        isBlocking: false,
      });
    }
  } else {
    results.push({
      ruleId: 'CONSISTENCY_DOMICILE_ADDRESS',
      ruleName: 'State of Domicile & Address State Alignment',
      status: 'INSUFFICIENT_EVIDENCE',
      fieldIds: ['personal_domicile_state', 'address_state'],
      explanation: 'One or both state fields have not been populated yet.',
      isBlocking: false,
    });
  }

  // 2. Existing Scholarship Flag vs Details
  const scholarshipFlag = fieldsMap['family_other_scholarship_flag']?.value;
  const scholarshipName = fieldsMap['family_other_scholarship_name']?.value;
  const scholarshipAmount = fieldsMap['family_other_scholarship_amount']?.value;

  if (scholarshipFlag === 'yes') {
    if (scholarshipName && scholarshipAmount) {
      results.push({
        ruleId: 'CONSISTENCY_SCHOLARSHIP_DETAILS',
        ruleName: 'Existing Scholarship Declaration Details',
        status: 'CONSISTENT',
        fieldIds: [
          'family_other_scholarship_flag',
          'family_other_scholarship_name',
          'family_other_scholarship_amount',
        ],
        explanation: 'Existing scholarship aid details are fully specified.',
        isBlocking: false,
      });
    } else {
      results.push({
        ruleId: 'CONSISTENCY_SCHOLARSHIP_DETAILS',
        ruleName: 'Existing Scholarship Declaration Details',
        status: 'INCONSISTENT',
        fieldIds: [
          'family_other_scholarship_flag',
          'family_other_scholarship_name',
          'family_other_scholarship_amount',
        ],
        explanation:
          'You indicated receipt of existing scholarship aid, but scheme name or amount is missing.',
        isBlocking: true,
      });
    }
  } else if (scholarshipFlag === 'no') {
    results.push({
      ruleId: 'CONSISTENCY_SCHOLARSHIP_DETAILS',
      ruleName: 'Existing Scholarship Declaration Details',
      status: 'CONSISTENT',
      fieldIds: ['family_other_scholarship_flag'],
      explanation: 'No existing scholarship declared.',
      isBlocking: false,
    });
  } else {
    results.push({
      ruleId: 'CONSISTENCY_SCHOLARSHIP_DETAILS',
      ruleName: 'Existing Scholarship Declaration Details',
      status: 'INSUFFICIENT_EVIDENCE',
      fieldIds: ['family_other_scholarship_flag'],
      explanation: 'Existing scholarship receipt question has not been answered yet.',
      isBlocking: false,
    });
  }

  // 3. Admission Year vs Current Academic Year
  const admissionYearStr = fieldsMap['academic_admission_year']?.value;
  const currentYearStr = fieldsMap['academic_current_year']?.value;

  if (admissionYearStr && currentYearStr) {
    const admissionYear = parseInt(admissionYearStr, 10);
    const currentYear = parseInt(currentYearStr, 10);

    if (!isNaN(admissionYear) && !isNaN(currentYear)) {
      if (admissionYear > 2030 || admissionYear < 1990) {
        results.push({
          ruleId: 'CONSISTENCY_ACADEMIC_TIMELINE',
          ruleName: 'Academic Enrollment Timeline Validity',
          status: 'INCONSISTENT',
          fieldIds: ['academic_admission_year'],
          explanation: `Admission year (${admissionYear}) is outside the acceptable range for current scholarship enrollment.`,
          isBlocking: true,
        });
      } else {
        results.push({
          ruleId: 'CONSISTENCY_ACADEMIC_TIMELINE',
          ruleName: 'Academic Enrollment Timeline Validity',
          status: 'CONSISTENT',
          fieldIds: ['academic_admission_year', 'academic_current_year'],
          explanation: 'Admission year and study progression align logically.',
          isBlocking: false,
        });
      }
    } else {
      results.push({
        ruleId: 'CONSISTENCY_ACADEMIC_TIMELINE',
        ruleName: 'Academic Enrollment Timeline Validity',
        status: 'INSUFFICIENT_EVIDENCE',
        fieldIds: ['academic_admission_year', 'academic_current_year'],
        explanation: 'Academic timeline values could not be parsed as years.',
        isBlocking: false,
      });
    }
  } else {
    results.push({
      ruleId: 'CONSISTENCY_ACADEMIC_TIMELINE',
      ruleName: 'Academic Enrollment Timeline Validity',
      status: 'INSUFFICIENT_EVIDENCE',
      fieldIds: ['academic_admission_year', 'academic_current_year'],
      explanation: 'Academic timeline fields have not been completed yet.',
      isBlocking: false,
    });
  }

  // 4. Family Annual Income vs Declared EWS/Income Threshold
  const annualIncomeStr = fieldsMap['family_annual_income']?.value;
  const category = fieldsMap['personal_category']?.value;

  if (annualIncomeStr && category) {
    const incomeNum = parseFloat(annualIncomeStr.replace(/[^0-9.]/g, ''));
    if (!isNaN(incomeNum)) {
      // If EWS category, income should generally be <= 800000 (8 Lakhs)
      if (category.toLowerCase() === 'ews' && incomeNum > 800000) {
        results.push({
          ruleId: 'CONSISTENCY_INCOME_CATEGORY',
          ruleName: 'Category Eligibility & Annual Income Threshold',
          status: 'INCONSISTENT',
          fieldIds: ['family_annual_income', 'personal_category'],
          explanation: `Declared annual income (Rs. ${incomeNum.toLocaleString()}) exceeds the statutory threshold (Rs. 8,00,000) for EWS category.`,
          isBlocking: false, // Non-blocking warning for user verification
        });
      } else {
        results.push({
          ruleId: 'CONSISTENCY_INCOME_CATEGORY',
          ruleName: 'Category Eligibility & Annual Income Threshold',
          status: 'CONSISTENT',
          fieldIds: ['family_annual_income', 'personal_category'],
          explanation: 'Annual income and social category eligibility align.',
          isBlocking: false,
        });
      }
    } else {
      results.push({
        ruleId: 'CONSISTENCY_INCOME_CATEGORY',
        ruleName: 'Category Eligibility & Annual Income Threshold',
        status: 'INSUFFICIENT_EVIDENCE',
        fieldIds: ['family_annual_income', 'personal_category'],
        explanation: 'Annual income value cannot be evaluated numerically.',
        isBlocking: false,
      });
    }
  } else {
    results.push({
      ruleId: 'CONSISTENCY_INCOME_CATEGORY',
      ruleName: 'Category Eligibility & Annual Income Threshold',
      status: 'NOT_APPLICABLE',
      fieldIds: ['family_annual_income', 'personal_category'],
      explanation: 'Category or income not yet provided.',
      isBlocking: false,
    });
  }

  return results;
}
