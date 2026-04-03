import { describe, expect, test } from 'bun:test';

import { getTerminalWindowChrome } from './terminal';

describe('getTerminalWindowChrome', () => {
  test('uses macOS chrome when userAgentData reports macOS', () => {
    const chrome = getTerminalWindowChrome({
      userAgentData: {
        platform: 'macOS'
      }
    });

    expect(chrome.buttonPosition).toBe('left');
    expect(chrome.titleBarBackgroundColor).toBe('#ececec');
    expect(chrome.buttons.map((button) => button.backgroundColor)).toEqual(['#ff5f57', '#febc2e', '#28c840']);
  });

  test('falls back to navigator.platform for macOS detection', () => {
    const chrome = getTerminalWindowChrome({
      platform: 'MacIntel'
    });

    expect(chrome.buttonPosition).toBe('left');
  });

  test('keeps non-macOS chrome on the right', () => {
    const chrome = getTerminalWindowChrome({
      platform: 'Win32',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });

    expect(chrome.buttonPosition).toBe('right');
    expect(chrome.titleBarBackgroundColor).toBe('#333');
    expect(chrome.buttons.map((button) => button.label)).toEqual(['_', '□', '×']);
  });

  test('falls back to the user agent string for macOS detection', () => {
    const chrome = getTerminalWindowChrome({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'
    });

    expect(chrome.buttonPosition).toBe('left');
  });
});
