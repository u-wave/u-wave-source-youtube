import parseIsoDuration from 'parse-iso-duration';
import getArtistTitle from 'get-artist-title';
import getYouTubeID from 'get-youtube-id';
import getYouTubeChapters from 'get-youtube-chapters';
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
  return contentDetails.regionRestriction?.blocked ?? [];
}

type Chapter = {
  start: number,
  end: number,
  title: string,
};

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
    chapters?: Chapter[],
  };
}

/**
 * Convert a YouTube Video resource to a üWave media object.
 */
function convertVideoToMedia(video: VideoResource): UwMedia {
  const duration = parseYouTubeDuration(video.contentDetails.duration);

  const chapters = video.snippet.description ? getYouTubeChapters(video.snippet.description) : [];

  return {
    sourceID: video.id,
    artist: video.snippet.channelTitle,
    title: video.snippet.title,
    duration,
    thumbnail: getBestThumbnail(video.snippet.thumbnails),
    sourceData: {
      // Can be used by clients to determine the aspect ratio.
      embedWidth: video.player?.embedWidth ?? null,
      embedHeight: video.player?.embedHeight ?? null,
      blockedIn: getBlockedCountryCodes(video.contentDetails),
      // Add the `end` property to make things easier for clients.
      chapters: chapters.map((chapter, index) => {
        if (index < chapters.length - 1) {
          return {
            ...chapter,
            end: chapters[index + 1].start,
          };
        }
        return {
          ...chapter,
          end: duration,
        };
      }),
    },
  };
}

/**
 * Parse artist and title information from a YouTube video and channel title.
 */
export function parseMediaTitle(media: UwMedia): UwMedia {
  // getArtistTitle always returns something if `defaultArtist` is set
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [artist, title] = getArtistTitle(media.title, {
    defaultArtist: media.artist.replace(/ - Topic$/, ''),
  })!;

  return {
    ...media,
    // TODO Fix the detection in get-artist-title so that it doesn't split the
    // title into parts with only fluff.
    artist: artist || '[unknown]',
    title: title || '[unknown]',
  };
}

async function getVideosPage(client: Client, sourceIDs: string[]): Promise<UwMedia[]> {
  const data = await client.listVideos({
    part: 'snippet,contentDetails,player',
    fields: `
      items(
        id,
        snippet(title, channelTitle, description, thumbnails),
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

  return data.items
    .map(convertVideoToMedia)
    .filter((item) => item.duration > 0);
}

function* chunk<T>(input: T[], chunkSize: number) {
  for (let i = 0; i < input.length; i += chunkSize) {
    yield input.slice(i, i + chunkSize);
  }
}

/**
 * Fetch Video resources from the YouTube Data API.
 */
export async function getVideos(client: Client, sourceIDs: string[]): Promise<UwMedia[]> {
  const ids = sourceIDs.map((id) => getYouTubeID(id) || id);

  const pageIDs = Array.from(chunk(ids, 50));
  const pages = await Promise.all(pageIDs.map((page) => getVideosPage(client, page)));
  return pages.flat();
}
