# DeviceLens — Browser Privacy Inspector

See the browser-visible information a website can read, understand its limits, and review practical privacy choices. Detection and analysis run locally. The Spring Boot server serves static files and a health endpoint; it does not receive inspection results.

Live application: <https://devicelens-xcjh.onrender.com>.

## Features

- 38 explained signals in five groups: device/hardware, browser/privacy preferences, display/input, language/timezone, and connection estimates.
- User-Agent Client Hints with bounded asynchronous collection and graceful fallback. Exact model names are left unavailable when not exposed; recognizable model codes are not converted into guessed retail names.
- Six permission-state queries: location, camera, microphone, notifications, clipboard read and persistent storage. Queries never request the underlying permission or access sensitive data. Denied can reflect page policy as well as browser settings.
- Available/unavailable filters, a raw User-Agent viewer and repeatable local inspection.
- Copy a plain-text report (with a manual-copy dialog fallback) or download JSON locally. No upload, email or administrator collection.
- An interactive educational signal-group simulation and a six-item privacy checklist. No uniqueness score, fingerprint identifier or persistence.
- Explanations of cookies, fingerprinting, public IP visibility, VPN/private-mode limits and unavailable hardware information.
- A white and black interface with a restrained olive accent, readable serif headings, and monospaced browser readings. Real observations appear near the top; sections use rules and spacing instead of decorative card grids.
- A clear explanation of why browser signals matter, six practical steps to reduce data exposure, and a public contact link to Aman Kumar Shaw at `ashaw8176@gmail.com`.
- Responsive layouts, keyboard-accessible controls, reduced-motion support, and zero external frontend dependencies.

## Privacy boundaries

The app does not use tracking cookies, local/session storage, geolocation requests, media capture, font/device enumeration, canvas/audio fingerprinting, IP lookup services, or third-party assets. No inspection result is sent to a server. Clipboard writes and downloads occur only when the visitor clicks the corresponding control.

The contact link opens the visitor's email client with a subject line. It does not send a message automatically or attach any inspection values. Visitors choose what to write. The six privacy steps cover permission reviews, tracking controls, phishing awareness, browser and extension maintenance, account protection, and selective report sharing; they reduce risk without promising that leaks are impossible.

Loading the page still sends ordinary HTTP requests and browser headers to the host; the host sees the connection's public IP. Application access logging is disabled, but Render or other infrastructure providers can keep their own logs. Exported reports contain personal browser information and should be shared carefully by their owner.

Browser-reported signals can be rounded, reduced or spoofed. Screen size uses CSS pixels. Memory and connection metrics are estimates. Device category and manufacturer can be inferred from exposed strings. No population dataset is used, so available-signal counts cannot establish uniqueness, anonymity or a privacy score. Permission states are specific to this origin and browser context.

## Run

Java 21, Maven wrapper; Node 22+ only for frontend tests.

```sh
./mvnw clean verify
node --test frontend-tests/*.test.mjs
java -jar target/DeviceLens-1.0.0.jar
```

On Windows use `./mvnw.cmd`. Open <http://localhost:8080>. Set `PORT` to change the port. No Brevo account, API key, email addresses or other secrets are needed. `.env.example` contains only an optional port; Spring does not automatically load `.env`.

## Docker

```sh
docker build -t devicelens:privacy .
docker run --rm --name devicelens -p 8080:8080 --memory=512m devicelens:privacy
```

The multi-stage builder runs Java tests with Java 21. The runtime uses a non-root user and bounded JVM memory settings. GitHub Actions runs Maven tests, frontend tests and Docker build.

## Server behavior

- `GET /`: inspector page.
- `GET /actuator/health`: liveness, no exposed configuration details.
- Same-origin static assets; `HEAD` supported.
- `/api/*`, including the former `/api/device-info`, returns 404. Other write methods return 405. There is no report DTO, collection controller, email client, recipient setting or database.
- CSP blocks JavaScript network connections (`connect-src 'none'`), third-party resources, embedding and forms. Permissions Policy blocks location, camera, microphone, USB, payment and sensors. Referrer Policy is `no-referrer`; HTTPS responses carry HSTS.
- Forwarded headers assume Render's trusted TLS-terminating edge. Restrict proxy headers at the ingress if hosting elsewhere.

## Render Free

1. Connect <https://github.com/JardaniJovonovich6/DeviceLens> to a Render **Web Service**, runtime **Docker**, branch `main`, repository root and `./Dockerfile`.
2. Choose **Free ($0/month)** and Singapore, or import `render.yaml` as a Blueprint.
3. Use `/actuator/health` as the health path. Render supplies `PORT` and `RENDER_EXTERNAL_URL` automatically.
4. Remove the obsolete `BREVO_API_KEY`, `REPORT_EMAIL_FROM`, and `REPORT_EMAIL_TO` rows if continuing from the earlier service creation form. This app requires none of them.
5. Deploy and check the actual HTTPS URL supplied by Render. Verify the title, health, local scan, report export and that the old API returns 404.

Free services can sleep and take time to wake up. Once the page and assets load, inspection has no backend round trips. No keep-alive requests are generated. Never claim an assigned URL is live until it has been checked.

## Documentation

[Web privacy](https://developer.mozilla.org/en-US/docs/Web/Privacy), [Client Hints](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues), [Permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [Global Privacy Control](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl), [Render Free](https://render.com/docs/free).

## Git workflow

Use a descriptive feature branch for each change, keep commits focused, and open a pull request to `main`. Describe the user-visible result and validation evidence. Review the diff and wait for the Java, frontend and Docker CI checks to pass before merging. Squash merge a completed feature to keep `main` readable, then remove its remote feature branch. Render deploys `main`; feature branches do not change the public service.

Before publishing, inspect staged, untracked and ignored files. Keep credentials, local exports, screenshots and build output out of commits. `.gitignore` excludes local configuration, `artifacts/` and `target/`. Use `git diff --check` to catch whitespace mistakes.

The visual revision draws on the supplied design guidance and [AxonBuild's article](https://axonbuild.com/blog/how-to-tell-if-an-app-was-vibe-coded/). The design prioritizes actual readings, specific explanations and working controls; appearance is not a claim about how the software was authored.
