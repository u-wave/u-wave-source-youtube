import httpErrors from 'http-errors';
import {
  getPlaylistID,
  getVideos,
  getBestThumbnail,
  type UwMedia,
} from './util';
import Client, { PlaylistResource, PlaylistItemResource } from './Client';

const { BadRequest, NotFound } = httpErrors;

const rxChannelUrl = /youtube\.com\/channel\/([^/?#]+)/i;
const rxUserUrl = /youtube\.com\/(?:user|c)\/([^/?#]+)/i;

const getPlaylistsOptions = {
  part: 'snippet,contentDetails',
  fields: `
    items(
      id,
      snippet/title,
      snippet/description,
      snippet/channelTitle,
      snippet/thumbnails,
      contentDetails/itemCount
    ),
    pageInfo,
    nextPageToken
  `.replace(/\s+/g, ''),
  maxResults: 50,
};

type ChannelMeta = {
  id: string,
  title: string,
  playlists: {
    favorites: string,
    uploads: string,
  },
};

type PlaylistMeta = {
  sourceID: string,
  sourceChannel: string,
  name: string,
  description: string,
  size: number,
  thumbnail: string,
};

type PlaylistsPage = { nextPage: string, items: PlaylistResource[] };
type PlaylistItemsPage = { nextPage: string, items: PlaylistItemResource[] };

export default class YouTubeImport {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async getPlaylistItemsPage(playlistID: string, page?: string): Promise<PlaylistItemsPage> {
    const data = await this.client.listPlaylistItems({
      part: 'contentDetails',
      playlistId: playlistID,
      maxResults: 50,
      pageToken: page,
    });

    return {
      nextPage: data.nextPageToken,
      items: data.items,
    };
  }

  async getPlaylistItems(playlistID: string): Promise<UwMedia[]> {
    let page;
    const playlistItems = [];
    try {
      do {
        // This `await` is OK since we need to fetch this page to find out how
        // to fetch the next.
        // eslint-disable-next-line no-await-in-loop
        const res: PlaylistItemsPage = await this.getPlaylistItemsPage(playlistID, page);
        page = res.nextPage;
        playlistItems.push(...res.items);
      } while (page);
    } catch (error) {
      throw Object.assign(
        new BadRequest('That playlist could not be imported. If it\'s a private playlist, '
          + 'change its visibility to Unlisted and try again.'),
        { cause: error },
      );
    }

    const ids = playlistItems.map((item) => item.contentDetails.videoId);
    const medias = await getVideos(this.client, ids);

    return medias.map((media) => ({
      ...media,
      start: 0,
      end: media.duration,
    }));
  }

  async getPlaylistMeta(playlistID: string): Promise<PlaylistResource> {
    const data = await this.client.listPlaylists({
      part: 'snippet',
      fields: 'items(id,snippet/title)',
      id: playlistID,
      maxResults: 1,
    });
    return data.items[0];
  }

  async getImportablePlaylist(url: string): Promise<{
    playlist: {
      sourceID: string,
      name: string,
    },
    items: unknown[],
  }> {
    const playlistID = getPlaylistID(url);
    if (!playlistID) {
      throw new BadRequest('Invalid playlist URL. Please provide a direct link to the playlist '
        + 'you want to import.');
    }
    const playlist = await this.getPlaylistMeta(playlistID);
    const items = await this.getPlaylistItems(playlistID);
    return {
      playlist: {
        sourceID: playlist.id,
        name: playlist.snippet.title,
      },
      items,
    };
  }

  async getChannelMeta(url: string): Promise<ChannelMeta> {
    let match = url.match(rxChannelUrl);
    const baseOptions = {
      part: 'snippet,contentDetails',
      fields: `
        items(
          id,
          snippet/title,
          contentDetails/relatedPlaylists/favorites,
          contentDetails/relatedPlaylists/uploads
        )
      `.replace(/\s+/g, ''),
      maxResults: 1,
    };
    let idOptions;
    if (match) {
      idOptions = { id: match[1] };
    } else {
      match = url.match(rxUserUrl);
      if (match) {
        idOptions = { forUsername: match[1] };
      } else {
        throw new BadRequest('Invalid channel URL. Please provide a direct link to the channel or '
          + 'user you want to import playlists from.');
      }
    }

    const data = await this.client.listChannels({
      ...baseOptions,
      ...idOptions,
    });
    if (data.items.length > 1) {
      throw new NotFound('That channel could not be found. Please check that you provided the '
        + 'full URL to the channel.');
    }

    const channel = data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      playlists: channel.contentDetails.relatedPlaylists,
    };
  }

  async getChannelPlaylistsPage(channelID: string, page?: string): Promise<PlaylistsPage> {
    const data = await this.client.listPlaylists({
      ...getPlaylistsOptions,
      channelId: channelID,
      pageToken: page,
    });

    return {
      nextPage: data.nextPageToken,
      items: data.items,
    };
  }

  async getChannelPlaylists(channelID: string): Promise<PlaylistResource[]> {
    const playlists = [];
    let page;
    do {
      // This `await` is OK since we need to fetch this page to find out how
      // to fetch the next.
      // eslint-disable-next-line no-await-in-loop
      const res: PlaylistsPage = await this.getChannelPlaylistsPage(channelID, page);
      page = res.nextPage;
      playlists.push(...res.items);
    } while (page);

    return playlists;
  }

  async getSpecialChannelPlaylists(channel: ChannelMeta): Promise<PlaylistResource[]> {
    const data = await this.client.listPlaylists({
      ...getPlaylistsOptions,
      id: Object.values(channel.playlists).join(','),
    });
    return data.items;
  }

  async getPlaylistMetasForUser(url: string): Promise<{
    channel: { id: string, title: string },
    playlists: PlaylistMeta[],
  }> {
    const channel = await this.getChannelMeta(url);

    const specials = this.getSpecialChannelPlaylists(channel);
    const playlists = this.getChannelPlaylists(channel.id);

    const result = await Promise.all([specials, playlists]);

    const allPlaylists = result[0].concat(result[1]);

    return {
      channel: { id: channel.id, title: channel.title },
      playlists: allPlaylists.map((item) => ({
        sourceID: item.id,
        sourceChannel: item.snippet.channelTitle,
        name: item.snippet.title,
        description: item.snippet.description,
        size: item.contentDetails.itemCount,
        thumbnail: getBestThumbnail(item.snippet.thumbnails),
      })),
    };
  }
}
