# KodeKloud English Subtitles

A small Chrome and Microsoft Edge extension that automatically enables an available English subtitle or closed-caption track on KodeKloud video lessons.

## Features

- Automatically selects English subtitles when a KodeKloud lesson opens.
- Works with dynamically loaded lessons and the embedded Vimeo player.
- Supports English language variants such as `en`, `en-US`, and `en-GB`.
- Provides a simple on/off switch and a status indicator.
- Runs entirely in the browser. It does not collect, upload, or transcribe audio.

## Install locally

### Chrome

1. Download this repository and extract it if necessary.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder that contains `manifest.json`.

### Microsoft Edge

1. Download this repository and extract it if necessary.
2. Open `edge://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder that contains `manifest.json`.

Open a KodeKloud video lesson after installation. The extension checks the page and embedded player every time a lesson or video changes. A green **EN** badge means the English track is active.

## Important limitation

This extension selects an English subtitle track that the lesson already provides. It does not generate a transcript. If a lesson has no English caption track, the popup displays **No English track found**.

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
service-worker.js      Per-tab status and badge handling
subtitle-engine.js     English-track detection and selection
content.js             KodeKloud/Vimeo page integration
content.css            Small success notification
popup.html             Extension popup
popup.css              Popup styles
popup.js               Popup behavior
tests/                  Subtitle selection tests
```

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: no analytics, no remote server, and no collection of browsing, account, audio, or course data.

## License

MIT — see [LICENSE](LICENSE).
