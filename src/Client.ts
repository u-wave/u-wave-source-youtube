import fetch from 'node-fetch';
import createError from 'http-errors';
import qs from 'qs';
import https from 'https';

/**
 * General interface for query parameters to the YouTube API.
 */
export interface Params {
  [name: string]: string | number | undefined;
}

/**
 * YouTube response format for endpoints that return a list of things.
 *
 * @typeParam Kind  The name of the kind of resource that this endpoint returns.
 * @typeParam Item  An interface describing the shape of the resources that this endpoint returns.
 */
export interface ListResponse<Kind extends string, Item> {
  kind: Kind;
  etag: string;
  nextPageToken: string;
  prevPageToken: string;
  regionCode: string;
  pageInfo: {
    totalResults: number,
    resultsPerPage: number,
  };
  items: Item[];
}

/**
 * Describes a thumbnail for a video or playlist.
 */
export type Thumbnail = {
  url: string,
  width: number,
  height: number,
};
/**
 * Several named thumbnails.
 */
export type Thumbnails = {
  [key: string]: Thumbnail,
};

/**
 * The resource type returned from search requests.
 *
 * https://developers.google.com/youtube/v3/docs/search#resource
 */
export interface SearchResultResource {
  kind: 'youtube#SearchResultResource';
  etag: string;
  id: {
    kind: string,
    videoId: string,
    channelId: string,
    playlistId: string,
  };
  snippet: {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: Thumbnails,
    channelTitle: string,
    liveBroadcastContent: string,
  };
}

/**
 * The resource type returned from video listing requests.
 *
 * https://developers.google.com/youtube/v3/docs/videos#resource
 */
export interface VideoResource {
  kind: 'youtube#video',
  etag: string,
  id: string,
  snippet: {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: Thumbnails,
    channelTitle: string,
    tags: string[],
    categoryId: string,
    liveBroadcastContent: string,
    defaultLanguage: string,
    localized: {
      title: string,
      description: string
    },
    defaultAudioLanguage: string
  },
  contentDetails: {
    duration: string,
    dimension: string,
    definition: string,
    caption: string,
    licensedContent: boolean,
    regionRestriction: {
      allowed: string[],
      blocked: string[]
    },
    contentRating: {
      acbRating: string,
      agcomRating: string,
      anatelRating: string,
      bbfcRating: string,
      bfvcRating: string,
      bmukkRating: string,
      catvRating: string,
      catvfrRating: string,
      cbfcRating: string,
      cccRating: string,
      cceRating: string,
      chfilmRating: string,
      chvrsRating: string,
      cicfRating: string,
      cnaRating: string,
      cncRating: string,
      csaRating: string,
      cscfRating: string,
      czfilmRating: string,
      djctqRating: string,
      djctqRatingReasons: string[],
      ecbmctRating: string,
      eefilmRating: string,
      egfilmRating: string,
      eirinRating: string,
      fcbmRating: string,
      fcoRating: string,
      fmocRating: string,
      fpbRating: string,
      fpbRatingReasons: string[],
      fskRating: string,
      grfilmRating: string,
      icaaRating: string,
      ifcoRating: string,
      ilfilmRating: string,
      incaaRating: string,
      kfcbRating: string,
      kijkwijzerRating: string,
      kmrbRating: string,
      lsfRating: string,
      mccaaRating: string,
      mccypRating: string,
      mcstRating: string,
      mdaRating: string,
      medietilsynetRating: string,
      mekuRating: string,
      mibacRating: string,
      mocRating: string,
      moctwRating: string,
      mpaaRating: string,
      mpaatRating: string,
      mtrcbRating: string,
      nbcRating: string,
      nbcplRating: string,
      nfrcRating: string,
      nfvcbRating: string,
      nkclvRating: string,
      oflcRating: string,
      pefilmRating: string,
      rcnofRating: string,
      resorteviolenciaRating: string,
      rtcRating: string,
      rteRating: string,
      russiaRating: string,
      skfilmRating: string,
      smaisRating: string,
      smsaRating: string,
      tvpgRating: string,
      ytRating: string
    },
    projection: string,
    hasCustomThumbnail: boolean
  },
  status: {
    uploadStatus: string,
    failureReason: string,
    rejectionReason: string,
    privacyStatus: string,
    publishAt: string,
    license: string,
    embeddable: boolean,
    publicStatsViewable: boolean
  },
  statistics: {
    viewCount: number,
    likeCount: number,
    dislikeCount: number,
    favoriteCount: number,
    commentCount: number,
  },
  player: {
    embedHtml: string,
    embedHeight: number,
    embedWidth: number
  },
  topicDetails: {
    topicIds: string[],
    relevantTopicIds: string[],
    topicCategories: string[]
  },
  recordingDetails: {
    recordingDate: string
  },
  fileDetails: {
    fileName: string,
    fileSize: number,
    fileType: string,
    container: string,
    videoStreams: {
      widthPixels: number,
      heightPixels: number,
      frameRateFps: number,
      aspectRatio: number,
      codec: string,
      bitrateBps: number,
      rotation: string,
      vendor: string
    }[],
    audioStreams: {
      channelCount: number,
      codec: string,
      bitrateBps: number,
      vendor: string
    }[],
    durationMs: number,
    bitrateBps: number,
    creationTime: string
  },
  processingDetails: {
    processingStatus: string,
    processingProgress: {
      partsTotal: number,
      partsProcessed: number,
      timeLeftMs: number,
    },
    processingFailureReason: string,
    fileDetailsAvailability: string,
    processingIssuesAvailability: string,
    tagSuggestionsAvailability: string,
    editorSuggestionsAvailability: string,
    thumbnailsAvailability: string
  },
  suggestions: {
    processingErrors: string[],
    processingWarnings: string[],
    processingHints: string[],
    tagSuggestions: {
      tag: string,
      categoryRestricts: string[]
    }[],
    editorSuggestions: string[],
  },
  liveStreamingDetails: {
    actualStartTime: string,
    actualEndTime: string,
    scheduledStartTime: string,
    scheduledEndTime: string,
    concurrentViewers: number,
    activeLiveChatId: string
  },
  localizations: {
    [key: string]: {
      title: string,
      description: string
    }
  }
}

/**
 * The resource type returned from playlist item listing requests.
 *
 * https://developers.google.com/youtube/v3/docs/playlistItems#resource
 */
export interface PlaylistItemResource {
  kind: 'youtube#playlistItem',
  etag: string,
  id: string,
  snippet: {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: Thumbnails,
    channelTitle: string,
    playlistId: string,
    position: number,
    resourceId: {
      kind: string,
      videoId: string,
    }
  },
  contentDetails: {
    videoId: string,
    startAt: string,
    endAt: string,
    note: string,
    videoPublishedAt: string,
  },
  status: { privacyStatus: string },
}

/**
 * The resource type returned from playlist listing requests.
 *
 * https://developers.google.com/youtube/v3/docs/playlists#resource
 */
export interface PlaylistResource {
  kind: 'youtube#playlist',
  etag: string,
  id: string,
  snippet: {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: Thumbnails,
    channelTitle: string,
    tags: string[],
    defaultLanguage: string,
    localized: {
      title: string,
      description: string,
    },
  },
  status: { privacyStatus: string },
  contentDetails: { itemCount: number },
  player: { embedHtml: string },
  localizations: {
    [key: string]: {
      title: string,
      description: string,
    },
  },
}

/**
 * The resource type returned from channel listing requests.
 *
 * https://developers.google.com/youtube/v3/docs/channels#resource
 */
export interface ChannelResource {
  kind: 'youtube#channel',
  etag: string,
  id: string,
  snippet: {
    title: string,
    description: string,
    customUrl: string,
    publishedAt: string,
    thumbnails: Thumbnails,
    defaultLanguage: string,
    localized: {
      title: string,
      description: string
    },
    country: string
  },
  contentDetails: {
    relatedPlaylists: {
      likes: string,
      favorites: string,
      uploads: string,
      watchHistory: string,
      watchLater: string
    }
  },
  statistics: {
    viewCount: number,
    commentCount: number,
    subscriberCount: number,
    hiddenSubscriberCount: boolean,
    videoCount: number,
  },
  topicDetails: {
    topicIds: string[],
    topicCategories: string[]
  },
  status: {
    privacyStatus: string,
    isLinked: boolean,
    longUploadsStatus: string
  },
  brandingSettings: {
    channel: {
      title: string,
      description: string,
      keywords: string,
      defaultTab: string,
      trackingAnalyticsAccountId: string,
      moderateComments: boolean,
      showRelatedChannels: boolean,
      showBrowseView: boolean,
      featuredChannelsTitle: string,
      featuredChannelsUrls: string[],
      unsubscribedTrailer: string,
      profileColor: string,
      defaultLanguage: string,
      country: string
    },
    watch: {
      textColor: string,
      backgroundColor: string,
      featuredPlaylistId: string
    },
    image: {
      bannerImageUrl: string,
      bannerMobileImageUrl: string,
      watchIconImageUrl: string,
      trackingImageUrl: string,
      bannerTabletLowImageUrl: string,
      bannerTabletImageUrl: string,
      bannerTabletHdImageUrl: string,
      bannerTabletExtraHdImageUrl: string,
      bannerMobileLowImageUrl: string,
      bannerMobileMediumHdImageUrl: string,
      bannerMobileHdImageUrl: string,
      bannerMobileExtraHdImageUrl: string,
      bannerTvImageUrl: string,
      bannerTvLowImageUrl: string,
      bannerTvMediumImageUrl: string,
      bannerTvHighImageUrl: string,
      bannerExternalUrl: string
    },
    hints: {
      property: string,
      value: string
    }[],
  },
  invideoPromotion: {
    defaultTiming: {
      type: string,
      offsetMs: number,
      durationMs: number,
    },
    position: {
      type: string,
      cornerPosition: string,
    },
    items: {
      id: {
        type: string,
        videoId: string,
        websiteUrl: string,
        recentlyUploadedBy: string,
      },
      timing: {
        type: string,
        offsetMs: number,
        durationMs: number,
      },
      customMessage: string,
      promotedByContentOwner: boolean,
    }[],
    useSmartTiming: boolean,
  },
  auditDetails: {
    overallGoodStanding: boolean,
    communityGuidelinesGoodStanding: boolean,
    copyrightStrikesGoodStanding: boolean,
    contentIdClaimsGoodStanding: boolean,
  },
  contentOwnerDetails: {
    contentOwner: string,
    timeLinked: string,
  },
  localizations: {
    [key: string]: {
      title: string,
      description: string,
    },
  },
}

function unsafeCast<Source, Target>(s: Source): Target {
  return s as unknown as Target;
}

export type RequestOptions = {
  part: string,
  fields?: string,
  maxResults?: number,
  pageToken?: string,
};
export type SearchOptions = RequestOptions & {
  q: string;
  type: string;
  safeSearch?: string;
  videoSyndicated?: 'true' | 'any';
}
export type ListVideosOptions = RequestOptions & {
  id: string,
  maxWidth?: number,
  maxHeight?: number,
}
export type ListPlaylistItemsOptions = RequestOptions & {
  playlistId: string,
}
export type ListPlaylistsOptions = RequestOptions & ({ channelId: string } | { id: string })
export type ListChannelsOptions = RequestOptions & ({ forUsername: string } | { id: string })

/**
 * A small YouTube Data API client.
 */
export default class YouTubeClient {
  private params: Params;

  private agent: https.Agent;

  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  /**
   * @param params  Default query parameters for YouTube API requests—typically for API keys.
   */
  constructor(params: Params) {
    this.params = params;
    this.agent = new https.Agent({ keepAlive: true });
  }

  private async get(resource: string, options: Params): Promise<Record<string, unknown>> {
    const query = qs.stringify({ ...this.params, ...options });
    const response = await fetch(`${this.baseUrl}/${resource}?${query}`, {
      agent: this.agent,
    });
    const data = await response.json();
    if (!response.ok) {
      throw createError(response.status, data.error.message);
    }
    return data;
  }

  search(options: SearchOptions): Promise<ListResponse<'youtube#searchListResponse', SearchResultResource>> {
    return unsafeCast(this.get('search', options));
  }

  listVideos(options: ListVideosOptions): Promise<ListResponse<'youtube#videoListResponse', VideoResource>> {
    return unsafeCast(this.get('videos', options));
  }

  listPlaylistItems(options: ListPlaylistItemsOptions): Promise<ListResponse<'youtube#playlistItemListResponse', PlaylistItemResource>> {
    return unsafeCast(this.get('playlistItems', options));
  }

  listPlaylists(options: ListPlaylistsOptions): Promise<ListResponse<'youtube#playlistListResponse', PlaylistResource>> {
    return unsafeCast(this.get('playlists', options));
  }

  listChannels(options: ListChannelsOptions): Promise<ListResponse<'youtube#channelListResponse', ChannelResource>> {
    return unsafeCast(this.get('channels', options));
  }
}
