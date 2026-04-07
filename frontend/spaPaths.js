/**
 * Each path gets dist/<path>/index.html (copy of root index) after build.
 * Keep in sync with real routes in src/App.jsx (exclude "/" and the "*" fallback).
 */
export const SPA_FALLBACK_PATHS = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/dashboard',
]
