export interface M3uChannel {
  id: string;
  name: string;
  group: string;
  logo?: string;
  url: string;
}

const attribute = (line: string, key: string): string | undefined => {
  const match = line.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return match?.[1]?.trim() || undefined;
};

export function parseM3u(text: string, sourceId = 'source'): M3uChannel[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const channels: M3uChannel[] = [];
  let pending: { name: string; group: string; logo?: string } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const commaIndex = line.lastIndexOf(',');
      const name = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : '';
      pending = {
        name: name || attribute(line, 'tvg-name') || 'Channel',
        group: attribute(line, 'group-title') || 'Other',
        logo: attribute(line, 'tvg-logo'),
      };
      continue;
    }
    if (line.startsWith('#')) continue;
    if (/^(https?|rtmp|rtsp):\/\//i.test(line)) {
      const info = pending ?? { name: line.split('/').pop() || 'Channel', group: 'Other' };
      channels.push({ id: `${sourceId}-${channels.length}`, url: line, ...info });
      pending = null;
    }
  }
  return channels;
}
