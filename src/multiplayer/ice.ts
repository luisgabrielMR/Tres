// The endpoint may expose a scoped TURN credential key, never an account/admin key.
export async function rtcConfig(url = import.meta.env.VITE_ICE_SERVERS_URL): Promise<RTCConfiguration> {
  if (!url) return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const parsed = new URL(url, globalThis.location?.href);
  const local = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) throw new Error('ICE_CONFIG');
  const response = await fetch(parsed, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('ICE_CONFIG');
  const raw = await response.text();
  if (raw.length > 16_384) throw new Error('ICE_CONFIG');
  const servers: unknown = JSON.parse(raw);
  if (!Array.isArray(servers) || servers.length < 1 || servers.length > 8) throw new Error('ICE_CONFIG');
  for (const server of servers) {
    if (!server || typeof server !== 'object') throw new Error('ICE_CONFIG');
    const urls: unknown[] = Array.isArray(server.urls) ? server.urls : [server.urls];
    if (!urls.length || urls.length > 8 || !urls.every(url => typeof url === 'string' && /^(stun|stuns|turn|turns):[^\s]+$/.test(url))) throw new Error('ICE_CONFIG');
    if (urls.some(url => /^turns?:/.test(url as string)) && (typeof server.username !== 'string' || !server.username || typeof server.credential !== 'string' || !server.credential)) throw new Error('ICE_CONFIG');
    if (server.username !== undefined && typeof server.username !== 'string' || server.credential !== undefined && typeof server.credential !== 'string') throw new Error('ICE_CONFIG');
  }
  return { iceServers: servers };
}
