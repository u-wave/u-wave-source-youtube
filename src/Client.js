import fetch from 'node-fetch';
import qsStringify from 'qs-stringify';

/**
 * A small YouTube Data API client.
 */
export default class YouTubeClient {
  constructor(params) {
    this.params = params;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  async get(resource, options) {
    const query = qsStringify({ ...this.params, ...options });
    const response = await fetch(`${this.baseUrl}/${resource}?${query}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error.message);
    }
    return data;
  }

  search(options) {
    return this.get('search', options);
  }

  listVideos(options) {
    return this.get('videos', options);
  }

  listPlaylistItems(options) {
    return this.get('playlistItems', options);
  }

  listPlaylists(options) {
    return this.get('playlists', options);
  }

  listChannels(options) {
    return this.get('channels', options);
  }
}
