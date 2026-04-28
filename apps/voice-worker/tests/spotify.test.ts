import { describe, expect, it } from 'vitest';
import { parseSpotifyId } from '../src/music/spotify.js';

describe('parseSpotifyId', () => {
  it('parses spotify URI', () => {
    expect(parseSpotifyId('spotify:track:7uIbLdzzSEqnX0Pkrb56cR')).toBe('7uIbLdzzSEqnX0Pkrb56cR');
  });

  it('parses open.spotify.com URL', () => {
    expect(parseSpotifyId('https://open.spotify.com/track/7uIbLdzzSEqnX0Pkrb56cR?si=abc')).toBe(
      '7uIbLdzzSEqnX0Pkrb56cR',
    );
  });

  it('parses bare id', () => {
    expect(parseSpotifyId('7uIbLdzzSEqnX0Pkrb56cR')).toBe('7uIbLdzzSEqnX0Pkrb56cR');
  });

  it('rejects invalid', () => {
    expect(parseSpotifyId('https://example.com/foo')).toBe(null);
    expect(parseSpotifyId('')).toBe(null);
  });
});
