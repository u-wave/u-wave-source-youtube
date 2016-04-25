üWave YouTube Media Source
==========================

A üWave media source for searching through and importing videos from YouTube.

## Installation

```
npm install --save u-wave-source-youtube
```

## Usage

```js
import uwave from 'u-wave-core';
import youTubeSource from 'u-wave-source-youtube';

const uw = uwave({ /* your config */ });

uw.source('youtube', youTubeSource, {
  // Get an API key as described here:
  // https://developers.google.com/youtube/v3/getting-started
  key: 'Your YouTube API Key',
  // Optionally override YouTube API search options.
  // See https://developers.google.com/youtube/v3/docs/search/list#parameters
  // for available options.
  search: {
    safeSearch: 'moderate'
  }
});
```

## License

[MIT](./LICENSE)
