/**
 * ACCESSOS Citizen Profile Defaults & Templates
 */
import type { UserProfile } from './types';

export const EMPTY_PROFILE: UserProfile = {
  id: 'usr-default',
  version: 1,
  lastUpdated: Date.now(),
  isComplete: false,
  personal: {
    fullName: '',
    dob: '',
    gender: '',
    category: '',
    domicileState: '',
    domicileCertNo: '',
    differentlyAbled: 'no',
  },
  contact: {
    email: '',
    phone: '',
    altPhone: '',
    addressLine1: '',
    addressLine2: '',
    district: '',
    state: '',
    pincode: '',
  },
  academic: {
    institutionName: '',
    courseName: '',
    rollNumber: '',
    currentYear: '',
    previousExam: '',
    percentageMarks: '',
    cgpa: '',
  },
  banking: {
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    annualFamilyIncome: '',
    parentName: '',
    parentOccupation: '',
  },
};

export const DEFAULT_VERIFIED_PROFILE: UserProfile = {
  id: 'usr-verified-aarav',
  version: 1,
  lastUpdated: Date.now(),
  isComplete: true,
  personal: {
    fullName: 'Aarav Sharma',
    dob: '2003-08-14',
    gender: 'male',
    category: 'OBC',
    domicileState: 'Maharashtra',
    domicileCertNo: 'MH-DOM-2024-884102',
    differentlyAbled: 'no',
  },
  contact: {
    email: 'aarav.sharma@example.edu.in',
    phone: '9876543210',
    altPhone: '9876543211',
    addressLine1: 'Flat 402, Shanti Heights, MG Road',
    addressLine2: 'Near Shivaji Nagar Metro',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
  },
  academic: {
    institutionName: 'Apex National Institute of Science & Technology',
    courseName: 'Bachelor of Technology (Computer Science)',
    rollNumber: 'CS-2022-049',
    currentYear: '3',
    previousExam: 'Higher Secondary Certificate (Class 12)',
    percentageMarks: '88.5',
    cgpa: '8.8',
  },
  banking: {
    accountHolderName: 'Aarav Sharma',
    bankName: 'State Bank of India',
    accountNumber: '987654321012',
    ifscCode: 'SBIN0001234',
    annualFamilyIncome: '180000',
    parentName: 'Ramesh Sharma',
    parentOccupation: 'Farmer / Agriculturalist',
  },
};
