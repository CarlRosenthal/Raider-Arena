# Cloudflare hosting and remote operation

This is an optional deployment path. Merging this PR does not deploy a Worker, change the live GitHub Pages site, or require Cloudflare credentials in GitHub.

## What runs where

- **Cloudflare Worker:** serves all site files only after password authentication; handles login and pairing endpoints.
- **Durable Objects:** keep login throttling/revocation consistent and relay WebSocket messages between one display and one phone. SQLite-backed namespaces are provisioned by Wrangler's migration.
- **Desktop browser:** runs the existing game engine, animations, random outcomes and audio. The phone receives control/status information, not a video stream or hidden answers.
- **Phone browser:** signs in, pairs once, and sends operator commands. Devices can use different networks, but both need Internet access to the same Worker address.

## First deployment

1. Install Node.js 22 or newer and run `npm ci` in the repository.
2. Sign in to your Cloudflare account using `npx wrangler login`.
3. Review the Worker name in `wrangler.jsonc`. Choose another name before deploying if you already have a Worker called `raider-arena`.
4. Create the required secrets interactively:

   ```sh
   npx wrangler secret put SITE_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```

   Choose a unique site password of 12–256 characters. Generate an independent random signing secret of at least 32 characters, for example with `openssl rand -hex 32`. Keep both secrets in Cloudflare/password-manager storage, never in source files, the browser bundle, a GitHub issue, or this document. If Wrangler offers to create the new Worker while setting secrets, use the configured name.
5. Run `npm run check:deploy`, then `npm run deploy`.
6. Open the HTTPS `workers.dev` address printed by Wrangler. Verify an incognito window sees the login form, including when opening a game or asset URL directly.
7. Optionally add a custom domain in Cloudflare's Worker settings. Both devices must use the **same origin**. No cross-origin API configuration is needed.

`npm run build` copies only the game pages, operator page, and `assets/` to `dist/`. Repository files, tests, `.dev.vars`, and Worker source are excluded. Wrangler runs this build automatically through `build.command`, including when Cloudflare invokes `npx wrangler deploy` or `npx wrangler preview` directly on a fresh checkout. `run_worker_first: true` is required: changing it can bypass authentication for static assets. HTTPS and the secure session cookie are required in production.

## Cloudflare Git builds and pull-request previews

In the Worker's **Settings → Builds**, use the repository root and these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | Leave empty; Wrangler runs `npm run build` automatically |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

An existing build command of `npm run build` also works, but runs the asset copy twice. The equivalent local commands are `npm run deploy` and `npm run preview`. Preview support requires Wrangler 4.135.0 or later; the repository pins a supported version. Keep the preview command for PR builds so they deploy to an isolated Preview.

The `previews` block in `wrangler.jsonc` explicitly provides `ROOMS` and `AUTH`, because production bindings are not inherited. Cloudflare creates separate Durable Object namespaces and storage for each Preview. Assets, compatibility settings, and class migrations remain at the top level.

**Preview secrets are separate from production secrets.** Before creating the first Preview, set these interactively from the repository with Wrangler signed in:

```sh
npx wrangler preview base-config secret put SITE_PASSWORD
npx wrangler preview base-config secret put SESSION_SECRET
```

Use a test password of 12–256 characters and a separate random signing secret of at least 32 characters. New Previews receive these Base secrets when created. To configure a Preview that already exists, set both on that Preview instead (Base changes do not update existing Previews):

```sh
npx wrangler preview secret put SITE_PASSWORD --name feature/cloudflare-remote-operator
npx wrangler preview secret put SESSION_SECRET --name feature/cloudflare-remote-operator
```

These are runtime secrets, not plaintext build variables. Production still needs its own `SITE_PASSWORD` and `SESSION_SECRET` configured through the First deployment steps. A build can succeed without secrets, but the site deliberately returns a configuration error until both are present and valid.

If a PR build fails, inspect the log after `Executing user deploy command`. A missing `previews` block prevents preview deployment; a missing `dist/` directory means the asset build did not run. Both are configured in this repository. The `allow-scripts` lines during dependency installation are warnings and are not themselves a fatal error. If the log later reports a missing native binary, inspect that separate error before changing script approvals.

Review your account's current Workers/Durable Objects limits and usage before regular events; connections, messages and authentication checks consume Cloudflare resources. No deployment credentials or account ID are committed in this PR.

## Pair a video-board desktop with a phone

1. Sign in on the desktop and open the desired game.
2. Click **Connect phone**, then **New pairing code**. That desktop gesture also enables audio. Keep the displayed tab visible.
3. On the phone, open the operator URL shown in the dialog and sign in with the same site password. Enter the eight-character code.
4. Close the pairing dialog on the desktop. Enter fullscreen there and hide controls if desired. Browser security requires fullscreen and initial audio activation on the desktop, so those steps cannot be triggered solely by the phone.
5. On the phone, use Start/Reveal/Next round, Pause/Resume, Reset, choices/cards, game selection, sound, and Tuning. Reset and game switching ask on the phone before ending an active round. Tuning applies between rounds, just like local controls.
6. Use **End remote session** on the desktop to revoke the room. A new code also ends the previous room. **Disconnect this phone** forgets that phone's token; generate a new code to pair it again.

Codes expire after 10 minutes and accept one phone only. Connected rooms last until the earliest participant's eight-hour sign-in expiry. Reconnecting an already paired phone uses its private token; the code cannot be reused by another phone. Session and room tokens are never placed in URLs. Treat a displayed, unused pairing code as access to that board for anyone who already knows the site password.

A transport interruption or phone disconnect pauses active play when detected (normally immediately; silent network failures can take about 15–30 seconds). Controls disable while disconnected or awaiting an acknowledgement. No command queue is replayed on reconnection. Check the board before retrying an unacknowledged action. The desktop remains authoritative, so local controls always work. After reconnecting, explicitly Resume; the phone does not auto-start a paused game.

Game switching preserves pairing in the desktop tab. Reloading a game resets that game to Ready; it does not restore an in-progress round. The phone can reload and reconnect while its tab-scoped session token remains. Closing a tab, clearing browser data, signing out, expiry, or using a different browser requires pairing again. Opening another operator connection using the same credentials replaces the earlier one. Keep one display tab per remote session.

## Password and session behavior

Authentication is enforced by the server for HTML, scripts, images, APIs, and WebSocket upgrades. Signed cookies are HttpOnly, Secure, SameSite=Strict, and expire after eight hours. Requests that mutate state and WebSocket upgrades require the same Origin. Login is limited to 10 attempts per minute per hashed client IP; room creation and join attempts are limited per signed-in session. WebSocket messages are bounded and role checked. These limits are abuse controls, not a guarantee against distributed attacks; Cloudflare Access/WAF can be layered on for more restrictive future deployments.

Sign out on the operator page revokes that browser's login immediately for HTTP requests and on the next socket message/heartbeat for an open socket. The display pauses when the phone's socket closes. Tokens stay in sessionStorage only for reconnection, bound to the matching signed-in browser session. They are not a replacement for login. Logout does not change the shared site password for other users.

To revoke all existing sign-ins, rotate **SESSION_SECRET**, then redeploy. To change the shared password, update **SITE_PASSWORD**; rotate SESSION_SECRET too if existing sign-ins should be invalidated. Existing sockets check the signing-secret version as well as revocation and expiry on every message, including the heartbeat, and close after rotation reaches the running Worker. There are no user accounts, password reset emails, or per-person permissions in this version.

## GitHub Pages and offline copies

**The existing GitHub Pages URL is still public.** A Worker cannot password-protect a separate `github.io` origin. Once the Cloudflare site is verified and you want to require login for online use, unpublish GitHub Pages in repository **Settings → Pages**, and update shared links to Cloudflare. This PR deliberately does not change your live site or repository visibility.

The public repository also lets anyone download an offline copy. Password protection controls the hosted service and remote relay, not access to publicly available source. Local/offline games and the same-computer operator popup remain supported; phone pairing is only available through the Worker.

## Development and checks

Create an ignored `.dev.vars` file containing `SITE_PASSWORD` and `SESSION_SECRET` with throwaway local values. Then run `npm run dev`. Use the printed localhost URL. Secure cookies work on localhost in supported browsers; do not use a plain HTTP LAN address to test login from a phone. Use an HTTPS test deployment for physical two-device rehearsal.

```sh
npm ci
npm test
npm run check:deploy
npx playwright install chromium
npm run test:remote
```

The remote test starts its own local Worker runtime and uses isolated desktop and mobile browser contexts. It uses test-only secrets, never production credentials. `CHROMIUM_EXECUTABLE` can select an already installed Chromium binary. The existing static-site browser suite remains available with `BASE_URL=http://localhost:8000 node tests/smoke.cjs` after starting a static server.

Rehearse the final HTTPS deployment with the real desktop, video board, and phone before an event. Verify audio, fullscreen, network interruption/recovery, and battery/screen-sleep behavior. Keep local controls available as a fallback.

## Cloudflare reference

- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/wrangler/custom-builds/
- https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
