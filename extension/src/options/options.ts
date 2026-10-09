/**
 * ACCESSOS Options Controller Foundation
 */

document.addEventListener('DOMContentLoaded', () => {
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const saveStatus = document.getElementById('save-status');

  if (themeSelect && saveStatus) {
    chrome.storage?.sync?.get(['theme'], (result) => {
      if (result.theme) {
        themeSelect.value = result.theme;
      }
    });

    themeSelect.addEventListener('change', () => {
      chrome.storage?.sync?.set({ theme: themeSelect.value }, () => {
        saveStatus.textContent = 'Settings saved';
      });
    });
  }
});
