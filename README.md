# KodeKloud Subtitle Companion

A Chrome and Microsoft Edge extension that displays a KodeKloud lesson's available English captions live in a separate companion tab.

## What it does

1. Detects a video lesson on `learn.kodekloud.com`.
2. Selects the lesson's available English subtitle or closed-caption track.
3. Opens one companion tab beside the KodeKloud lesson.
4. Shows the current English caption in large text, synchronized with playback.
5. Keeps a recent caption history so a sentence can be read again.

The video remains in the original KodeKloud tab. The subtitles appear in the separate companion tab.

## Features

- Separate, distraction-free English subtitle tab.
- Automatic companion-tab opening, with an on/off setting.
- Manual **Open subtitle tab** button from the extension popup.
- Live playback time, progress, pause/play state, and caption history.
- Adjustable subtitle text size.
- Works with dynamically loaded KodeKloud lessons and the embedded Vimeo player.
- Supports English variants such as `en`, `en-US`, and `en-GB`.
- Runs locally without uploading audio or course data.

## Install locally

### Microsoft Edge

1. Download this repository and extract it if necessary.
2. Open `edge://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

### Google Chrome

1. Download this repository and extract it if necessary.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

## Use

1. Open a KodeKloud video lesson.
2. Start the video.
3. The companion tab opens automatically when an English track is detected.
4. If it does not open, click the extension icon and select **Open subtitle tab**.

Keep both tabs open. The companion tab reads playback information from the original KodeKloud lesson tab.

## Important limitation

This extension displays an English caption track that the lesson already provides. It does not perform speech-to-text transcription. If a lesson has no English caption track, the companion reports that captions are unavailable.

## Development

The project has no runtime dependencies.

```bash
npm test
npm run validate
```

After changing the source, open the browser's extensions page and click **Reload** on the extension card.

## Project structure

```text
manifest.json          Extension configuration
service-worker.js      Session state and companion-tab management
subtitle-engine.js     English-track detection and selection
content.js             KodeKloud/Vimeo caption capture
popup.*                Extension controls and status
viewer.*               Separate live subtitle companion tab
viewer-model.js        Viewer formatting helpers
tests/                  Automated unit tests
```

## Privacy

See [PRIVACY.md](PRIVACY.md). There is no analytics or remote server. Live captions are held temporarily in extension memory and are discarded when the browser session ends or the extension reloads.

## License

MIT — see [LICENSE](LICENSE).
