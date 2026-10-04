import { afterEach, expect, it, vi } from 'vitest';
import { rtcConfig } from '../src/multiplayer/ice';

afterEach(() => vi.unstubAllGlobals());
const endpoint = 'https://example.org/ice';
const servers = [{ urls: ['turns:relay.example.org:443?transport=tcp'], username: 'temporary', credential: 'temporary-password' }];
it('sem endpoint mantém STUN e não inventa credenciais TURN', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(await rtcConfig('')).toEqual({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  expect(fetcher).not.toHaveBeenCalled();
});
it('passa servidores TURN válidos ao WebRTC sem enviar cookies', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(servers))); vi.stubGlobal('fetch', fetcher);
  expect(await rtcConfig(endpoint)).toEqual({ iceServers: servers });
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
});
it.each(['http://example.org/ice', 'ftp://localhost/ice', 'https://user:password@example.org/ice'])('recusa endpoint inseguro %s antes de enviar requisição', async url => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(rtcConfig(url)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
});
it.each([[], [{ urls: [] }], [{ urls: 'https://example.org' }], [{ urls: 'turn:relay.example.org' }], [{ urls: 'turn:relay.example.org', username: 1, credential: 'x' }]].map(data => ({ data })))('recusa configuração ICE malformada %#', async ({ data }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
  await expect(rtcConfig(endpoint)).rejects.toThrow('ICE_CONFIG');
});
it('não oculta uma indisponibilidade do serviço de TURN com fallback silencioso', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
  await expect(rtcConfig(endpoint)).rejects.toThrow('ICE_CONFIG');
});
