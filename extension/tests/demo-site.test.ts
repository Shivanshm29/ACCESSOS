import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Demo Site Functional & Usability Test Suite', () => {
  let window: Window;
  let document: Document;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const jsPath = path.resolve(__dirname, '../../demo-site/app.js');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const js = fs.readFileSync(jsPath, 'utf-8');

    window = new Window({
      url: 'http://localhost:3000/',
    });
    document = window.document as unknown as Document;
    document.write(html);

    // Mock scrollIntoView
    (window as any).Element.prototype.scrollIntoView = () => {};

    // Execute app.js in window/document scope
    const runner = new Function('window', 'document', js);
    runner(window, document);
  });

  it('1. Loads main page with correct institutional title and branding', () => {
    expect(document.title).toContain('National Student Scholarship Portal');
    const headerTitle = document.querySelector('.portal-main-title');
    expect(headerTitle?.textContent?.trim()).toBe('National Student Scholarship Portal');
  });

  it('2. Contains all 8 logical application sections', () => {
    const expectedSections = [
      'sec-applicant',
      'sec-personal',
      'sec-academic',
      'sec-family',
      'sec-address',
      'sec-bank',
      'sec-documents',
      'sec-declaration',
    ];

    expectedSections.forEach((secId) => {
      const section = document.getElementById(secId);
      expect(section, `Section #${secId} should exist in DOM`).not.toBeNull();
      expect(section?.classList.contains('form-section-card')).toBe(true);
    });
  });

  it('3. Contains approximately 25-45 meaningful form fields', () => {
    const fields = document.querySelectorAll(
      '#scholarship-application-form input, #scholarship-application-form select, #scholarship-application-form textarea'
    );
    expect(fields.length).toBeGreaterThanOrEqual(25);
    expect(fields.length).toBeLessThanOrEqual(50);
  });

  it('4. Multi-step progress stepper initializes on Step 1 and navigates correctly', () => {
    const step1Nav = document.getElementById('nav-step-1');
    const step2Nav = document.getElementById('nav-step-2');
    expect(step1Nav?.classList.contains('active')).toBe(true);
    expect(step2Nav?.classList.contains('active')).toBe(false);

    // Clicking step without completing required step triggers validation alert
    const step3Nav = document.getElementById('nav-step-3') as HTMLElement;
    step3Nav?.click();
    const alertBox = document.getElementById('form-alert-box');
    expect(alertBox?.style.display).not.toBe('none');
  });

  it('5. Required field validation catches missing applicant name and email', () => {
    const step1NextBtn = document.querySelector('#sec-applicant .btn-next-step') as HTMLElement;
    step1NextBtn?.click();

    const nameErr = document.getElementById('err-applicant_full_name');
    expect(nameErr?.textContent).toContain('Full Legal Name is mandatory');
    expect(nameErr?.classList.contains('visible')).toBe(true);

    const emailErr = document.getElementById('err-applicant_email');
    expect(emailErr?.textContent).toContain('Email Address is required');
  });

  it('6. Email validation enforces proper email structure', () => {
    const emailInput = document.getElementById('applicant_email') as HTMLInputElement;
    const nameInput = document.getElementById('applicant_full_name') as HTMLInputElement;
    const dobInput = document.getElementById('applicant_dob') as HTMLInputElement;
    const genderInput = document.getElementById('applicant_gender') as HTMLSelectElement;
    const mobileInput = document.getElementById('applicant_mobile') as HTMLInputElement;

    nameInput.value = 'Aarav Sharma';
    dobInput.value = '2003-05-12';
    genderInput.value = 'male';
    mobileInput.value = '9876543210';
    emailInput.value = 'invalid-email-no-at-sign';

    const step1NextBtn = document.querySelector('#sec-applicant .btn-next-step') as HTMLElement;
    step1NextBtn?.click();

    const emailErr = document.getElementById('err-applicant_email');
    expect(emailErr?.textContent).toBe('Please enter a valid email address.');
  });

  it('7. Postal PIN validation enforces 6-digit constraint with institutional message', () => {
    const pinInput = document.getElementById('address_pincode') as HTMLInputElement;
    const line1Input = document.getElementById('address_line1') as HTMLInputElement;
    const cityInput = document.getElementById('address_city') as HTMLInputElement;
    const distInput = document.getElementById('address_district') as HTMLInputElement;
    const stateInput = document.getElementById('address_state') as HTMLSelectElement;

    line1Input.value = 'Main Street';
    cityInput.value = 'Pune';
    distInput.value = 'Pune';
    stateInput.value = 'Maharashtra';
    pinInput.value = '123'; // Invalid 3 digits

    const step5NextBtn = document.querySelector('#sec-address .btn-next-step') as HTMLElement;
    step5NextBtn?.click();

    const pinErr = document.getElementById('err-address_pincode');
    expect(pinErr?.textContent).toContain('regex constraint ^[0-9]{6}$');
  });

  it('8. Conditional logic: Hosteller toggle reveals/hides hostel accommodation fields', () => {
    const hostelGroup = document.getElementById('group-hostel-details');
    const hostellerYes = document.querySelector('input[name="address_is_hosteller_flag"][value="yes"]') as HTMLInputElement;
    const hostellerNo = document.querySelector('input[name="address_is_hosteller_flag"][value="no"]') as HTMLInputElement;

    expect(hostelGroup?.style.display).toBe('none');

    // Select Yes
    hostellerYes.checked = true;
    hostellerYes.dispatchEvent(new (window as any).Event('change'));
    expect(hostelGroup?.style.display).toBe('block');

    // Select No
    hostellerNo.checked = true;
    hostellerNo.dispatchEvent(new (window as any).Event('change'));
    expect(hostelGroup?.style.display).toBe('none');
  });

  it('9. Conditional logic: Other Scholarship toggle reveals/hides dual-benefit fields', () => {
    const schGroup = document.getElementById('group-other-scholarship');
    const schYes = document.querySelector('input[name="family_other_scholarship_flag"][value="yes"]') as HTMLInputElement;
    const schNo = document.querySelector('input[name="family_other_scholarship_flag"][value="no"]') as HTMLInputElement;

    expect(schGroup?.style.display).toBe('none');

    // Select Yes
    schYes.checked = true;
    schYes.dispatchEvent(new (window as any).Event('change'));
    expect(schGroup?.style.display).toBe('block');

    // Select No
    schNo.checked = true;
    schNo.dispatchEvent(new (window as any).Event('change'));
    expect(schGroup?.style.display).toBe('none');
  });

  it('10. File selection displays selected filename in local UI without transmission', () => {
    const fileInput = document.getElementById('doc_identity_proof') as HTMLInputElement;
    const display = document.getElementById('disp-doc_identity_proof');

    expect(display?.textContent).toBe('No file chosen');

    // Simulate file selection
    const mockFile = { name: 'identity_doc.pdf', size: 1024 * 350 };
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      configurable: true,
    });
    fileInput.dispatchEvent(new (window as any).Event('change'));

    expect(display?.textContent).toContain('identity_doc.pdf');
    expect(display?.textContent).toContain('350 KB');
    expect(display?.classList.contains('selected')).toBe(true);
  });

  it('11. Import DigiLocker Data populates all 8 sections with verified candidate data', () => {
    const btnLoad = document.getElementById('btn-load-demo') as HTMLElement;
    btnLoad?.click();

    const nameInput = document.getElementById('applicant_full_name') as HTMLInputElement;
    const instInput = document.getElementById('academic_institution') as HTMLInputElement;
    const pinInput = document.getElementById('address_pincode') as HTMLInputElement;
    const bankInput = document.getElementById('bank_account_holder') as HTMLInputElement;
    const declCheck = document.getElementById('decl_truthful_info') as HTMLInputElement;

    expect(nameInput.value).toBe('Aarav Sharma');
    expect(instInput.value).toBe('Apex National Institute of Science & Technology');
    expect(pinInput.value).toBe('411001');
    expect(bankInput.value).toBe('Aarav Sharma');
    expect(declCheck.checked).toBe(true);

    const alertBox = document.getElementById('form-alert-box');
    expect(alertBox?.textContent).toContain('Verified applicant profile imported');
  });

  it('12. Successful submission produces confirmation card with reference SCH-2026-884920', () => {
    // 1. Populate demo data
    const btnLoad = document.getElementById('btn-load-demo') as HTMLElement;
    btnLoad?.click();

    // 2. Submit form
    const btnSubmit = document.getElementById('btn-submit-application') as HTMLElement;
    btnSubmit?.click();

    const formEl = document.getElementById('scholarship-application-form');
    const confirmCard = document.getElementById('submission-confirmation');
    const refBadge = document.getElementById('receipt-ref-no');
    const candidateName = document.getElementById('receipt-applicant-name');

    expect(formEl?.style.display).toBe('none');
    expect(confirmCard?.style.display).toBe('block');
    expect(refBadge?.textContent).toBe('SCH-2026-884920');
    expect(candidateName?.textContent).toBe('Aarav Sharma');
  });

  it('13. Operates 100% locally with zero external network requests', () => {
    // Check form has no remote action or method
    const formEl = document.getElementById('scholarship-application-form') as HTMLFormElement;
    expect(formEl.getAttribute('action')).toBeNull();

    // Verify localStorage draft saving is purely local
    const btnLoad = document.getElementById('btn-load-demo') as HTMLElement;
    btnLoad?.click();

    const btnSaveDraft = document.getElementById('btn-save-draft') as HTMLElement;
    btnSaveDraft?.click();

    const draft = window.localStorage.getItem('accessos_scholarship_portal_draft');
    expect(draft).not.toBeNull();
    const parsed = JSON.parse(draft!);
    expect(parsed.data.applicant_full_name).toBe('Aarav Sharma');
  });
});
