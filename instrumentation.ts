export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Reports errors thrown inside server components, route handlers and the
// data-fetching layer — those never reach the client error boundary, so
// without this hook they were invisible.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
