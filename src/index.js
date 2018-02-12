import Promise from 'bluebird';
import getYouTubeID from 'get-youtube-id';
import parseIsoDuration from 'parse-iso-duration';
import getArtistTitle from 'get-artist-title';
import chunk from 'chunk';
import values from 'object-values';

import { google } from 'googleapis';

const youTube = google.youtube('v3');

const youTubeSearch = Promise.promisify(youTube.search.list);
const youTubeGet = Promise.promisify(youTube.videos.list);
const youTubeGetChannels = Promise.promisify(youTube.channels.list);
const youTubeGetPlaylists = Promise.promisify(youTube.playlists.list);
const youTubeGetPlaylistItems = Promise.promisify(youTube.playlistItems.list);

function parseYouTubeDuration(duration) {
  return Math.round(parseIsoDuration(duration) / 1000);
}

function getBestThumbnail(thumbnails) {
  if (thumbnails) {
    if (thumbnails.high) {
      return thumbnails.high.url;
    } else if (thumbnails.medium) {
      return thumbnails.medium.url;
    } else if (thumbnails.default) {
      return thumbnails.default.url;
    }
  }
  return '';
}

function getBlockedCountryCodes(contentDetails) {
  if (contentDetails.regionRestriction) {
    return contentDetails.regionRestriction.blocked || [];
  }
  return [];
}

function normalizeMedia(video) {
  const [artist, title] = getArtistTitle(video.snippet.title, {
    defaultArtist: video.snippet.channelTitle,
  });

  return {
    sourceID: video.id,
    // TODO Fix the detection in get-artist-title so that it doesn't split the
    // title into parts with only fluff.
    artist: artist || '[unknown]',
    title: title || '[unknown]',
    duration: parseYouTubeDuration(video.contentDetails.duration),
    thumbnail: getBestThumbnail(video.snippet.thumbnails),
    sourceData: {
      // Can be used by clients to determine the aspect ratio.
      embedWidth: video.player ? parseInt(video.player.embedWidth, 10) : null,
      embedHeight: video.player ? parseInt(video.player.embedHeight, 10) : null,
      blockedIn: getBlockedCountryCodes(video.contentDetails),
    },
  };
}

const rxChannelUrl = /youtube\.com\/channel\/([^/?#]+)/i;
const rxUserUrl = /youtube\.com\/user\/([^/?#]+)/i;

const rxSimplePlaylistUrl = /youtube\.com\/playlist\?.*?list=([a-z0-9_-]+)/i;
const rxPlaylistID = /^([a-z0-9_-]+)$/i;

/**
 * Extract a playlist ID from a playlist URL.
 */
export function getPlaylistID(url) {
  if (rxPlaylistID.test(url)) {
    return url;
  }

  const match = url.match(rxSimplePlaylistUrl);
  if (match) {
    return match[1];
  }

  return null;
}

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

export default function youTubeSource(uw, opts = {}) {
  if (!opts.key) {
    throw new TypeError('Expected a YouTube API key in "options.key". For information on how to ' +
      'configure your YouTube API access, see ' +
      'https://developers.google.com/youtube/v3/getting-started.');
  }

  const params = opts.key ? { key: opts.key } : {};
  const searchOptions = opts.search || {};

  async function getPage(sourceIDs) {
    const { data } = await youTubeGet({
      ...params,
      part: 'snippet,contentDetails,player',
      fields: `
        items(
          id,
          snippet(title, channelTitle, thumbnails),
          contentDetails(duration, regionRestriction),
          player(embedWidth, embedHeight)
        )
      `.replace(/\s+/g, ''),
      id: sourceIDs.join(','),
      // These are the maximum acceptable values, we only send them to force
      // YouTube to send an embedWidth and embedHeight back so we can calculate
      // the video aspect ratio.
      maxWidth: 8192,
      maxHeight: 8192,
    });

    return data.items.map(normalizeMedia).filter(item => item.duration > 0);
  }

  async function get(sourceIDs) {
    const ids = sourceIDs.map(id => getYouTubeID(id) || id);

    const pages = await Promise.all(chunk(ids, 50).map(getPage));
    return pages.reduce((result, page) => result.concat(page), []);
  }

  async function search(query, page = null) {
    // When searching for a video URL, we want to search for the video ID
    // only, because search results are very inconsistent with some types of
    // URLs.
    const id = getYouTubeID(query, { fuzzy: false });
    const { data } = await youTubeSearch({
      ...params,
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

  async function getPlaylistPage(playlistID, page = null) {
    const { data } = await youTubeGetPlaylistItems({
      ...params,
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

  async function getPlaylistItems(playlistID) {
    let page = null;
    const playlistItems = [];
    try {
      do {
        // This `await` is OK since we need to fetch this page to find out how
        // to fetch the next.
        // eslint-disable-next-line no-await-in-loop
        const res = await getPlaylistPage(playlistID, page);
        page = res.nextPage;
        playlistItems.push(...res.items);
      } while (page);
    } catch (e) {
      throw new Error('That playlist could not be imported. If it\'s a private playlist, ' +
        'change its visibility to Unlisted and try again.');
    }

    const ids = playlistItems.map(item => item.contentDetails.videoId);
    const medias = await get(ids);

    return medias.map(media => ({
      ...media,
      start: 0,
      end: media.duration,
    }));
  }

  async function getPlaylistMeta(playlistID) {
    const { data } = await youTubeGetPlaylists({
      ...params,
      part: 'snippet',
      fields: 'items(id,snippet/title)',
      id: playlistID,
      maxResults: 1,
    });
    return data.items[0];
  }

  async function getImportablePlaylist(url) {
    const playlistID = getPlaylistID(url);
    if (!playlistID) {
      throw new Error('Invalid playlist URL. Please provide a direct link to the playlist ' +
        'you want to import.');
    }
    const playlist = await getPlaylistMeta(playlistID);
    const items = await getPlaylistItems(playlistID);
    return {
      playlist: {
        sourceID: playlist.id,
        name: playlist.snippet.title,
      },
      items,
    };
  }

  async function getChannelMeta(url) {
    let match = url.match(rxChannelUrl);
    const request = {
      ...params,
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

    const { data } = await youTubeGetChannels(request);

    const channel = data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      playlists: channel.contentDetails.relatedPlaylists,
    };
  }

  async function getChannelPlaylistsPage(channelID, page = null) {
    const { data } = await youTubeGetPlaylists({
      ...params,
      ...getPlaylistsOptions,
      channelId: channelID,
      pageToken: page,
    });

    return {
      nextPage: data.nextPageToken,
      items: data.items,
    };
  }

  async function getChannelPlaylists(channelID) {
    const playlists = [];
    let page;
    do {
      // This `await` is OK since we need to fetch this page to find out how
      // to fetch the next.
      // eslint-disable-next-line no-await-in-loop
      const res = await getChannelPlaylistsPage(channelID, page);
      page = res.nextPage;
      playlists.push(...res.items);
    } while (page);

    return playlists;
  }

  function getSpecialChannelPlaylists(channel) {
    return youTubeGetPlaylists({
      ...params,
      ...getPlaylistsOptions,
      id: values(channel.playlists),
    }).then(({ data }) => data.items);
  }

  async function getPlaylistMetasForUser(url) {
    const channel = await getChannelMeta(url);

    const specials = getSpecialChannelPlaylists(channel);
    const playlists = getChannelPlaylists(channel.id);

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

  async function doImport(ctx, name, playlistID) {
    const items = await getPlaylistItems(playlistID);
    return ctx.createPlaylist(name, items);
  }

  return {
    name: 'youtube',
    search,
    get: get, // eslint-disable-line object-shorthand
    import: async (ctx, action) => {
      if (action.action === 'channel') {
        return getPlaylistMetasForUser(action.url);
      }
      if (action.action === 'playlist') {
        const importable = await getImportablePlaylist(action.url);
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
