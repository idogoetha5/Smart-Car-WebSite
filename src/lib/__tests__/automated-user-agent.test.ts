import { describe, expect, it } from 'vitest';
import { isAutomatedUserAgent } from '../automated-user-agent';

describe('isAutomatedUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/152.0.0.0 Safari/537.36',
  ])('recognises automated visitors: %s', (userAgent) => {
    expect(isAutomatedUserAgent(userAgent)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 CriOS/152.0.7977.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
  ])('keeps performance monitoring enabled for customers: %s', (userAgent) => {
    expect(isAutomatedUserAgent(userAgent)).toBe(false);
  });
});
