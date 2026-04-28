import type { VoiceConnection } from '@discordjs/voice';

const map = new Map<string, VoiceConnection>();

export const connections = {
  set(guildId: string, conn: VoiceConnection): void {
    map.set(guildId, conn);
  },
  get(guildId: string): VoiceConnection | undefined {
    return map.get(guildId);
  },
  delete(guildId: string): void {
    map.delete(guildId);
  },
  count(): number {
    return map.size;
  },
  list(): string[] {
    return Array.from(map.keys());
  },
};
