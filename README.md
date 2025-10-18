## Local development

The development stack proxies through [Caddy](https://caddyserver.com) so we can exercise HTTPS and custom headers locally. The `npm run dev` script starts both **Next.js** *and* **Caddy**, so make sure the prerequisites below are in place before you run it.

### 1. Install dependencies

- Node.js **20+**
- npm (bundled with Node) – run `npm install` in the project root.
- Prisma CLI: `npx prisma generate` if the client is missing.

### 2. Provide the Caddy bundle

The script expects the following files under `./caddy/`:

| File | Purpose |
| ---- | ------- |
| `caddy` (macOS/Linux) or `caddy_windows_amd64.exe` (Windows) | Caddy server executable |
| `caddyfile` | Local proxy/headers configuration |
| `*.pem` | TLS certificate + private key used by Caddy |

We commit the Windows binary and self-signed `myapp.local` certificates to the repo. If you are on macOS or Linux you need to:

1. Download a Caddy release for your platform from [caddyserver.com/download](https://caddyserver.com/download).
2. Place the binary in `caddy/` and rename it to `caddy` (make it executable with `chmod +x caddy`).
3. Either reuse the bundled certificate pair or generate your own (run `npm run dev:next` once and follow Caddy’s instructions, or replace `myapp.local*.pem` with your cert/key).
4. Trust the certificate in your OS keychain so the browser accepts the HTTPS connection.

The script will exit with a helpful error if any of these files are missing.

### 3. Start the dev stack

```bash
npm run dev
```

- Caddy listens on the domains configured in `caddy/caddyfile` and proxies traffic to the Next.js dev server on port 3000.
- Next.js runs with Turbopack for faster rebuilds and has telemetry disabled.

If you only need the plain Next.js server (i.e. you do not care about TLS or do not have Caddy installed yet) you can run:

```bash
npm run dev:next
```

> **Heads-up:** the fallback command skips Caddy-specific behaviour (HSTS headers, local HTTPS, host rewrites). Features that rely on those headers may not behave exactly like production.

### 4. Useful environment variables

- Copy `.env.example` to `.env.local` and adjust secrets (Fortnox credentials, Pusher keys, etc.) before starting the dev server.
- Set `NEXTAUTH_URL=https://your-local-domain` to match the Caddy hostname you are using.

---

### Troubleshooting

- **`Could not find Caddy executable`**: you are missing the platform-specific binary in `./caddy/`. Follow the install steps above.
- **TLS errors in the browser**: make sure the certificate (`myapp.local.pem`) is trusted by your operating system and that your hosts file routes the test domain to `127.0.0.1`.
- **Ports already in use**: stop any existing Caddy/Next.js processes or adjust the `caddyfile` and `package.json` script if you want to run on different ports.

For production deployment we currently follow the standard Next.js build (`npm run build`) and serve via `next start` behind the infrastructure TLS proxy. Refer to the internal operations runbook for the exact steps.
