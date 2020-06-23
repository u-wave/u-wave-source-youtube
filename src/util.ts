import parseIsoDuration from 'parse-iso-duration';
import getArtistTitle from 'get-artist-title';
import getYouTubeID from 'get-youtube-id';
import chunk from 'chunk';
import Client, { Thumbnails, VideoResource } from './Client';

const rxSimplePlaylistUrl = /youtube\.com\/(?:playlist|watch)\?.*?list=([a-z0-9_-]+)/i;
const rxPlaylistID = /^([a-z0-9_-]+)$/i;

/**
 * Extract a playlist ID from a playlist URL.
 */
export function getPlaylistID(url: string): string | null {
  if (rxPlaylistID.test(url)) {
    return url;
  }

  const match = url.match(rxSimplePlaylistUrl);
  if (match) {
    return match[1];
  }

  return null;
}

function parseYouTubeDuration(duration: string): number {
  return Math.round(parseIsoDuration(duration) / 1000);
}

/**
 * Get the highest quality available thumbnail for a video or playlist.
 */
export function getBestThumbnail(thumbnails: Thumbnails): string {
  if (thumbnails) {
    if (thumbnails.high) {
      return thumbnails.high.url;
    }
    if (thumbnails.medium) {
      return thumbnails.medium.url;
    }
    if (thumbnails.default) {
      return thumbnails.default.url;
    }
  }
  return '';
}

function getBlockedCountryCodes(contentDetails: VideoResource['contentDetails']): string[] {
  if (contentDetails.regionRestriction) {
    return contentDetails.regionRestriction.blocked || [];
  }
  return [];
}

export interface UwMedia {
  sourceID: string;
  artist: string;
  title: string;
  duration: number;
  thumbnail: string;
  sourceData: {
    embedWidth: number | null,
    embedHeight: number | null,
    blockedIn: string[],
  };
}

/**
 * Convert a YouTube Video resource to a üWave media object.
 */
export function normalizeMedia(video: VideoResource): UwMedia {
  const [artist, title] = getArtistTitle(video.snippet.title, {
    defaultArtist: video.snippet.channelTitle,
  })!;

  return {
    sourceID: video.id,
    // TODO Fix the detection in get-artist-title so that it doesn't split the
    // title into parts with only fluff.
    artist: artist ? artist.replace(/ - Topic$/, '') : '[unknown]',
    title: title || '[unknown]',
    duration: parseYouTubeDuration(video.contentDetails.duration),
    thumbnail: getBestThumbnail(video.snippet.thumbnails),
    sourceData: {
      // Can be used by clients to determine the aspect ratio.
      embedWidth: video.player ? video.player.embedWidth : null,
      embedHeight: video.player ? video.player.embedHeight : null,
      blockedIn: getBlockedCountryCodes(video.contentDetails),
    },
  };
}

async function getVideosPage(client: Client, sourceIDs: string[]): Promise<UwMedia[]> {
  const data = await client.listVideos({
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

  return data.items.map(normalizeMedia).filter((item) => item.duration > 0);
}

/**
 * Fetch Video resources from the YouTube Data API.
 */
export async function getVideos(client: Client, sourceIDs: string[]): Promise<UwMedia[]> {
  const ids = sourceIDs.map((id) => getYouTubeID(id) || id);

  const pages = await Promise.all(chunk(ids, 50).map((page) => getVideosPage(client, page)));
  return pages.reduce((result, page) => result.concat(page), []);
}
