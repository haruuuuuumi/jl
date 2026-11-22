// Public video metadata only; media streams directly from X's CDN.
export function getToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}
export function extractVideo(data, id, part) {
  if(data.__typename !== 'Tweet') return null;
  const media = data.mediaDetails || [];
  const selected = part ? media[part - 1] : media.find(m => m.type === 'video');
  if(selected?.type !== 'video') return null;
  const mp4 = (selected.video_info?.variants || []).filter(v => v.content_type === 'video/mp4' && /^https:\/\/video\.twimg\.com\//.test(v.url || ''));
  const economical = mp4.filter(v => (v.bitrate || 0) <= 3000000);
  const best = (economical.length ? economical : mp4).sort((a,b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if(!best) return null;
  const handle = data.user?.screen_name;
  if(!/^[A-Za-z0-9_]+$/.test(handle || '')) return null;
  const poster = /^https:\/\/pbs\.twimg\.com\//.test(selected.media_url_https || '') ? selected.media_url_https : '';
  const seconds = Math.round((selected.video_info.duration_millis || 0) / 1000);
  const index = media.indexOf(selected) + 1;
  const count = media.filter(m => m.type === 'video').length;
  return {
    videoSrc:best.url, posterSource:poster, image:poster,
    duration:Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0'),
    creator:{name:data.user.name || handle,handle,profileUrl:'https://x.com/' + handle,avatar:/^https:\/\/pbs\.twimg\.com\//.test(data.user.profile_image_url_https || '') ? data.user.profile_image_url_https : ''},
    mediaIndex:count > 1 ? index : null,mediaCount:count,
    sourceUrl:'https://x.com/' + handle + '/status/' + id + (count > 1 ? '/video/' + index : '')
  };
}
