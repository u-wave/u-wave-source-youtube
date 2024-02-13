import nock from 'nock';
import * as assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import youTubeSource from 'u-wave-source-youtube';

const FAKE_KEY = 'AIzaSyVBDlZqp3o65v9zFWv0Qxij1rt3axCWqs9';

const createSource = () => youTubeSource({}, { key: FAKE_KEY });

const API_HOST = 'https://www.googleapis.com';

const fixture = (name) => fileURLToPath(new URL(`./responses/${name}.json`, import.meta.url));

test('providing a key is required', () => {
  assert.throws(
    () => youTubeSource({}),
    /Expected a YouTube API key/,
  );
});

test('searching for videos', async () => {
  const src = createSource();

  nock(API_HOST).get('/youtube/v3/search')
    .query(true)
    .replyWithFile(200, fixture('search'));
  nock(API_HOST).get('/youtube/v3/videos')
    .query(true)
    .replyWithFile(200, fixture('beyonceVideos'));

  const results = await src.search('Beyoncé');

  // Our mocked search only returns 5 items. Actual search would return 50. 🙈
  assert.equal(results.length, 5);

  results.forEach((item) => {
    assert.ok('artist' in item);
    assert.ok('title' in item);
  });

  // Search results should not modify the artist/title.
  assert.equal(results[0].artist, 'beyonceVEVO');
  assert.equal(results[0].title, 'Beyoncé - Hold Up');
});

test('get videos by id', async () => {
  const src = createSource();

  nock(API_HOST).get('/youtube/v3/videos')
    .query(true)
    .replyWithFile(200, fixture('getVideos'));

  const items = await src.get(['n0gAo8z859U', 'XO4xNQ-pWPQ']);

  assert.equal(items.length, 2);

  assert.equal(items[0].artist, 'LAYBACKSOUND');
  assert.equal(items[1].artist, 'KIRARA');
});

test('defaults to using the channel name as the artist name', async () => {
  const src = createSource();

  nock(API_HOST).get('/youtube/v3/videos')
    .query(true)
    // The fixture is edited to remove the artist name from the song title.
    .replyWithFile(200, fixture('useChannelName'));

  const items = await src.get(['t6gDp9IsBgw']);

  assert.equal(items.length, 1);
  assert.equal(items[0].artist, 'lang lee');
  assert.equal(items[0].title, '신의 놀이 (Playing God)');
});
