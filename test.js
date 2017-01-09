import test from 'ava';
import nock from 'nock';
import * as path from 'path';
import youTubeSource from './';

const FAKE_KEY = 'AIzaSyVBDlZqp3o65v9zFWv0Qxij1rt3axCWqs9';

const createSource = () =>
  youTubeSource({}, { key: FAKE_KEY });

const API_HOST = 'https://www.googleapis.com';

const fixture = name => path.join(__dirname, 'test/responses', `${name}.json`);

test('providing a key is required', (t) => {
  t.throws(
    () => youTubeSource({}),
    /Expected a YouTube API key/
  );
});

test('searching for videos', async (t) => {
  const src = createSource();

  nock(API_HOST).get('/youtube/v3/search')
    .query(true)
    .replyWithFile(200, fixture('search'));
  nock(API_HOST).get('/youtube/v3/videos')
    .query(true)
    .replyWithFile(200, fixture('beyonceVideos'));

  const results = await src.search('Beyoncé');

  // Our mocked search only returns 5 items. Actual search would return 50. 🙈
  t.is(results.length, 5);

  results.forEach((item) => {
    t.true('artist' in item);
    t.true('title' in item);
  });
});

test('get videos by id', async (t) => {
  const src = createSource();

  nock(API_HOST).get('/youtube/v3/videos')
    .query(true)
    .replyWithFile(200, fixture('getVideos'));

  const items = await src.get(['n0gAo8z859U', 'XO4xNQ-pWPQ']);

  t.is(items.length, 2);

  t.is(items[0].artist, 'LAYBACKSOUND');
  t.is(items[1].artist, 'KIRARA');
});

test('defaults to using the channel name as the artist name', async (t) => {
  const src = createSource();

  nock(API_HOST).get('/youtube/v3/videos')
    .query(true)
    // The fixture is edited to remove the artist name from the song title.
    .replyWithFile(200, fixture('useChannelName'));

  const items = await src.get(['t6gDp9IsBgw']);

  t.is(items.length, 1);
  t.is(items[0].artist, 'lang lee');
  t.is(items[0].title, '신의 놀이 (Playing God)');
});
