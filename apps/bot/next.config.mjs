/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {},
  serverExternalPackages: ['pg', 'pino', 'discord.js', '@discordjs/ws', '@discordjs/voice', 'zlib-sync', 'bufferutil', 'utf-8-validate', 'erlpack', '@chat-adapter/discord', '@chat-adapter/state-redis', 'redis'],
  webpack: (cfg) => {
    cfg.resolve.extensionAlias = {
      ...(cfg.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return cfg;
  },
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  async rewrites() {
    if (process.env.LEGACY_ROUTES !== 'true') return [];
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/enter-channel', destination: '/api/voice/enter-channel' },
      { source: '/leave-channel', destination: '/api/voice/leave-channel' },
      { source: '/user/voice-channel', destination: '/api/voice/user' },
      { source: '/music/play', destination: '/api/music/play' },
      { source: '/music/stop', destination: '/api/music/stop' },
      { source: '/music/skip', destination: '/api/music/skip' },
      { source: '/music/pause', destination: '/api/music/pause' },
      { source: '/music/resume', destination: '/api/music/resume' },
      { source: '/music/volume', destination: '/api/music/volume' },
      { source: '/music/queue', destination: '/api/music/queue' },
      { source: '/music/leave', destination: '/api/music/leave' },
      { source: '/music/spotify/play', destination: '/api/music/spotify/play' },
      { source: '/tts/speak', destination: '/api/tts/speak' },
      { source: '/tts/piper/speak', destination: '/api/tts/piper' },
      { source: '/chatbot/message', destination: '/api/chat' },
    ];
  },
};

export default config;
