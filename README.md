# DeviceLens

A lightweight Java 21 / Spring Boot 3.5.16 utility with a responsive, dependency-free browser UI. Device detection starts locally on load. Only clicking **Continue & Share Device Info** sends a report to the backend, which submits an email through Brevo's HTTPS API.

## Run locally

Install Java 21. On Windows run `./mvnw.cmd verify`; on Linux/macOS run `./mvnw verify`.

Set these environment variables in your shell or IDE run configuration (never commit their values):

| Variable | Purpose |
| --- | --- |
| `BREVO_API_KEY` | Brevo transactional API key, not an SMTP password |
| `REPORT_EMAIL_FROM` | Sender verified in your Brevo account |
| `REPORT_EMAIL_TO` | Administrator recipient |
| `PORT` | HTTP port; defaults to 8080 |
| `PUBLIC_ORIGIN` | Optional exact origin, e.g. `http://localhost:8080` |

The `.env.example` is a template. Spring does not automatically load `.env`; configure real environment variables. Start with `./mvnw.cmd spring-boot:run` or `java -jar target/DeviceLens-1.0.0.jar`, then open <http://localhost:8080>. Local preview works without email settings; sharing returns a safe 503 until configured.

## Verification

```sh
./mvnw verify
node --test frontend-tests/*.test.mjs
docker build -t devicelens:local .
docker run --rm --name devicelens -p 8080:8080 --memory=512m --env-file .env devicelens:local
```

Node 22+ is needed only for frontend tests, not for the deployed application. The Docker builder runs Java tests under Java 21. GitHub Actions runs Java tests, frontend tests and the image build.

## Render Free deployment

1. Push this repository to GitHub, with `main` as its default branch.
2. In Render, connect the GitHub repository. Use a **Blueprint** with `render.yaml`, or create a **Web Service**, choose **Docker**, repository root, `./Dockerfile`, and explicitly select **Free**. Do not choose a paid plan or add paid resources.
3. Enter `BREVO_API_KEY`, `REPORT_EMAIL_TO`, and `REPORT_EMAIL_FROM` in Render's environment settings. The sender must already be verified in Brevo. Never enter secrets in GitHub source or frontend files.
4. Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The latter is used as the allowed browser origin. Set the health check to `/actuator/health`.
5. Deploy and use the actual HTTPS `onrender.com` URL shown by Render. Verify `/actuator/health` returns `{"status":"UP"}`, then use the page button once.
6. Confirm the page reports provider acceptance, inspect Brevo transactional logs, and confirm the email arrived at `REPORT_EMAIL_TO`. API acceptance alone does not prove inbox delivery. Check spam and sender/domain authentication if delivery fails.

Free hosting can sleep after inactivity and take time to wake up. The UI allows 90 seconds and explains the wait. No periodic keep-alive traffic is created. The app makes one email API request per new accepted attempt, with a 3-second connect timeout and an 8-second overall timeout.

Official references: [Render Free](https://render.com/docs/free), [Blueprint configuration](https://render.com/docs/blueprint-spec), [Brevo transactional email API](https://developers.brevo.com/reference/send-transac-email), [Client Hints](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues).

## API and architecture

`GET /` serves the static landing page; `GET /actuator/health` checks application liveness. Health does not send email or certify email credentials. `POST /api/device-info` takes JSON:

```json
{
  "submissionId": "a791881a-f161-4b5a-8bfa-aa9e6a26a121",
  "consent": true,
  "deviceCategory": "desktop",
  "manufacturer": "Unavailable",
  "model": "Unavailable",
  "modelNumber": "Unavailable",
  "operatingSystem": "Windows",
  "osVersion": "11",
  "browser": "Google Chrome",
  "browserVersion": "140.0.1.2",
  "screenResolution": "1920 × 1080 CSS px",
  "pixelRatio": "1",
  "deviceMemory": "~8 GB",
  "processorCount": "8"
}
```

`submissionId` is a random per-attempt UUID held only in page memory; it is not a persistent visitor identity. `consent` must be true. Missing/blank specifications become `Unavailable`; supplied strings are limited to 120 characters. Unknown fields, including unwanted identifiers, are rejected. The complete body is limited to 8 KiB, including chunked bodies. Successful responses contain `success: true, status: "accepted"`; errors use RFC 9457 Problem Details without provider bodies or stack traces.

HTTP controller → DeviceReportService → EmailService → Brevo. EmailConfig owns the reused JDK HTTP client and private settings. GlobalExceptionHandler handles safe API errors. RequestProtectionFilter adds security headers, same-origin checks, a request budget and actual-body size enforcement.

## Privacy, detection and operational limits

- No database, tracking cookies, local storage, geolocation, authentication, or third-party frontend assets. No device report is logged or retained by the application after processing. Email reports are retained by Brevo and the administrator's mailbox under their own retention settings.
- A server necessarily receives connection metadata and ordinary browser headers while serving a page. Detection results are not POSTed before consent. Render and upstream providers may keep infrastructure logs; application access logging is disabled and the app does not store IP addresses.
- Client Hints are browser-dependent. Model family/name and model number are different: recognizable Samsung model codes are preserved; unexposed retail names and Apple generation numbers are never guessed. Category is a heuristic. Memory is approximate; screen resolution is measured in CSS pixels. Browser UA values can be reduced or spoofed and should not be treated as verified hardware specifications.
- Global email limits: **6/minute, 60/hour, 200/day**; incoming report attempts: **120/minute**. No IP-based tracking. These conservative shared budgets can temporarily limit all visitors during abuse.
- Duplicate outcomes and SHA-256 report digests are kept in a bounded in-memory cache for **one hour**, with expired entries pruned on subsequent submissions. Full reports are not cached. Concurrent duplicate submissions return 409; completed duplicates reuse the result. Provider failures/ambiguous timeouts are not automatically resent, avoiding accidental double emails.
- This design targets **one instance**. Restarting or sleeping clears rate limits and duplicate protection. Exact-once delivery across restarts is not guaranteed without durable state, which this project's constraints exclude. A retry more than one hour later can send again. Fixed windows can allow bursts across boundaries.
- Consent is enforced in the supplied UI and validated in JSON; an anonymous API cannot prove that an arbitrary external caller genuinely obtained human consent. Origin checks and budgets reduce misuse, but cannot eliminate determined bot traffic without an additional challenge system.
- Security headers include a restrictive CSP, frame denial, MIME sniffing protection, no referrer, disabled sensitive permissions and HSTS for the public HTTPS origin. No `Accept-CH` requests are emitted. Secrets remain on the backend.
- Render terminates TLS. Forwarded headers are enabled for that trusted edge; if deploying elsewhere, restrict proxy headers at the ingress. Keep the origin setting correct when adding custom domains.

## Deployment status

Verified on 2026-10-12: 30 Java tests and 12 frontend tests pass. The multi-stage Docker image builds and its Java 21 test gate passes. A non-root container started with `PORT=10000` under a 512 MiB limit; health and landing endpoints returned HTTP 200. Idle memory measured about 204 MiB (not a load benchmark). Desktop and narrow mobile layouts were inspected; the mobile layout has no horizontal overflow. GitHub Actions passed for the initial application commit.

Repository: <https://github.com/JardaniJovonovich6/DeviceLens>. Live Render deployment and inbox delivery still require the account setup and provider configuration described above; they are not marked verified here.
