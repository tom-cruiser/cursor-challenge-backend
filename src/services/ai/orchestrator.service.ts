import { env } from '../../config/env';
import { ChatMessage } from '../../models/types';
import { AppError } from '../../utils/errors';

const OPENROUTER_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterDeltaChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
}

export interface StreamCompletionInput {
  userPrompt: string;
  groundingJson: string;
  history: ChatMessage[];
  onToken: (token: string) => void;
}

function buildSystemPrompt(groundingJson: string): string {
  return [
    'You are an expert pediatric informational assistant deployed for the Rwanda Vaccination Reminder Web App ecosystem.',
    'Your role is to help parents understand standard immunization timelines and benign post-vaccination symptom management.',
    '',
    'Clinical safety constraints:',
    '- Never provide standalone medical diagnoses or prescribe treatments.',
    '- Restrict advice to standard vaccination schedules and mild symptom management (e.g. low-grade fevers, hydration, rest).',
    '- If a parent describes severe or emergency symptoms, tell them to seek immediate in-person medical care.',
    '',
    'Grounding instructions:',
    '- Evaluate the JSON grounding payload below before answering.',
    '- When the user asks about their children, schedules, or preferred clinics, reference only data present in the payload.',
    '- If the payload lacks relevant data, explain what the parent should configure in the app (add a child, select a preferred hospital).',
    '',
    `Grounding payload: ${groundingJson}`,
  ].join('\n');
}

function mapHistoryToOpenRouterMessages(
  history: ChatMessage[],
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return history
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function parseSseDataLines(buffer: string): { events: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const remainder = parts.pop() ?? '';
  return { events: parts, remainder };
}

function extractTokenFromEvent(eventBlock: string): string | null {
  const lines = eventBlock.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data:')) {
      continue;
    }

    const payload = line.slice(5).trim();
    if (payload.length === 0 || payload === '[DONE]') {
      return null;
    }

    try {
      const parsed = JSON.parse(payload) as OpenRouterDeltaChunk;
      const token = parsed.choices?.[0]?.delta?.content;
      if (typeof token === 'string' && token.length > 0) {
        return token;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function streamOpenRouterCompletion(input: StreamCompletionInput): Promise<string> {
  if (!env.openRouterConfigured || !env.OPENROUTER_API_KEY) {
    throw new AppError(503, 'AI service is not configured');
  }

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(input.groundingJson) },
    ...mapHistoryToOpenRouterMessages(input.history),
    { role: 'user' as const, content: input.userPrompt },
  ];

  const response = await fetch(OPENROUTER_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.OPENROUTER_SITE_URL,
      'X-Title': env.OPENROUTER_APP_TITLE,
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages,
      stream: true,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    let details: unknown = undefined;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }
    throw new AppError(response.status, 'OpenRouter completion request failed', details);
  }

  if (!response.body) {
    throw new AppError(502, 'OpenRouter returned an empty response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseDataLines(buffer);
    buffer = remainder;

    for (const eventBlock of events) {
      const token = extractTokenFromEvent(eventBlock);
      if (token) {
        fullText += token;
        input.onToken(token);
      }
    }
  }

  if (buffer.trim().length > 0) {
    const token = extractTokenFromEvent(buffer);
    if (token) {
      fullText += token;
      input.onToken(token);
    }
  }

  const trimmed = fullText.trim();
  if (trimmed.length === 0) {
    throw new AppError(502, 'OpenRouter returned an empty completion');
  }

  return trimmed;
}
