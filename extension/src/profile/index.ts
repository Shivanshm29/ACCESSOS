/**
 * ACCESSOS Citizen Profile Vault Module Entry Point
 */
import type { UserProfile } from './types';
import type { ExtractedFact } from '../document/types';

export * from './types';
export * from './defaults';
export * from './storage';
export * from './matcher';
export * from './applicator';

/**
 * Updates an existing user profile with facts extracted from Document Intelligence.
 */
export function mergeFactsIntoProfile(
  profile: UserProfile,
  facts: ExtractedFact[]
): { updatedProfile: UserProfile; updatedFields: string[] } {
  const updated: UserProfile = JSON.parse(JSON.stringify(profile));
  const updatedFields: string[] = [];

  for (const fact of facts) {
    if (!fact.value || fact.confidence < 0.6) continue;
    const val = fact.value.trim();

    switch (fact.factType) {
      case 'APPLICANT_NAME':
        updated.personal.fullName = val;
        updatedFields.push('Full Legal Name');
        break;
      case 'DOB':
        updated.personal.dob = val;
        updatedFields.push('Date of Birth');
        break;
      case 'FATHER_NAME':
        updated.banking.parentName = val;
        updatedFields.push('Parent Name');
        break;
      case 'INSTITUTION_NAME':
        updated.academic.institutionName = val;
        updatedFields.push('Institution Name');
        break;
      case 'PERCENTAGE_MARKS':
        updated.academic.percentageMarks = val;
        updatedFields.push('Percentage Marks');
        break;
      case 'INCOME_AMOUNT':
        updated.banking.annualFamilyIncome = val.replace(/[^0-9]/g, '');
        updatedFields.push('Annual Income');
        break;
      case 'DOMICILE_STATE':
        updated.personal.domicileState = val;
        updatedFields.push('Domicile State');
        break;
      case 'BANK_ACCOUNT_HOLDER':
        updated.banking.accountHolderName = val;
        updatedFields.push('Bank Account Holder');
        break;
      case 'BANK_ACCOUNT_NUMBER':
        updated.banking.accountNumber = val;
        updatedFields.push('Bank Account Number');
        break;
      case 'BANK_NAME':
        updated.banking.bankName = val;
        updatedFields.push('Bank Name');
        break;
      case 'BANK_IFSC_CODE':
        updated.banking.ifscCode = val;
        updatedFields.push('Bank IFSC Code');
        break;
      case 'CERTIFICATE_NUMBER':
        updated.personal.domicileCertNo = val;
        updatedFields.push('Certificate Number');
        break;
    }
  }

  updated.lastUpdated = Date.now();
  return { updatedProfile: updated, updatedFields };
}
