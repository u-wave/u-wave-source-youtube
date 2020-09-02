import httpErrors from 'http-errors';
import getYouTubeID from 'get-youtube-id';
import { JSONSchema } from 'json-schema-typed';
import { getVideos } from './util';
import YouTubeClient, { SearchOptions, SearchResultResource } from './Client';
import Importer from './Importer';

const schema: JSONSchema = {
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
      required: ['part', 'type'],
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

  get(sourceIDs: string[]) {
    return getVideos(this.client, sourceIDs);
  }

  async search(query: string, page?: unknown): Promise<unknown> {
    // When searching for a video URL, we want to search for the video ID
    // only, because search results are very inconsistent with some types of
    // URLs.
    const id = getYouTubeID(query, { fuzzy: false });
    const data = await this.client.search({
      ...defaultSearchOptions,
      ...this.searchOptions,
      q: id ? `"${id}"` : query,
      pageToken: page as string,
    });

    const isVideo = (item: SearchResultResource) => item.id && item.id.videoId;
    const isBroadcast = (item: SearchResultResource) => item.snippet && item.snippet.liveBroadcastContent !== 'none';

    return this.get(data.items
      .filter((item: SearchResultResource) => isVideo(item) && !isBroadcast(item))
      .map((item: SearchResultResource) => item.id.videoId));
  }

  private async doImport(ctx: any, name: string, playlistID: string) {
    const items = await this.importer.getPlaylistItems(playlistID);
    return ctx.createPlaylist(name, items);
  }

  async import(ctx: any, action_: unknown) {
    const action = action_ as ChannelAction | PlaylistAction | ImportAction;

    if (action.action === 'channel') {
      return this.importer.getPlaylistMetasForUser(action.url);
    }
    if (action.action === 'playlist') {
      const importable = await this.importer.getImportablePlaylist(action.url);
      importable.items = ctx.source.addSourceType(importable.items);
      return importable;
    }
    if (action.action === 'importplaylist') {
      return this.doImport(ctx, action.name, action.id);
    }

    throw new BadRequest(`Unknown action "${action}"`);
  }
}

export default YouTubeSource;
