import { supabase } from '../../config/database';
import { ChatMessage, ChatMessageRole, ChatSession } from '../../models/types';
import { AppError } from '../../utils/errors';

export async function createChatSession(userId: string): Promise<ChatSession> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to create chat session', error);
  }

  return data as ChatSession;
}

export async function getChatSessionForUser(
  sessionId: string,
  userId: string,
): Promise<ChatSession> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'Failed to load chat session', error);
  }

  if (!data) {
    throw new AppError(404, 'Chat session not found');
  }

  return data as ChatSession;
}

export async function listChatMessages(
  sessionId: string,
  userId: string,
): Promise<ChatMessage[]> {
  await getChatSessionForUser(sessionId, userId);

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError(500, 'Failed to load chat messages', error);
  }

  return (data ?? []) as ChatMessage[];
}

export interface InsertChatMessageInput {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  isFlagged?: boolean;
}

export async function insertChatMessage(input: InsertChatMessageInput): Promise<ChatMessage> {
  const trimmed = input.content.trim();
  if (trimmed.length === 0) {
    throw new AppError(400, 'Message content cannot be empty');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: trimmed,
      is_flagged: input.isFlagged ?? false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'Failed to save chat message', error);
  }

  return data as ChatMessage;
}
