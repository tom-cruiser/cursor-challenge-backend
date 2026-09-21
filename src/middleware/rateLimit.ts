import rateLimit from 'express-rate-limit';

/** Applied to every request. Generous, just a backstop against abuse/scraping. */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Tighter limit for the AI assistant — every request here costs real
 * OpenRouter tokens, so this also functions as a basic cost control.
 */
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many assistant requests. Please wait a moment and try again.' },
});

/**
 * Tighter limit for endpoints that trigger real outbound SMS/email/push
 * sends or resolve/create a user record from a bearer token, so they can't
 * be hammered to run up notification costs or enumerate/spam-create users.
 */
export const sensitiveActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

/** Brute-force protection for login and registration. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
