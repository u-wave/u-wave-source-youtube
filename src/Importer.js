import { getPlaylistID, getVideos, getBestThumbnail } from './util';

const rxChannelUrl = /youtube\.com\/channel\/([^/?#]+)/i;
const rxUserUrl = /youtube\.com\/user\/([^/?#]+)/i;

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

export default class YouTubeImport {
  constructor(client) {
    this.client = client;
  }

  async getPlaylistPage(playlistID, page = null) {
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

  async getPlaylistItems(playlistID) {
    let page = null;
    const playlistItems = [];
    try {
      do {
        // This `await` is OK since we need to fetch this page to find out how
        // to fetch the next.
        // eslint-disable-next-line no-await-in-loop
        const res = await this.getPlaylistPage(playlistID, page);
        page = res.nextPage;
        playlistItems.push(...res.items);
      } while (page);
    } catch (e) {
      throw new Error('That playlist could not be imported. If it\'s a private playlist, ' +
        'change its visibility to Unlisted and try again.');
    }

    const ids = playlistItems.map(item => item.contentDetails.videoId);
    const medias = await getVideos(this.client, ids);

    return medias.map(media => ({
      ...media,
      start: 0,
      end: media.duration,
    }));
  }

  async getPlaylistMeta(playlistID) {
    const data = await this.client.listPlaylists({
      part: 'snippet',
      fields: 'items(id,snippet/title)',
      id: playlistID,
      maxResults: 1,
    });
    return data.items[0];
  }

  async getImportablePlaylist(url) {
    const playlistID = getPlaylistID(url);
    if (!playlistID) {
      throw new Error('Invalid playlist URL. Please provide a direct link to the playlist ' +
        'you want to import.');
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

  async getChannelMeta(url) {
    let match = url.match(rxChannelUrl);
    const request = {
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
    if (match) {
      request.id = match[1]; // eslint-disable-line prefer-destructuring
    } else {
      match = url.match(rxUserUrl);
      if (match) {
        request.forUsername = match[1]; // eslint-disable-line prefer-destructuring
      } else {
        throw new Error('Invalid channel URL. Please provide a direct link to the channel or ' +
          'user you want to import playlists from.');
      }
    }

    const data = await this.client.listChannels(request);
    if (data.items.length > 1) {
      throw new Error('That channel could not be found. Please check that you provided the ' +
        'full URL to the channel.');
    }

    const channel = data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      playlists: channel.contentDetails.relatedPlaylists,
    };
  }

  async getChannelPlaylistsPage(channelID, page = null) {
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

  async getChannelPlaylists(channelID) {
    const playlists = [];
    let page;
    do {
      // This `await` is OK since we need to fetch this page to find out how
      // to fetch the next.
      // eslint-disable-next-line no-await-in-loop
      const res = await this.getChannelPlaylistsPage(channelID, page);
      page = res.nextPage;
      playlists.push(...res.items);
    } while (page);

    return playlists;
  }

  async getSpecialChannelPlaylists(channel) {
    const data = await this.client.listPlaylists({
      ...getPlaylistsOptions,
      id: Object.values(channel.playlists).join(','),
    });
    return data.items;
  }

  async getPlaylistMetasForUser(url) {
    const channel = await this.getChannelMeta(url);

    const specials = this.getSpecialChannelPlaylists(channel);
    const playlists = this.getChannelPlaylists(channel.id);

    const result = await Promise.all([specials, playlists]);

    const allPlaylists = result[0].concat(result[1]);

    return {
      channel: { id: channel.id, title: channel.title },
      playlists: allPlaylists.map(item => ({
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
