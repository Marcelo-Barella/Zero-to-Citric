import SpotifyWebApi from 'spotify-web-api-node';
import type { Track } from '@zero-to-citric/shared-types';
import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';
import { resolveYoutubeTrack } from './youtube.js';

let client: SpotifyWebApi | null = null;
let tokenExpiresAt = 0;

function getClient(): SpotifyWebApi | null {
  const env = loadEnv();
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;
  if (!client) client = new SpotifyWebApi({ clientId: env.SPOTIFY_CLIENT_ID, clientSecret: env.SPOTIFY_CLIENT_SECRET });
  return client;
}

async function ensureToken(c: SpotifyWebApi): Promise<void> {
  if (Date.now() < tokenExpiresAt && c.getAccessToken()) return;
  const t = await c.clientCredentialsGrant();
  c.setAccessToken(t.body.access_token);
  tokenExpiresAt = Date.now() + (t.body.expires_in - 30) * 1000;
}

export function parseSpotifyId(uri: string): string | null {
  if (uri.startsWith('spotify:track:')) return uri.split(':').pop() ?? null;
  const m = uri.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  if (m) return m[1] ?? null;
  if (/^[A-Za-z0-9]+$/.test(uri)) return uri;
  return null;
}

export async function resolveSpotifyQuery(uri: string): Promise<Result<string>> {
  const c = getClient();
  if (!c) return err('spotify_not_configured');
  const id = parseSpotifyId(uri);
  if (!id) return err('spotify_invalid_uri');
  await ensureToken(c);
  const t = await c.getTrack(id);
  const name = t.body.name;
  const artist = t.body.artists[0]?.name ?? '';
  return ok(`${name} ${artist}`.trim());
}

export async function resolveSpotifyTrack(uri: string): Promise<Result<Track>> {
  const r = await resolveSpotifyQuery(uri);
  if (!r.ok) return r;
  const yt = await resolveYoutubeTrack(r.data);
  if (!yt.ok) return yt;
  return ok({ ...yt.data, source: 'spotify' as const });
}
