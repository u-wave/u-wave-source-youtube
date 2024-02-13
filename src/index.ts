import getYouTubeID from 'get-youtube-id';
import httpErrors from 'http-errors';
import YouTubeClient, { type SearchOptions, type SearchResultResource } from './Client';
import Importer from './Importer';
import { getVideos, parseMediaTitle, type UwMedia } from './util';

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

interface MediaSource {
  name: string;
  search: (query: string, page?: unknown) => Promise<unknown>;
  get: (sourceIDs: string[]) => Promise<unknown>;
  import: (ctx: unknown, action: unknown) => Promise<unknown>;
}

export interface YouTubeOptions {
  /**
   * Your YouTube API key.
   *
   * For information on how to configure your YouTube API access, see https://developers.google.com/youtube/v3/getting-started.
   */
  key: string;

  /**
   * Options for the search endpoint.
   */
  search?: Partial<Pick<SearchOptions, Exclude<keyof SearchOptions, 'part' | 'fields' | 'type'>>>;
}

type ChannelAction = { action: 'channel', url: string };
type PlaylistAction = { action: 'playlist', url: string };
type ImportAction = { action: 'importplaylist', name: string, id: string };

/**
 * The YouTube media source. Pass this function to `uw.source()`.
 */
export default function youTubeSource(_uw: unknown, opts: YouTubeOptions): MediaSource {
  if (!opts || !opts.key) {
    throw new TypeError(
      'Expected a YouTube API key in "options.key". For information on how to '
        + 'configure your YouTube API access, see '
        + 'https://developers.google.com/youtube/v3/getting-started.',
    );
  }

  const params = { key: opts.key };
  const searchOptions = opts.search || {};
  const client = new YouTubeClient(params);

  const importer = new Importer(client);

  async function get(sourceIDs: string[]) {
    const results = await getVideos(client, sourceIDs);
    return results.map(parseMediaTitle);
  }

  async function search(query: string, page?: unknown): Promise<UwMedia[]> {
    // When searching for a video URL, we want to look the video up directly.
    // Actual YouTube search is not well suited for video IDs, and IDs with special characters in
    // them can yield no or unexpected results. Additionally, we can save 99 quota points by using
    // the videos.list endpoint instead of search.list.
    const id = getYouTubeID(query, { fuzzy: false });
    if (id) {
      return getVideos(client, [id]);
    }

    const data = await client.search({
      ...defaultSearchOptions,
      ...searchOptions,
      q: query,
      pageToken: page as string,
    });

    const isVideo = (item: SearchResultResource) => item.id && item.id.videoId;
    const isBroadcast = (item: SearchResultResource) => item.snippet && item.snippet.liveBroadcastContent !== 'none';

    return getVideos(
      client,
      data.items
        .filter((item: SearchResultResource) => isVideo(item) && !isBroadcast(item))
        .map((item: SearchResultResource) => item.id.videoId),
    );
  }

  async function doImport(ctx: any, name: string, playlistID: string) {
    const items = await importer.getPlaylistItems(playlistID);
    return ctx.createPlaylist(name, items.map(parseMediaTitle));
  }

  return {
    name: 'youtube',
    search,
    get: get, // eslint-disable-line object-shorthand
    import: async (ctx: any, action_: unknown) => {
      const action = action_ as ChannelAction | PlaylistAction | ImportAction;

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
