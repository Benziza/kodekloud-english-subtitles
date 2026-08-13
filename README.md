# KodeKloud English Subtitle Finder

A small Chrome and Microsoft Edge extension that finds the English subtitle track used by a KodeKloud video and opens the original subtitle file in a separate browser tab.

This version is inspired by a simple Vimeo subtitle-finder workflow: inspect every accessible frame, locate an English `<track>` source, and open that source directly.

## How it works

1. Open a video lesson on `learn.kodekloud.com`.
2. Start the video so its embedded Vimeo player and subtitle tracks load.
3. Click the extension icon.
4. The extension searches the page, Vimeo iframe, and open Shadow DOM roots.
5. Click **Open subtitles in new tab**.

The new tab contains the original English subtitle resource supplied to the video player, commonly a WebVTT file.

## Features

- Searches all accessible frames, including the Vimeo player.
- Searches video tracks inside open Shadow DOM roots.
- Recognizes `en`, English regional codes such as `en-US`, and labels containing “English”.
- Shows the discovered track label and URL before opening it.
- Opens the original subtitle resource in a separate tab.
- Uses host access only for KodeKloud and Vimeo—not every website.
- No analytics, remote server, or audio recording.

## Install in Microsoft Edge

1. Download this repository and extract it if necessary.
2. Open `edge://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

## Install in Google Chrome

1. Download this repository and extract it if necessary.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

## If no English subtitle is found

- Confirm that you opened a video lesson rather than the course catalog.
- Start the video and wait for the Vimeo player to finish loading.
- Click **Search again**.
- Confirm that the extension is allowed on KodeKloud and Vimeo.

Some lessons may not expose an English `<track>` source. The extension does not generate speech-to-text subtitles when no source track exists.

## Development

The project has no runtime dependencies.

```bash
npm test
npm run validate
```

After changing the source, open the browser's extensions page and click **Reload** on the extension card.

## Project structure

```text
manifest.json       Extension permissions and popup configuration
popup.html          Finder interface
popup.css           Popup design
popup.js            Multi-frame search and new-tab opening
track-selector.js   Testable English-track selection helpers
tests/               Unit tests
```

## Privacy

See [PRIVACY.md](PRIVACY.md). The extension only reads subtitle track metadata after the user clicks its toolbar icon.

## License

MIT — see [LICENSE](LICENSE).
