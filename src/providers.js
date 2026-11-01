const idPattern = /^[a-zA-Z0-9_-]+$/;

export function resolveMedia(source, { type, embed, base = globalThis.location?.href || 'https://localhost/' } = {}) {
  const url = new URL(embed || source, base);
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname;
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported media protocol');
  if (!embed && (type === 'video' || /\.(mp4|webm)$/i.test(path))) return { type: 'video', src: url.href };
  let src;
  let match;
  if (['youtube.com', 'youtube-nocookie.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? path.slice(1) : url.searchParams.get('v') || path.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) {
      src = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
      const start = url.searchParams.get('start') || url.searchParams.get('t');
      if (start) {
        const time = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(start);
        const seconds = /^\d+$/.test(start) ? Number(start) : time && Number(time[1] || 0) * 3600 + Number(time[2] || 0) * 60 + Number(time[3] || 0);
        if (seconds) src.searchParams.set('start', seconds);
      }
    }
  } else if (['vimeo.com', 'player.vimeo.com'].includes(host) && (match = path.match(/^\/(?:video\/)?(\d+)(?:\/([\w]+))?\/?$/))) {
    src = new URL(`https://player.vimeo.com/video/${match[1]}`);
    const hash = url.searchParams.get('h') || match[2];
    if (hash) src.searchParams.set('h', hash);
  } else if (host === 'rutube.ru' && (match = path.match(/^\/(?:video\/(?:private\/)?|play\/embed\/)([a-f\d]{32})\/?$/i))) {
    src = new URL(`https://rutube.ru/play/embed/${match[1]}`);
    for (const key of ['p', 't']) if (url.searchParams.has(key)) src.searchParams.set(key, url.searchParams.get(key));
  } else if (host === 'kinescope.io' && (match = path.match(/^\/(?:embed\/)?([^/]+)\/?$/)) && idPattern.test(match[1])) {
    src = new URL(`https://kinescope.io/embed/${match[1]}`);
  } else if (['vk.com', 'vkvideo.ru'].includes(host)) {
    if (path === '/video_ext.php' && /^-?\d+$/.test(url.searchParams.get('oid')) && /^\d+$/.test(url.searchParams.get('id'))) {
      src = new URL(`https://${host}/video_ext.php`);
      for (const key of ['oid', 'id', 'hash']) if (url.searchParams.has(key)) src.searchParams.set(key, url.searchParams.get(key));
    } else if ((match = path.match(/^\/video(-?\d+)_(\d+)\/?$/))) {
      src = new URL('https://vk.com/video_ext.php');
      src.searchParams.set('oid', match[1]);
      src.searchParams.set('id', match[2]);
    }
  }
  if (src) {
    if (url.protocol !== 'https:') throw new Error('Embeds require HTTPS');
    return { type: 'iframe', src: src.href };
  }
  if (embed) throw new Error('Unsupported embed URL');
  return { type: 'image', src: url.href };
}
