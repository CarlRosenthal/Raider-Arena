# Raider Arena

Four Lincoln High School crowd games, split from the original Raider-Arena.html into independent pages and readable source files. This is a static website: no build step, account system, paid service, or backend required.

## Games

| Game              | Page                     | Main game code                                   |
| ----------------- | ------------------------ | ------------------------------------------------ |
| Cup Shuffle       | `cup-shuffle.html`       | `assets/js/games/cup-shuffle.js` + `shell.js`    |
| Raider Rally Race | `raider-rally-race.html` | `assets/js/games/raider-rally-race.js`           |
| Helmet Shuffle    | `helmet-shuffle.html`    | `assets/js/games/helmet-shuffle.js` + `shell.js` |
| Memory Match      | `memory-match.html`      | `assets/js/games/memory-match.js`                |

`index.html` is the game-selection hub. Every game has a direct link, its own page, and an operator popup. Cup and helmet games share their shuffle rules to keep ball tracking consistent.

The original artwork, three race lanes, six memory pairs, optional sounds, saved settings, and all six presets are retained. Memory Match defaults to **30 seconds at Varsity**. Higher difficulty presets and tuning intentionally change its time limit. Impossible remains a novelty challenge.

## Host with GitHub Pages

1. Put this project's contents at the root of a GitHub repository, on `main`. Include the `assets` folder and `.nojekyll` file.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/ (root)**, then save.
5. Use the site URL shown by GitHub after deployment completes.

For a repository named `raider-arena` under `CarlRosenthal`, the expected URL is `https://carlrosenthal.github.io/raider-arena/`. This is an expected address, not confirmation of a live deployment. GitHub Pages must first be enabled. Use a public repository for free Pages hosting under GitHub Free.

Future commits to the selected publishing branch will update the hosted games. All asset and navigation links are relative, so the website works under a repository subpath or on another static host.

GitHub reference: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>

## Run locally or offline

Download the repository ZIP, extract **the entire folder**, and open `index.html` in current Chrome or Edge. Keep the `assets` folder beside the HTML pages. There are no CDN dependencies; the downloaded project works without an internet connection.

For a local web server:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Serving the files also gives consistent browser storage behavior. Local preferences are per browser and origin; settings from the old standalone file might not carry over to the hosted URL.

## Use at an event

Open a game, click **Operator window**, and move the game board to the venue display using extended displays. Keep the operator popup on your control monitor. Allow popups for the site if prompted.

| Key              | Action                           |
| ---------------- | -------------------------------- |
| Space            | Start, reveal, or next round     |
| 1 / 2 / 3        | Pick a cup, helmet, or race lane |
| 1–12, then Enter | Select a Memory Match card       |
| P                | Pause / resume                   |
| R                | Reset                            |
| O                | Open operator window             |
| F                | Fullscreen                       |
| H                | Hide / show controls             |
| ?                | Help                             |

Mouse/touch controls work too. Switching games during play asks before ending the round. Hiding the board's browser tab pauses play; operator-window focus alone does not pause it. Rehearse on the actual display before an event.

## Where to edit

| Change                                               | File                                             |
| ---------------------------------------------------- | ------------------------------------------------ |
| Hub wording and game links                           | `index.html`                                     |
| Hub appearance                                       | `assets/css/hub.css`                             |
| Difficulty presets and slider limits                 | `assets/js/config.js`                            |
| Per-game rules, artwork, and board text              | `assets/js/games/`                               |
| Shared cup/helmet tracking and shuffle logic         | `assets/js/games/shell.js`                       |
| Common board header, footer, colors used by drawings | `assets/js/drawing.js` and `assets/js/config.js` |
| Operator controls and keyboard shortcuts             | `assets/js/controls.js`                          |
| Shared round lifecycle, settings persistence         | `assets/js/engine.js`                            |
| Canvas resizing and animation loop                   | `assets/js/boot.js`                              |
| Control panel styling                                | `assets/css/arena.css`                           |
| Original logos and hub previews                      | `assets/images/`                                 |
| Help instructions and script loading order           | Each game HTML page                              |

Edit the desired file in GitHub with the pencil button, then commit the change. Start with a branch and pull request for larger changes. No compile or bundle command is needed. Scripts use ordered `defer` loading and shared globals so local `file://` playback remains available; keep `boot.js` last. Each page loads only its own game implementation, plus the shared files.

Settings already saved by a browser override new default presets until the operator chooses a preset again. To see changed defaults, reselect Varsity or clear the site's `raider-arena-v2` localStorage entry.

## Verification

The initial refactor passed `tests/logic.cjs`, which runs the actual game scripts in a simulated DOM with a native canvas renderer. It verifies all six presets, startup, pause, ball tracking, race completion, memory wins/timeouts, saved preferences, popup control wiring, and relative links. The rendered boards were also inspected. Full browser checks were prepared but could not run in the authoring environment because browser startup was restricted; fullscreen, popup behavior, and responsive layout still need an actual-browser check.

```sh
npm install --no-save jsdom @napi-rs/canvas
node tests/logic.cjs
```

A browser smoke test covers all four games and six presets, shuffle tracking, race completion, memory expiry and successful matching, pause behavior, saved settings, operator popups, links, and narrow layouts.

```sh
npm install --no-save playwright
npx playwright install chromium
# Start the static server in a separate terminal, then:
node tests/smoke.cjs
```

Set `BASE_URL` to test a different host or repository subpath. The test harness is only exposed when a game is loaded with `?test`. Normal audience pages do not expose it.

To refresh hub previews after visual changes, run the test with `CAPTURE_PREVIEWS=1`. This flag writes previews in `assets/images/`. There are no production npm dependencies.
