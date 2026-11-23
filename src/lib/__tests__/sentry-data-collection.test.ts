import { describe, expect, it } from 'vitest';
import { restrictedSentryDataCollection } from '../sentry-data-collection';

describe('Sentry data collection boundary', () => {
  it('does not attach customer or conversation content after the SDK upgrade', () => {
    expect(restrictedSentryDataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
      stackFrameVariables: false,
    });
  });
});
