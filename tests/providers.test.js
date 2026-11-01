import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMedia } from '../src/providers.js';

test('public and embed URLs for every provider', () => {
  const pairs = [
    ['https://youtu.be/M7lc1UVf-VE?t=1m30s', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=90'],
    ['https://youtube.com/embed/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'],
    ['https://youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'],
    ['https://vimeo.com/12345/secret', 'https://player.vimeo.com/video/12345?h=secret'],
    ['https://player.vimeo.com/video/12345?h=secret', 'https://player.vimeo.com/video/12345?h=secret'],
    ['https://rutube.ru/video/private/caafe83ff1c6ed38d394635b83ece578/?p=secret', 'https://rutube.ru/play/embed/caafe83ff1c6ed38d394635b83ece578?p=secret'],
    ['https://rutube.ru/play/embed/caafe83ff1c6ed38d394635b83ece578?p=secret', 'https://rutube.ru/play/embed/caafe83ff1c6ed38d394635b83ece578?p=secret'],
    ['https://kinescope.io/Abc123', 'https://kinescope.io/embed/Abc123'],
    ['https://kinescope.io/embed/Abc123', 'https://kinescope.io/embed/Abc123'],
    ['https://vkvideo.ru/video-123_456', 'https://vk.com/video_ext.php?oid=-123&id=456'],
    ['https://vk.com/video_ext.php?oid=-123&id=456&hash=secret', 'https://vk.com/video_ext.php?oid=-123&id=456&hash=secret']
  ];
  for (const [source, src] of pairs) assert.deepEqual(resolveMedia(source), { type: 'iframe', src });
});
test('file URLs, explicit type and embed validation', () => {
  assert.equal(resolveMedia('/movie.MP4?q=1').type, 'video');
  assert.equal(resolveMedia('/stream', { type: 'video' }).type, 'video');
  assert.equal(resolveMedia('/picture.avif').type, 'image');
  assert.equal(resolveMedia('/page', { embed: 'https://player.vimeo.com/video/123?h=key' }).type, 'iframe');
  for (const embed of ['javascript:alert(1)', 'https://youtube.com.evil.test/embed/M7lc1UVf-VE', 'https://youtube.com/anything', 'http://vimeo.com/123']) {
    assert.throws(() => resolveMedia('/page', { embed }));
  }
  assert.throws(() => resolveMedia('javascript:alert(1)'));
});
