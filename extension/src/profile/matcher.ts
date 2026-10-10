/**
 * ACCESSOS Citizen Profile Matcher Engine
 *
 * Intelligently correlates form fields detected on a webpage against pre-stored
 * citizen profile attributes using fuzzy alias matching and semantic labels.
 * Enforces zero-trust protection against password, credential, and payment inputs.
 */
import type { UserProfile, ProfileFieldMapping, ProfileMatchResult } from './types';
import type { PageRepresentation, FieldInfo } from '../core/types/representation';

interface ProfileAttributeDefinition {
  key: string;
  label: string;
  category: 'personal' | 'contact' | 'academic' | 'banking';
  getValue: (p: UserProfile) => string;
  aliases: string[];
}

const BLOCKED_INPUT_TYPES = new Set(['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image']);
const SENSITIVE_KEYWORDS = [
  'password',
  'pwd',
  'secret',
  'cvv',
  'cvc',
  'credit_card',
  'card_number',
  'otp',
  'auth_token',
  'pin_code_atm',
];

export const PROFILE_ATTRIBUTES: ProfileAttributeDefinition[] = [
  // --- Personal ---
  {
    key: 'personal.fullName',
    label: 'Full Legal Name',
    category: 'personal',
    getValue: (p) => p.personal?.fullName || '',
    aliases: [
      'applicant_full_name',
      'full_name',
      'applicant_name',
      'candidate_name',
      'student_name',
      'legal_name',
      'name_as_per_marksheet',
      'name',
    ],
  },
  {
    key: 'personal.dob',
    label: 'Date of Birth',
    category: 'personal',
    getValue: (p) => p.personal?.dob || '',
    aliases: ['applicant_dob', 'dob', 'date_of_birth', 'birth_date', 'birthdate'],
  },
  {
    key: 'personal.gender',
    label: 'Gender Classification',
    category: 'personal',
    getValue: (p) => p.personal?.gender || '',
    aliases: ['applicant_gender', 'gender', 'sex', 'gender_classification'],
  },
  {
    key: 'personal.category',
    label: 'Social Category',
    category: 'personal',
    getValue: (p) => p.personal?.category || '',
    aliases: ['applicant_category', 'category', 'caste_category', 'social_category', 'community'],
  },
  {
    key: 'personal.domicileState',
    label: 'Domicile State',
    category: 'personal',
    getValue: (p) => p.personal?.domicileState || '',
    aliases: ['domicile_state', 'state_of_domicile', 'domicile', 'native_state'],
  },
  {
    key: 'personal.domicileCertNo',
    label: 'Domicile Certificate Number',
    category: 'personal',
    getValue: (p) => p.personal?.domicileCertNo || '',
    aliases: ['domicile_certificate_no', 'domicile_cert_no', 'domicile_certificate', 'certificate_no'],
  },
  {
    key: 'personal.differentlyAbled',
    label: 'Persons with Disability (PwD)',
    category: 'personal',
    getValue: (p) => p.personal?.differentlyAbled || 'no',
    aliases: ['differently_abled', 'pwd_status', 'disability_status'],
  },

  // --- Contact ---
  {
    key: 'contact.email',
    label: 'Email Address',
    category: 'contact',
    getValue: (p) => p.contact?.email || '',
    aliases: ['applicant_email', 'email', 'email_address', 'primary_email'],
  },
  {
    key: 'contact.phone',
    label: 'Mobile Phone Number',
    category: 'contact',
    getValue: (p) => p.contact?.phone || '',
    aliases: ['applicant_phone', 'phone', 'mobile', 'mobile_no', 'contact_number', 'phone_number'],
  },
  {
    key: 'contact.altPhone',
    label: 'Alternate Contact Number',
    category: 'contact',
    getValue: (p) => p.contact?.altPhone || '',
    aliases: ['applicant_alternate_contact', 'alternate_phone', 'alt_phone', 'secondary_phone', 'alternate_contact'],
  },
  {
    key: 'contact.addressLine1',
    label: 'Residential Address (Line 1)',
    category: 'contact',
    getValue: (p) => p.contact?.addressLine1 || '',
    aliases: ['address_line1', 'address1', 'street_address', 'permanent_address', 'residential_address', 'address'],
  },
  {
    key: 'contact.addressLine2',
    label: 'Residential Address (Line 2)',
    category: 'contact',
    getValue: (p) => p.contact?.addressLine2 || '',
    aliases: ['address_line2', 'address2', 'locality', 'suburb'],
  },
  {
    key: 'contact.district',
    label: 'District',
    category: 'contact',
    getValue: (p) => p.contact?.district || '',
    aliases: ['address_district', 'district', 'city_district'],
  },
  {
    key: 'contact.state',
    label: 'State',
    category: 'contact',
    getValue: (p) => p.contact?.state || '',
    aliases: ['address_state', 'state', 'province'],
  },
  {
    key: 'contact.pincode',
    label: 'Postal PIN Code',
    category: 'contact',
    getValue: (p) => p.contact?.pincode || '',
    aliases: ['address_pincode', 'pincode', 'pin_code', 'pin', 'postal_code', 'zip', 'zipcode'],
  },

  // --- Academic ---
  {
    key: 'academic.institutionName',
    label: 'Enrolled Institution / College',
    category: 'academic',
    getValue: (p) => p.academic?.institutionName || '',
    aliases: ['academic_institution', 'institution', 'college', 'college_name', 'school_name', 'university'],
  },
  {
    key: 'academic.courseName',
    label: 'Degree / Course Name',
    category: 'academic',
    getValue: (p) => p.academic?.courseName || '',
    aliases: ['academic_course', 'course', 'degree', 'program', 'course_name'],
  },
  {
    key: 'academic.rollNumber',
    label: 'Academic Roll / Registration Number',
    category: 'academic',
    getValue: (p) => p.academic?.rollNumber || '',
    aliases: ['academic_roll_no', 'roll_no', 'roll_number', 'registration_no', 'reg_no', 'enrollment_no'],
  },
  {
    key: 'academic.currentYear',
    label: 'Current Academic Year',
    category: 'academic',
    getValue: (p) => p.academic?.currentYear || '',
    aliases: ['academic_current_year', 'current_year', 'year_of_study', 'academic_year'],
  },
  {
    key: 'academic.previousExam',
    label: 'Previous Qualifying Examination',
    category: 'academic',
    getValue: (p) => p.academic?.previousExam || '',
    aliases: ['academic_prev_exam', 'prev_exam', 'qualifying_exam', 'previous_examination'],
  },
  {
    key: 'academic.percentageMarks',
    label: 'Percentage / Score in Qualifying Exam',
    category: 'academic',
    getValue: (p) => p.academic?.percentageMarks || '',
    aliases: ['academic_percentage', 'percentage', 'percentage_marks', 'marks_percentage', 'aggregate_percentage'],
  },

  // --- Banking & Family ---
  {
    key: 'banking.annualFamilyIncome',
    label: 'Annual Family Income',
    category: 'banking',
    getValue: (p) => p.banking?.annualFamilyIncome || '',
    aliases: ['family_annual_income', 'annual_income', 'family_income', 'total_income'],
  },
  {
    key: 'banking.parentName',
    label: 'Parent / Guardian Name',
    category: 'banking',
    getValue: (p) => p.banking?.parentName || '',
    aliases: ['parent_guardian_name', 'parent_name', 'father_name', 'guardian_name'],
  },
  {
    key: 'banking.parentOccupation',
    label: 'Parent / Guardian Occupation',
    category: 'banking',
    getValue: (p) => p.banking?.parentOccupation || '',
    aliases: ['parent_occupation', 'occupation', 'father_occupation'],
  },
  {
    key: 'banking.bankName',
    label: 'Bank Name',
    category: 'banking',
    getValue: (p) => p.banking?.bankName || '',
    aliases: ['bank_name', 'name_of_bank', 'bank'],
  },
  {
    key: 'banking.accountHolderName',
    label: 'Account Holder Name',
    category: 'banking',
    getValue: (p) => p.banking?.accountHolderName || '',
    aliases: ['bank_account_holder', 'account_holder', 'holder_name', 'account_name'],
  },
  {
    key: 'banking.accountNumber',
    label: 'Bank Account Number',
    category: 'banking',
    getValue: (p) => p.banking?.accountNumber || '',
    aliases: [
      'bank_account_number',
      'bank_account_confirm',
      'account_number',
      'account_no',
      'bank_acc_no',
    ],
  },
  {
    key: 'banking.ifscCode',
    label: 'Bank IFSC Code',
    category: 'banking',
    getValue: (p) => p.banking?.ifscCode || '',
    aliases: ['bank_ifsc', 'ifsc', 'ifsc_code', 'bank_ifsc_code'],
  },
];

/**
 * Checks if a field is sensitive or blocked.
 */
export function isFieldBlocked(field: { type?: string; name?: string; id?: string }): boolean {
  const type = (field.type || '').toLowerCase();
  if (BLOCKED_INPUT_TYPES.has(type)) return true;

  const identifiers = `${field.name || ''} ${field.id || ''}`.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => identifiers.includes(kw));
}

/**
 * Normalizes string for fuzzy token comparison.
 */
function normalizeIdentifier(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Matches extracted page fields against user profile data.
 */
export function matchProfileToPage(
  fields: Array<FieldInfo | { id?: string; name?: string; label?: string; type?: string; tag?: string }>,
  profile: UserProfile
): ProfileMatchResult {
  const matches: ProfileFieldMapping[] = [];
  const unmatchedFormFields: string[] = [];
  const matchedFieldIdentifiers = new Set<string>();

  for (const field of fields) {
    const rawId = ('elementId' in field && field.elementId) || field.id || '';
    const rawName = field.name || '';
    const rawLabel = ('label' in field && field.label) || '';
    const fieldType = field.type || 'text';

    const fieldKey = rawId || rawName;
    if (!fieldKey || matchedFieldIdentifiers.has(fieldKey)) {
      continue;
    }

    // Safety gate: skip blocked & password inputs
    if (isFieldBlocked({ type: fieldType, name: rawName, id: rawId })) {
      unmatchedFormFields.push(fieldKey);
      continue;
    }

    const normId = normalizeIdentifier(rawId);
    const normName = normalizeIdentifier(rawName);
    const normLabel = normalizeIdentifier(rawLabel);

    let bestAttr: ProfileAttributeDefinition | null = null;
    let bestScore = 0;

    for (const attr of PROFILE_ATTRIBUTES) {
      const val = attr.getValue(profile);
      if (!val || val.trim() === '') continue; // Profile has no value for this attribute

      for (const alias of attr.aliases) {
        const normAlias = normalizeIdentifier(alias);

        // 1. Exact match with ID or Name
        if (normId === normAlias || normName === normAlias) {
          if (1.0 > bestScore) {
            bestScore = 1.0;
            bestAttr = attr;
          }
          break;
        }

        // 2. Substring match on ID or Name
        if (normId.includes(normAlias) || normName.includes(normAlias)) {
          if (0.85 > bestScore) {
            bestScore = 0.85;
            bestAttr = attr;
          }
        }

        // 3. Substring match on Label
        if (normLabel && (normLabel.includes(normAlias) || normAlias.includes(normLabel))) {
          if (0.75 > bestScore) {
            bestScore = 0.75;
            bestAttr = attr;
          }
        }
      }
    }

    if (bestAttr && bestScore >= 0.75) {
      const profileVal = bestAttr.getValue(profile);
      matches.push({
        profileKey: bestAttr.key,
        profileLabel: bestAttr.label,
        profileValue: profileVal,
        formFieldId: rawId || undefined,
        formFieldName: rawName || undefined,
        formFieldLabel: rawLabel || bestAttr.label,
        formFieldType: fieldType,
        confidence: bestScore,
        targetSelector: rawId ? `#${rawId}` : rawName ? `[name="${rawName}"]` : undefined,
      });
      matchedFieldIdentifiers.add(fieldKey);
    } else {
      unmatchedFormFields.push(fieldKey);
    }
  }

  return {
    matches,
    unmatchedFormFields,
    totalMatchable: matches.length,
    timestamp: Date.now(),
  };
}

/**
 * Convenience helper to match directly from a PageRepresentation.
 */
export function matchProfileToRepresentation(
  representation: PageRepresentation,
  profile: UserProfile
): ProfileMatchResult {
  if (!representation || !Array.isArray(representation.fields)) {
    return {
      matches: [],
      unmatchedFormFields: [],
      totalMatchable: 0,
      timestamp: Date.now(),
    };
  }
  return matchProfileToPage(representation.fields, profile);
}
