export const SAFETY_DISCLAIMER_RESPONSE =
  'Safety Disclaimer: I can only guide you through standard vaccination schedules and mild post-vaccination symptoms. If your child is severely unwell or experiencing a medical emergency, please immediately take them to your nearest verified hospital or contact emergency services.';

const EMERGENCY_PATTERNS: RegExp[] = [
  /\bsevere sickness\b/i,
  /\bunresponsive\b/i,
  /\bhigh fever\b/i,
  /\bvomiting\b/i,
  /\bseizure\b/i,
  /\bbleeding\b/i,
];

export function isEmergencyPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (normalized.length === 0) {
    return false;
  }

  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(normalized));
}
