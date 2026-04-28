import { z } from 'zod';

export const guildIdSchema = z.string().min(1).describe('Discord guild (server) id');
export const channelIdSchema = z.string().min(1).describe('Discord channel id');
export const userIdSchema = z.string().min(1).describe('Discord user id');

export type ToolError = { ok: false; error: string };
export type ToolOk<T> = { ok: true; data: T };
export type ToolResult<T> = ToolOk<T> | ToolError;

export function toolOk<T>(data: T): ToolOk<T> {
  return { ok: true, data };
}

export function toolErr(error: string): ToolError {
  return { ok: false, error };
}
