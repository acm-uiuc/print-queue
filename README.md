# ACM@UIUC Print Queue

Astro handles authenticated PDF submission and the device WebSocket route.
A second Worker owns the Queue consumer and per-printer Durable Objects. D1 is
the job ledger, R2 stores PDFs, and `printerd` is the outbound-only Raspberry Pi
agent.

The checked-in Wrangler files contain fake resource identifiers. Replace them
before deployment; nothing in this repository has been deployed.

## Local setup

Requires Bun and the `capnp` schema compiler on the development machine.

```bash
cp .dev.vars.example worker/.dev.vars
cd worker
bun install
bun run generate:protocol
bun run check
bun run test
bun run build
```

Fill in `worker/.dev.vars`. Configure an Entra API scope for print
submission; the browser access token's audience must match
`AAD_API_AUDIENCE`. Apply `worker/migrations/0001_print_jobs.sql` to the D1
database before accepting submissions.

Cloudflare resources represented by fake bindings:

- `PRINT_DB`: D1 job ledger;
- `DOCUMENTS`: private R2 bucket;
- `PRINT_QUEUE`: Queue producer/consumer;
- `PRINTERS`: cross-Worker Durable Object namespace.

The dispatch Worker additionally needs `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`,
`R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` as secrets so it can mint
short-lived, object-specific R2 GET URLs. These credentials never go on the Pi.

## Device mTLS

1. Create a proxied device hostname such as `print-device.example.com` for the
   Astro Worker. The Pi connects only to
   `wss://print-device.example.com/socket`.
2. In Cloudflare **SSL/TLS → Client Certificates**, create a distinct client
   certificate for each Pi, or upload a CA and issue one certificate per Pi.
   Save each private key once; Cloudflare does not need the private key.
3. Require a valid certificate at the edge. A WAF custom rule for the dedicated
   hostname can use:

   ```text
   (http.host eq "print-device.example.com" and not cf.tls_client_auth.cert_verified)
   ```

   Set the rule action to **Block**. Keep the Worker check as defense in depth:
   `/socket` also requires `certVerified = SUCCESS`.
4. Obtain the SHA-256 fingerprint for the certificate:

   ```bash
   openssl x509 -in device.crt -noout -fingerprint -sha256
   ```

5. Map that fingerprint to a printer ID in the Astro Worker setting. Colons and
   letter case are ignored:

   ```text
   DEVICE_CERTIFICATES={"AA11...FF":"office-main"}
   ```

   Unknown fingerprints receive `401` and are never routed to a Durable Object.
6. Install the identity on the Pi. The service runs unprivileged, so the key is
   root-owned and readable only by the service group:

   ```bash
   sudo useradd --system --user-group --home-dir /var/lib/print-agent \
     --shell /usr/sbin/nologin print-agent
   sudo usermod -a -G lp print-agent
   sudo install -d -o root -g print-agent -m 0750 /etc/print-agent
   sudo install -o root -g print-agent -m 0644 device.crt /etc/print-agent/device.crt
   sudo install -o root -g print-agent -m 0640 device.key /etc/print-agent/device.key
   ```

7. Confirm the certificate and key contain the same public key:

   ```bash
   openssl x509 -in /etc/print-agent/device.crt -pubkey -noout \
     | openssl pkey -pubin -outform DER | sha256sum
   openssl pkey -in /etc/print-agent/device.key -pubout -outform DER \
     | sha256sum
   ```

   The two hashes must match.
8. Install `printerd/config.toml.example` as
   `/etc/print-agent/config.toml`, set the device hostname and local CUPS
   printer URI, then install `printerd/print-agent.service`. Enable only this
   service; do not install `cloudflared`, an MQTT broker, or an inbound listener.
9. A certificate accepted and mapped by the Worker reaches the WebSocket check:

   ```bash
   curl --cert /etc/print-agent/device.crt \
     --key /etc/print-agent/device.key \
     -i https://print-device.example.com/socket
   ```

   A plain HTTP request returns `426 WebSocket upgrade required`. A missing,
   invalid, or unmapped certificate must instead be blocked or return `401`.

Revoke a lost device certificate at Cloudflare and remove its fingerprint from
`DEVICE_CERTIFICATES`. Never reuse one certificate across printers.

## Pi build and install

The agent uses a single-thread Tokio runtime, streams PDFs to disk, speaks IPP
to local CUPS through the pure-Rust `ipp` crate, and stores atomic per-job
markers under `/var/lib/print-agent/jobs`.

Cross-compile on a development machine rather than on the Pi when practical:

```bash
rustup target add arm-unknown-linux-gnueabihf
RUSTFLAGS="-C target-cpu=arm1176jzf-s" \
  cargo build --manifest-path printerd/Cargo.toml \
  --target arm-unknown-linux-gnueabihf --profile release
```

Install the resulting binary as `/usr/local/bin/print-agent`. The Pi needs only
the device certificate/key and outbound HTTPS/WSS access. It must not receive
R2 keys, Queue credentials, Cloudflare account tokens, or a shared bearer
secret.

`completed` currently means that local CUPS accepted the IPP job. The durable
local `submitted` marker prevents a reconnect or reboot from blindly submitting
the same immutable job ID twice.
