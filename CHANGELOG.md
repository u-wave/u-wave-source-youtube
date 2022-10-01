# u-wave-source-youtube change log

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

## 2.1.0 / 01 Oct 2022
Features:
* Support more chapter formats.

## 2.0.1 / 21 Sep 2022
Bugfixes:
 * Accept `/c/` vanity URLs.
 * Fix crash when `items` is completely missing from Google response.
 * Do not store `blockedIn` if it is empty.

## 2.0.0 / 23 May 2022
Features:
 * **breaking:** Add native ES module export.
 * **breaking:** Require Node.js 14+.
 * Strip " - Topic" from generated YouTube channel titles.
 * When searching for a video URL, look up only that video. This saves a lot of quota.
 * Search results and import previews use the original YouTube title.

Internal:
 * Rewrite it in typescript.
