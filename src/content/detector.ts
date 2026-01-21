import { AgreementDetection } from '../shared/types';
import { AGREEMENT_PATTERNS } from '../shared/constants';

/**
 * Detects if the current page contains an agreement/ToS
 */
export function detectAgreement(): AgreementDetection {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const bodyText = document.body?.innerText || '';

  let confidence = 0;
  let type: AgreementDetection['type'] = 'unknown';

  // Check URL patterns
  for (const pattern of AGREEMENT_PATTERNS.urlPatterns) {
    if (pattern.test(url)) {
      confidence += 0.3;
      if (/privacy/i.test(url)) type = 'privacy';
      else if (/terms|tos|conditions/i.test(url)) type = 'tos';
      else if (/cookie/i.test(url)) type = 'cookie';
      break;
    }
  }

  // Check title patterns
  for (const pattern of AGREEMENT_PATTERNS.titlePatterns) {
    if (pattern.test(title)) {
      confidence += 0.3;
      if (/privacy/i.test(title)) type = 'privacy';
      else if (/terms|conditions/i.test(title)) type = 'tos';
      else if (/cookie/i.test(title)) type = 'cookie';
      break;
    }
  }

  // Check for sign-up agreement patterns in content
  const contentSample = bodyText.substring(0, 5000).toLowerCase();
  for (const pattern of AGREEMENT_PATTERNS.contentPatterns) {
    if (pattern.test(contentSample)) {
      confidence += 0.2;
      if (type === 'unknown') type = 'signup';
      break;
    }
  }

  // Check for agreement checkboxes
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const checkbox of checkboxes) {
    const label = getCheckboxLabel(checkbox as HTMLInputElement);
    if (label && /agree|accept|terms|privacy|policy/i.test(label)) {
      confidence += 0.3;
      if (type === 'unknown') type = 'signup';
      break;
    }
  }

  // Check for common agreement links
  const links = document.querySelectorAll('a');
  let agreementLinksFound = 0;
  for (const link of links) {
    const text = link.textContent?.toLowerCase() || '';
    const href = link.href?.toLowerCase() || '';
    if (/terms|privacy|policy|agreement/i.test(text) ||
        /terms|privacy|policy|agreement/i.test(href)) {
      agreementLinksFound++;
    }
  }
  if (agreementLinksFound >= 2) {
    confidence += 0.1;
  }

  // Cap confidence at 1
  confidence = Math.min(confidence, 1);

  return {
    isAgreement: confidence >= 0.3,
    confidence,
    type,
    title: document.title,
    url: window.location.href,
  };
}

/**
 * Gets the label text for a checkbox
 */
function getCheckboxLabel(checkbox: HTMLInputElement): string | null {
  // Check for associated label
  if (checkbox.id) {
    const label = document.querySelector(`label[for="${checkbox.id}"]`);
    if (label) return label.textContent;
  }

  // Check for parent label
  const parentLabel = checkbox.closest('label');
  if (parentLabel) return parentLabel.textContent;

  // Check sibling text
  const parent = checkbox.parentElement;
  if (parent) return parent.textContent;

  return null;
}

/**
 * Extracts the main agreement text from the page
 */
export function extractAgreementText(): string {
  // Try to find the main content area
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '.terms',
    '.privacy',
    '.policy',
    '.agreement',
    '.content',
    '#content',
    '#main',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.length > 500) {
      return cleanText(element.textContent);
    }
  }

  // Fallback to body text
  return cleanText(document.body?.innerText || '');
}

/**
 * Cleans extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
    .trim()
    .substring(0, 50000);  // Limit text length
}

/**
 * Finds elements containing specific text for highlighting
 */
export function findTextElements(searchText: string): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const searchLower = searchText.toLowerCase();
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.toLowerCase().includes(searchLower)) {
      const parent = node.parentElement;
      if (parent && !elements.includes(parent)) {
        elements.push(parent);
      }
    }
  }

  return elements;
}
