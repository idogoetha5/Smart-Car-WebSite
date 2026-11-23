import type { DataCollection } from '@sentry/core';

// Sentry v11 collects more request and AI data by default than v10 did with
// sendDefaultPii: false. Keep the SmartCar privacy boundary explicit.
export const restrictedSentryDataCollection = {
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
} satisfies DataCollection;
