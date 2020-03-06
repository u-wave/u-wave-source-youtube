import httpErrors from 'http-errors';
import getYouTubeID from 'get-youtube-id';
import { getVideos } from './util';
import YouTubeClient, { SearchOptions, SearchResultResource } from './Client';
import Importer from './Importer';

const { BadRequest } = httpErrors;

const defaultSearchOptions: Pick<SearchOptions, Exclude<keyof SearchOptions, 'q'>> = {
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
  videoSyndicated: 'true',
};

export interface YouTubeOptions {
  key: string;
  search?: Partial<Pick<SearchOptions, Exclude<keyof SearchOptions, 'part' | 'fields' | 'type'>>>;
};

export default function youTubeSource(uw: any, opts: YouTubeOptions) {
  if (!opts || !opts.key) {
    throw new TypeError('Expected a YouTube API key in "options.key". For information on how to '
      + 'configure your YouTube API access, see '
      + 'https://developers.google.com/youtube/v3/getting-started.');
  }

  const params = { key: opts.key };
  const searchOptions = opts.search || {};
  const client = new YouTubeClient(params);

  const importer = new Importer(client);

  function get(sourceIDs: string[]) {
    return getVideos(client, sourceIDs);
  }

  async function search(query: string, page?: string): Promise<unknown> {
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

    const isVideo = (item: SearchResultResource) => item.id && item.id.videoId;
    const isBroadcast = (item: SearchResultResource) => item.snippet && item.snippet.liveBroadcastContent !== 'none';

    return get(data.items
      .filter((item: SearchResultResource) => isVideo(item) && !isBroadcast(item))
      .map((item: SearchResultResource) => item.id.videoId));
  }

  async function doImport(ctx: any, name: string, playlistID: string) {
    const items = await importer.getPlaylistItems(playlistID);
    return ctx.createPlaylist(name, items);
  }

  return {
    name: 'youtube',
    search,
    get: get, // eslint-disable-line object-shorthand
    import: async (ctx: any, action: ChannelAction | PlaylistAction | ImportAction) => {
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

      throw new BadRequest(`Unknown action "${action}"`);
    },
  };
}

type ChannelAction = { action: 'channel', url: string };
type PlaylistAction = { action: 'playlist', url: string };
type ImportAction = { action: 'importplaylist', name: string, id: string };
