import getYouTubeID from 'get-youtube-id';
import { getVideos } from './util';
import YouTubeClient from './Client';
import Importer from './Importer';

const defaultSearchOptions = {
  part: 'id,snippet',
  fields: `
    items(id/videoId, snippet/liveBroadcastContent),
    pageInfo,
    nextPageToken,
    prevPageToken
  `.replace(/\s+/g, ''),
  type: 'video',
  maxResults: 50,
  safeSearch: 'none',
  videoSyndicated: true,
};

export default function youTubeSource(uw, opts = {}) {
  if (!opts.key) {
    throw new TypeError('Expected a YouTube API key in "options.key". For information on how to ' +
      'configure your YouTube API access, see ' +
      'https://developers.google.com/youtube/v3/getting-started.');
  }

  const params = opts.key ? { key: opts.key } : {};
  const searchOptions = opts.search || {};
  const client = new YouTubeClient(params);

  const importer = new Importer(client);

  function get(sourceIDs) {
    return getVideos(client, sourceIDs);
  }

  async function search(query, page = null) {
    // When searching for a video URL, we want to search for the video ID
    // only, because search results are very inconsistent with some types of
    // URLs.
    const id = getYouTubeID(query, { fuzzy: false });
    const data = await client.search({
      ...defaultSearchOptions,
      ...searchOptions,
      q: id ? `"${id}"` : query,
      pageToken: page,
    });

    const isVideo = item => item.id && item.id.videoId;
    const isBroadcast = item => item.snippet && item.snippet.liveBroadcastContent !== 'none';

    return get(data.items
      .filter(item => isVideo(item) && !isBroadcast(item))
      .map(item => item.id.videoId));
  }

  async function doImport(ctx, name, playlistID) {
    const items = await importer.getPlaylistItems(playlistID);
    return ctx.createPlaylist(name, items);
  }

  return {
    name: 'youtube',
    search,
    get: get, // eslint-disable-line object-shorthand
    import: async (ctx, action) => {
      if (action.action === 'channel') {
        return importer.getPlaylistMetasForUser(action.url);
      }
      if (action.action === 'playlist') {
        const importable = await importer.getImportablePlaylist(action.url);
        importable.items = ctx.source.addSourceType(importable.items);
        return importable;
      }
      if (action.action === 'importplaylist') {
        return doImport(ctx, action.name, action.id);
      }

      throw new TypeError(`Unknown action "${action}"`);
    },
  };
}
