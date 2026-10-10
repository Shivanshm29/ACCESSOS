/**
 * ACCESSOS Citizen Profile Vault Types
 *
 * Strongly typed contracts for pre-storing verified citizen/student profile data
 * and assistively mapping/filling it into institutional and government web forms.
 */

export interface UserProfilePersonal {
  fullName: string;
  dob: string; // YYYY-MM-DD
  gender: string; // 'male' | 'female' | 'transgender' | 'prefer_not_to_say' | string
  category: string; // 'General' | 'OBC' | 'SC' | 'ST' | 'EWS' | string
  domicileState: string;
  domicileCertNo?: string;
  differentlyAbled?: string; // 'yes' | 'no'
}

export interface UserProfileContact {
  email: string;
  phone: string;
  altPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  district: string;
  state: string;
  pincode: string;
}

export interface UserProfileAcademic {
  institutionName: string;
  courseName: string;
  rollNumber: string;
  currentYear: string;
  previousExam: string;
  percentageMarks: string;
  cgpa?: string;
}

export interface UserProfileBanking {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  annualFamilyIncome: string;
  parentName?: string;
  parentOccupation?: string;
}

export interface UserProfile {
  id: string;
  version: number;
  lastUpdated: number;
  isComplete: boolean;
  personal: UserProfilePersonal;
  contact: UserProfileContact;
  academic: UserProfileAcademic;
  banking: UserProfileBanking;
}

export interface ProfileFieldMapping {
  profileKey: string; // e.g. "personal.fullName"
  profileLabel: string;
  profileValue: string;
  formFieldId?: string;
  formFieldName?: string;
  formFieldLabel: string;
  formFieldType?: string;
  confidence: number;
  targetSelector?: string;
}

export interface ProfileMatchResult {
  matches: ProfileFieldMapping[];
  unmatchedFormFields: string[];
  totalMatchable: number;
  timestamp: number;
}

export interface ApplyProfileResult {
  success: boolean;
  appliedCount: number;
  modifiedFields: string[];
  errors: string[];
  timestamp: number;
}
