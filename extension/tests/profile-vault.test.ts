/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  userProfileStorage,
  DEFAULT_VERIFIED_PROFILE,
  EMPTY_PROFILE,
  matchProfileToPage,
  matchProfileToRepresentation,
  applyProfileFields,
  mergeFactsIntoProfile,
  isFieldBlocked,
  type UserProfile,
} from '../src/profile/index';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { DemoResetManager, demoResetManager } from '../src/demo/reset';
import type { ExtractedFact } from '../src/document/types';

describe('Phase 18 — Citizen Profile Vault & Smart Fill Test Suite', () => {
  let mockStorage: Record<string, unknown>;

  beforeEach(() => {
    mockStorage = {};
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            keys.forEach((k) => {
              if (mockStorage[k] !== undefined) res[k] = mockStorage[k];
            });
            cb(res);
          }),
          set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
            Object.assign(mockStorage, items);
            cb?.();
          }),
          remove: vi.fn((keys: string[], cb?: () => void) => {
            keys.forEach((k) => delete mockStorage[k]);
            cb?.();
          }),
        },
      },
    };
  });

  describe('1. Profile Storage & Persistence', () => {
    it('1.1. Loads DEFAULT_VERIFIED_PROFILE when storage is initially empty', async () => {
      const profile = await userProfileStorage.load();
      expect(profile).toBeDefined();
      expect(profile.personal.fullName).toBe('Aarav Sharma');
      expect(profile.academic.institutionName).toContain('Apex National Institute');
      expect(profile.banking.accountNumber).toBe('987654321012');
    });

    it('1.2. Saves custom profile modifications and persists to chrome.storage.local', async () => {
      const custom: UserProfile = {
        ...DEFAULT_VERIFIED_PROFILE,
        personal: {
          ...DEFAULT_VERIFIED_PROFILE.personal,
          fullName: 'Priya Patel',
          domicileState: 'Gujarat',
        },
      };

      const saved = await userProfileStorage.save(custom);
      expect(saved).toBe(true);

      const loaded = await userProfileStorage.load();
      expect(loaded.personal.fullName).toBe('Priya Patel');
      expect(loaded.personal.domicileState).toBe('Gujarat');
    });

    it('1.3. Resets profile back to verified default template', async () => {
      await userProfileStorage.save({
        ...EMPTY_PROFILE,
        personal: { ...EMPTY_PROFILE.personal, fullName: 'Temp User' },
      });

      const reset = await userProfileStorage.resetToDefault();
      expect(reset.personal.fullName).toBe('Aarav Sharma');
      expect(reset.isComplete).toBe(true);
    });

    it('1.4. Clears profile to empty state', async () => {
      const cleared = await userProfileStorage.clear();
      expect(cleared.personal.fullName).toBe('');
      expect(cleared.banking.accountNumber).toBe('');
    });
  });

  describe('2. Form Matching Engine against Complex Webpage', () => {
    let demoDoc: Document;
    let demoWindow: Window;

    beforeEach(() => {
      const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
      const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
      demoWindow = new Window({ url: 'http://localhost:3000/index.html' });
      demoDoc = demoWindow.document as unknown as Document;
      demoDoc.write(demoHtml);
    });

    it('2.1. Matches profile attributes to real scholarship portal form fields', () => {
      const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
      const matchResult = matchProfileToRepresentation(representation, DEFAULT_VERIFIED_PROFILE);

      expect(matchResult.totalMatchable).toBeGreaterThanOrEqual(10);
      const mappedKeys = matchResult.matches.map((m) => m.profileKey);

      expect(mappedKeys).toContain('personal.fullName');
      expect(mappedKeys).toContain('personal.dob');
      expect(mappedKeys).toContain('personal.gender');
      expect(mappedKeys).toContain('personal.category');
      expect(mappedKeys).toContain('personal.domicileState');
      expect(mappedKeys).toContain('contact.email');
      expect(mappedKeys).toContain('contact.phone');
      expect(mappedKeys).toContain('contact.pincode');
      expect(mappedKeys).toContain('academic.institutionName');
      expect(mappedKeys).toContain('banking.accountNumber');
      expect(mappedKeys).toContain('banking.ifscCode');
    });

    it('2.2. Associates correct verified values with form field IDs', () => {
      const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
      const matchResult = matchProfileToRepresentation(representation, DEFAULT_VERIFIED_PROFILE);

      const nameMatch = matchResult.matches.find((m) => m.profileKey === 'personal.fullName');
      expect(nameMatch).toBeDefined();
      expect(nameMatch?.formFieldId).toBe('applicant_full_name');
      expect(nameMatch?.profileValue).toBe('Aarav Sharma');

      const ifscMatch = matchResult.matches.find((m) => m.profileKey === 'banking.ifscCode');
      expect(ifscMatch).toBeDefined();
      expect(ifscMatch?.formFieldId).toBe('bank_ifsc_code');
      expect(ifscMatch?.profileValue).toBe('SBIN0001234');
    });

    it('2.3. Zero-Trust Security Gate: Refuses to match password, CVV, or card number inputs', () => {
      const mockFields = [
        { id: 'user_password', name: 'password', label: 'Password', type: 'password' },
        { id: 'card_cvv', name: 'cvv', label: 'Card Security Code', type: 'text' },
        { id: 'card_number', name: 'credit_card', label: 'Card Number', type: 'text' },
        { id: 'applicant_full_name', name: 'full_name', label: 'Full Legal Name', type: 'text' },
      ];

      expect(isFieldBlocked({ type: 'password', id: 'user_password' })).toBe(true);
      expect(isFieldBlocked({ type: 'text', id: 'card_cvv' })).toBe(true);

      const matchResult = matchProfileToPage(mockFields, DEFAULT_VERIFIED_PROFILE);
      expect(matchResult.matches.length).toBe(1);
      expect(matchResult.matches[0].profileKey).toBe('personal.fullName');
    });

    it('2.4. Handles empty profile gracefully without generating false matches', () => {
      const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
      const matchResult = matchProfileToRepresentation(representation, EMPTY_PROFILE);

      expect(matchResult.matches.length).toBe(0);
      expect(matchResult.totalMatchable).toBe(0);
    });
  });

  describe('3. Safe Form Applicator & DOM Event Dispatching', () => {
    let testDoc: Document;
    let testWindow: Window;

    beforeEach(() => {
      testWindow = new Window({ url: 'http://localhost:3000/test.html' });
      testDoc = testWindow.document as unknown as Document;
      testDoc.write(`
        <form id="test-form">
          <input type="text" id="applicant_full_name" name="applicant_full_name" />
          <input type="date" id="applicant_dob" name="applicant_dob" />
          <select id="applicant_gender" name="applicant_gender">
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <input type="checkbox" id="affirmation_check" name="affirmation_check" value="true" />
          <input type="password" id="user_secret" name="user_secret" />
          <input type="text" id="disabled_field" disabled />
        </form>
      `);
    });

    it('3.1. Populates text, select, and checkbox inputs in DOM', () => {
      const nameInput = testDoc.getElementById('applicant_full_name') as HTMLInputElement;
      const genderSelect = testDoc.getElementById('applicant_gender') as HTMLSelectElement;
      const checkInput = testDoc.getElementById('affirmation_check') as HTMLInputElement;

      let nameInputDispatched = false;
      let genderChangeDispatched = false;

      nameInput.addEventListener('input', () => {
        nameInputDispatched = true;
      });
      genderSelect.addEventListener('change', () => {
        genderChangeDispatched = true;
      });

      const mappings = [
        {
          profileKey: 'personal.fullName',
          profileLabel: 'Full Legal Name',
          profileValue: 'Aarav Sharma',
          formFieldId: 'applicant_full_name',
          formFieldLabel: 'Full Name',
          confidence: 1.0,
        },
        {
          profileKey: 'personal.gender',
          profileLabel: 'Gender',
          profileValue: 'male',
          formFieldId: 'applicant_gender',
          formFieldLabel: 'Gender',
          confidence: 1.0,
        },
        {
          profileKey: 'declaration.affirm',
          profileLabel: 'Affirm',
          profileValue: 'true',
          formFieldId: 'affirmation_check',
          formFieldLabel: 'Affirmation',
          confidence: 1.0,
        },
      ];

      const res = applyProfileFields(testDoc, mappings);

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(3);
      expect(nameInput.value).toBe('Aarav Sharma');
      expect(genderSelect.value).toBe('male');
      expect(checkInput.checked).toBe(true);

      // Verifies synthetic event dispatching
      expect(nameInputDispatched).toBe(true);
      expect(genderChangeDispatched).toBe(true);

      // Verifies visual assistive feedback class
      expect(nameInput.classList.contains('accessos-field-populated')).toBe(true);
      expect(genderSelect.classList.contains('accessos-field-populated')).toBe(true);
    });

    it('3.2. Protects password inputs and disabled elements from being modified', () => {
      const pwdInput = testDoc.getElementById('user_secret') as HTMLInputElement;
      const disabledInput = testDoc.getElementById('disabled_field') as HTMLInputElement;

      const mappings = [
        {
          profileKey: 'auth.pwd',
          profileLabel: 'Secret',
          profileValue: 'hacked123',
          formFieldId: 'user_secret',
          formFieldLabel: 'Password',
          confidence: 1.0,
        },
        {
          profileKey: 'contact.note',
          profileLabel: 'Note',
          profileValue: 'Test',
          formFieldId: 'disabled_field',
          formFieldLabel: 'Disabled',
          confidence: 1.0,
        },
      ];

      const res = applyProfileFields(testDoc, mappings);
      expect(pwdInput.value).toBe('');
      expect(disabledInput.value).toBe('');
      expect(res.appliedCount).toBe(0);
    });
  });

  describe('4. Document Intelligence to Profile Vault Fact Sync', () => {
    it('4.1. Merges verified facts from uploaded documents into user profile', () => {
      const initialProfile = { ...EMPTY_PROFILE };

      const facts: ExtractedFact[] = [
        {
          factType: 'APPLICANT_NAME',
          value: 'Rohan Verma',
          confidence: 0.95,
          sourcePage: 1,
          evidence: 'Name: Rohan Verma',
          sensitivity: 'NON_SENSITIVE',
        },
        {
          factType: 'INSTITUTION_NAME',
          value: 'Delhi Technological University',
          confidence: 0.9,
          sourcePage: 1,
          evidence: 'Institute: DTU',
          sensitivity: 'NON_SENSITIVE',
        },
        {
          factType: 'BANK_ACCOUNT_NUMBER',
          value: '112233445566',
          confidence: 0.98,
          sourcePage: 1,
          evidence: 'A/C No: 112233445566',
          sensitivity: 'SENSITIVE',
        },
        {
          factType: 'BANK_IFSC_CODE',
          value: 'PUNB0123456',
          confidence: 0.92,
          sourcePage: 1,
          evidence: 'IFSC: PUNB0123456',
          sensitivity: 'NON_SENSITIVE',
        },
      ];

      const { updatedProfile, updatedFields } = mergeFactsIntoProfile(initialProfile, facts);

      expect(updatedProfile.personal.fullName).toBe('Rohan Verma');
      expect(updatedProfile.academic.institutionName).toBe('Delhi Technological University');
      expect(updatedProfile.banking.accountNumber).toBe('112233445566');
      expect(updatedProfile.banking.ifscCode).toBe('PUNB0123456');
      expect(updatedFields.length).toBe(4);
    });

    it('4.2. Ignores low-confidence facts (< 0.60) to protect profile integrity', () => {
      const initialProfile = { ...DEFAULT_VERIFIED_PROFILE };

      const lowConfFacts: ExtractedFact[] = [
        {
          factType: 'APPLICANT_NAME',
          value: 'Unknown Person',
          confidence: 0.45,
          sourcePage: 1,
          evidence: 'Garbled OCR',
          sensitivity: 'NON_SENSITIVE',
        },
      ];

      const { updatedProfile, updatedFields } = mergeFactsIntoProfile(initialProfile, lowConfFacts);
      expect(updatedProfile.personal.fullName).toBe('Aarav Sharma');
      expect(updatedFields.length).toBe(0);
    });
  });

  describe('5. Demo Session Reset Integration', () => {
    it('5.1. DemoResetManager includes accessos_user_profile in DEMO_KEYS', () => {
      expect(DemoResetManager.DEMO_KEYS).toContain('accessos_user_profile');
    });

    it('5.2. Resetting session cleans up user profile key', async () => {
      mockStorage['accessos_user_profile'] = { ...DEFAULT_VERIFIED_PROFILE };
      expect(mockStorage['accessos_user_profile']).toBeDefined();

      const res = await demoResetManager.resetDemo({ resetProfile: true });
      expect(res.success).toBe(true);
      expect(mockStorage['accessos_user_profile']).toBeUndefined();
    });
  });
});
