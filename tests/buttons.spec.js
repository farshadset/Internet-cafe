import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('Header Buttons - Profile and Support E2E Tests', () => {
  test.describe('HTML Structure Tests', () => {
    test('Support button exists in HTML', async () => {
      const html = readFileSync('public/index.html', 'utf-8');
      expect(html).toContain('id="supportBtn"');
      expect(html).toContain('title="پشتیبانی"');
      expect(html).toContain('fa-headset');
    });

    test('Profile button exists in HTML', async () => {
      const html = readFileSync('public/index.html', 'utf-8');
      expect(html).toContain('id="profileBtn"');
      expect(html).toContain('title="پروفایل"');
      expect(html).toContain('fa-user');
    });

    test('Support modal structure exists', async () => {
      const html = readFileSync('public/index.html', 'utf-8');
      expect(html).toContain('id="supportModal"');
      expect(html).toContain('id="faqTab"');
      expect(html).toContain('id="chatTab"');
      expect(html).toContain('id="faqPanel"');
      expect(html).toContain('id="chatPanel"');
      expect(html).toContain('id="closeModal"');
    });
  });

  test.describe('JavaScript Handler Tests', () => {
    test('Support button click handler exists in app.js', async () => {
      const js = readFileSync('public/app.js', 'utf-8');
      expect(js).toContain("document.getElementById('supportBtn')");
      expect(js).toContain("supportModal.classList.add('active')");
    });

    test('Profile button click handler exists in app.js', async () => {
      const js = readFileSync('public/app.js', 'utf-8');
      expect(js).toContain("document.getElementById('profileBtn')");
      expect(js).toContain("login.html");
    });

    test('Support tab switching handler exists', async () => {
      const js = readFileSync('public/app.js', 'utf-8');
      expect(js).toContain("faqTab.addEventListener('click'");
      expect(js).toContain("chatTab.addEventListener('click'");
      expect(js).toContain("switchTab('faq')");
      expect(js).toContain("switchTab('chat')");
    });

    test('Modal close handlers exist', async () => {
      const js = readFileSync('public/app.js', 'utf-8');
      expect(js).toContain("closeBtn.addEventListener('click'");
      expect(js).toContain("supportModal.classList.remove('active')");
    });
  });

  test.describe('CSS Tests', () => {
    test('Support icon has correct styling', async () => {
      const css = readFileSync('public/style.css', 'utf-8');
      expect(css).toContain('.support-icon');
      expect(css).toContain('.modal.active');
    });

    test('Profile icon has correct styling', async () => {
      const css = readFileSync('public/style.css', 'utf-8');
      expect(css).toContain('.profile-icon');
    });
  });
});