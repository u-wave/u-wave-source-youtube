import httpErrors from 'http-errors';
import getYouTubeID from 'get-youtube-id';
import { JSONSchema } from 'json-schema-typed';
import { getPlaylistID, getVideos, parseMediaTitle, type UwMedia } from './util';
import YouTubeClient, { SearchOptions, SearchResultResource } from './Client';
import Importer from './Importer';

const schema: JSONSchema & { 'uw:key': string } = {
  title: 'YouTube',
  description: 'Settings for the YouTube media source',
  'uw:key': 'source:youtube',
  type: 'object',
  properties: {
    key: {
      type: 'string',
      title: 'YouTube API Key',
      description: 'For information on how to configure your YouTube API access, '
        + 'see https://developers.google.com/youtube/v3/getting-started.',
    },
    search: {
      type: 'object',
      properties: {
        safeSearch: {
          type: 'string',
          title: 'Safe Search',
          default: 'none',
          enum: ['none', 'all'],
        },
        maxResults: {
          type: 'number',
          title: 'Max Results',
          description: 'Maximum amount of search results to return.',
          minimum: 0,
          maximum: 50,
          default: 25,
        },
      },
      // TODO can `default` recurse somehow? so we don't have to duplicate the values
      // for individual properties here?
      default: {
        safeSearch: 'none',
        maxResults: 25,
      },
    },
  },
  required: ['key'],
};

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

type ChannelAction = { action: 'channel', url: string };
type PlaylistAction = { action: 'playlist', url: string };
type ImportAction = { action: 'importplaylist', name: string, id: string };

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

class YouTubeSource {
  static sourceName = 'youtube';
  static schema = schema;
  static api = 3;

  private searchOptions: YouTubeOptions['search'];
  private client: YouTubeClient;
  private importer: Importer;

  constructor(opts: YouTubeOptions) {
    if (!opts || !opts.key) {
      throw new TypeError('Expected a YouTube API key in "options.key". For information on how to '
        + 'configure your YouTube API access, see '
        + 'https://developers.google.com/youtube/v3/getting-started.');
    }

    const params = { key: opts.key };
    this.searchOptions = opts.search || {};
    this.client = new YouTubeClient(params);

    this.importer = new Importer(this.client);
  }

  close() {
    // Nothing yet
  }

  async get(sourceIDs: string[]) {
    const results = await getVideos(this.client, sourceIDs);
    return results.map(parseMediaTitle);
  }

  async search(query: string, page?: unknown): Promise<unknown> {
    // When searching for a video URL, we want to look the video up directly.
    // Actual YouTube search is not well suited for video IDs, and IDs with special characters in
    // them can yield no or unexpected results. Additionally, we can save 99 quota points by using
    // the videos.list endpoint instead of search.list.
    const id = getYouTubeID(query, { fuzzy: false });
    if (id) {
      return getVideos(this.client, [id]);
    }

    const data = await this.client.search({
      ...defaultSearchOptions,
      ...this.searchOptions,
      q: query,
      pageToken: page as string,
    });

    const isVideo = (item: SearchResultResource) => item.id && item.id.videoId;
    const isBroadcast = (item: SearchResultResource) => item.snippet && item.snippet.liveBroadcastContent !== 'none';

    return getVideos(this.client, data.items
      .filter((item: SearchResultResource) => isVideo(item) && !isBroadcast(item))
      .map((item: SearchResultResource) => item.id.videoId));
  }

  async getPlaylistItems(ctx: any, idOrUrl: string): Promise<unknown> {
    const playlistID = getPlaylistID(idOrUrl);
    if (!playlistID) {
      throw new BadRequest('Invalid playlist URL. Please provide a direct link to the playlist '
        + 'you want to import.');
    }

    const items = await this.importer.getPlaylistItems(playlistID);
    // TODO parseMediaTitle if we are importing them NOW
    return items;
  }

  async getUserPlaylists(ctx: any, userID: string): Promise<unknown> {
    const items = await this.importer.getPlaylistMetasForUser(userID);

    return items;
  }
}

export default YouTubeSource;
