import type { Client } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { connections } from './connection-registry.js';
import { logger } from '../logger.js';
import type { Result } from '../result.js';

export async function joinVoice(client: Client, guildId: string, channelId: string): Promise<Result<{ joined: true }>> {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { ok: false, error: 'guild_not_found' };
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) return { ok: false, error: 'channel_not_voice' };
  const conn = joinVoiceChannel({
    guildId,
    channelId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
  });
  try {
    await entersState(conn, VoiceConnectionStatus.Ready, 5_000);
  } catch (err) {
    logger().warn({ err, guildId }, 'voice join failed to reach Ready');
    conn.destroy();
    return { ok: false, error: 'voice_join_timeout' };
  }
  connections.set(guildId, conn);
  return { ok: true, data: { joined: true } };
}
