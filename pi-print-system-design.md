# Raspberry Pi Print Delivery System — Final Design

## 1. Overview

Build a lightweight print-delivery system with:

- an existing OAuth-gated web application for job submission;
- Cloudflare R2 for document storage;
- Cloudflare D1 as the durable job ledger;
- Cloudflare Queues for asynchronous dispatch/wakeup;
- a Durable Object per printer/device for a long-lived WebSocket;
- per-device mTLS authentication;
- a single lightweight Rust daemon on a Raspberry Pi Zero 1.1;
- local CUPS for actual printing.

The Raspberry Pi:

- has **no public IP requirement**;
- has **no public hostname**;
- exposes **no inbound ports**;
- does **not** run `cloudflared`;
- does **not** poll Cloudflare Queues;
- does **not** hold an R2 API key, Queue token, or Cloudflare account token;
- maintains one outbound WebSocket connection to Cloudflare;
- downloads print documents using short-lived R2 presigned URLs.

The initial implementation intentionally has **no job API** and **no job-history UI**.

---

## 2. Core Design

```text
                              CLOUDFLARE

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   OAuth Web App / Submission Worker                         │
│          │                                                  │
│          ├──────────────▶ R2                                │
│          │                document.pdf                      │
│          │                                                  │
│          ├──────────────▶ D1                                │
│          │                authoritative job state           │
│          │                                                  │
│          └──────────────▶ Cloudflare Queue                  │
│                               │                             │
│                               ▼                             │
│                       Queue Consumer                        │
│                               │                             │
│                               │ poke(job_id)                │
│                               ▼                             │
│                    Printer Durable Object                   │
│                               │                             │
│                      WSS + per-device mTLS                  │
│                               │                             │
└───────────────────────────────┼─────────────────────────────┘
                                │
                                │ outbound only
                                ▼
                     ┌──────────────────────┐
                     │ Raspberry Pi Zero    │
                     │                      │
                     │ Rust print-agent     │
                     │ Tokio current-thread │
                     │        │             │
                     │        ▼             │
                     │       CUPS           │
                     └────────┬─────────────┘
                              │
                              ▼
                           Printer
```

### Responsibilities

**D1 is the durable source of truth.**

It stores each print job and its current lifecycle state.

**Cloudflare Queue is a dispatch mechanism.**

It causes Cloudflare to promptly notify the correct Durable Object when a new job exists. Correctness must not depend on a Queue message remaining available after the notification.

**Durable Object WebSocket is the real-time delivery channel.**

It delivers the actual job to an online Pi and receives status updates.

**R2 stores the document.**

The Pi receives only a short-lived presigned `GET` URL.

---

## 3. Important Invariants

The implementation must preserve these invariants.

### 3.1 D1 is authoritative

A print job is never considered durable merely because it exists in a Queue or WebSocket frame.

The job must exist in D1 first.

### 3.2 The WebSocket is disposable

Losing a WebSocket frame must never lose a print job.

On every Pi reconnect, the Durable Object reconciles against D1 and resumes any non-terminal job.

### 3.3 Queue notification is not job ownership

The Queue message only tells the system that work exists.

The Durable Object selects the correct pending job from D1.

### 3.4 Device identity comes from mTLS

Do not accept a client-provided `printer_id` as authorization.

The Worker derives the device/printer identity from the verified client certificate.

### 3.5 The Pi never receives general Cloudflare credentials

The Pi must not contain:

- R2 API credentials;
- Cloudflare Queue credentials;
- Cloudflare account API tokens;
- a shared application bearer secret.

### 3.6 One physical printer processes one job at a time

A printer may have multiple `queued` jobs, but only one job may be in an active `dispatched` or `printing` state at once.

### 3.7 Every job has an immutable unique ID

Use UUIDv7, ULID, or another globally unique sortable identifier.

---

## 4. Submission Flow

The existing web application remains responsible for authenticated submission.

```text
user uploads document
        │
        ▼
authenticate user
        │
        ▼
normalize / validate final printable PDF
        │
        ├── determine page count
        └── determine final document byte size
        │
        ▼
upload PDF to R2
        │
        ▼
insert D1 row: status = queued
        │
        ▼
enqueue QueueJob(job_id, printer_id)
        │
        ▼
return submission success
```

The order matters.

The D1 row must exist before the Queue notification is created.

If R2 upload succeeds but D1 insertion fails, remove the orphaned R2 object if practical.

If D1 insertion succeeds but Queue submission fails, mark the job `failed` with an internal dispatch error rather than silently losing it.

---

## 5. Printable Document

The system should operate on a final printable PDF.

The recorded:

- `page_count`
- `document_bytes`

must describe the exact object stored in R2 and eventually sent to the Pi.

For example:

```text
R2 key:
print-jobs/019a.../document.pdf
```

If the application accepts non-PDF inputs, conversion to the final PDF occurs before these metadata values are finalized.

---

## 6. D1 Job Ledger

D1 stores all jobs from the last seven days.

The user identity representation is intentionally opaque and implementation-specific.

### 6.1 Schema

```sql
CREATE TABLE print_jobs (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,
    printer_id TEXT NOT NULL,

    r2_object_key TEXT NOT NULL,

    page_count INTEGER NOT NULL CHECK (page_count >= 1),
    document_bytes INTEGER NOT NULL CHECK (document_bytes >= 0),

    options_json TEXT NOT NULL,

    status TEXT NOT NULL CHECK (
        status IN (
            'queued',
            'dispatched',
            'printing',
            'completed',
            'failed'
        )
    ),

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    completed_at INTEGER,
    failed_at INTEGER,

    failure_code TEXT,
    failure_message TEXT
);
```

Use Unix timestamps in milliseconds.

`options_json` contains the print options needed to reconstruct the device job, for example:

```json
{
  "copies": 2,
  "duplex": "long-edge",
  "color": false,
  "media": "letter"
}
```

### 6.2 Indexes

```sql
CREATE INDEX idx_print_jobs_created_at
ON print_jobs(created_at DESC);

CREATE INDEX idx_print_jobs_user_created
ON print_jobs(user_id, created_at DESC);

CREATE INDEX idx_print_jobs_printer_status_created
ON print_jobs(printer_id, status, created_at ASC);
```

The third index supports the Durable Object's main dispatch query.

### 6.3 Job states

```text
queued
  │
  ▼
dispatched
  │
  ▼
printing
  │
  ├────────────▶ completed
  │
  └────────────▶ failed
```

Definitions:

- `queued`: durable in D1 and awaiting delivery;
- `dispatched`: sent to the Pi over the WebSocket but not yet durably accepted by the Pi;
- `printing`: Pi has durably accepted responsibility for the job and is processing/submitting it to CUPS;
- `completed`: terminal success;
- `failed`: terminal failure.

`completed` and `failed` are terminal.

---

## 7. Cloudflare Queue

Use a push consumer Worker.

The Pi does **not** consume the Queue directly.

External Queue pull consumers use short polling, which is specifically what this design avoids.

### 7.1 Queue payload

Use a small Cap'n Proto message.

```capnp
@0xe9b1b8f3c92a1d47;

struct QueueJob {
  jobId     @0 :Text;
  printerId @1 :Text;
}
```

The Queue does not need:

- the PDF;
- the user identity;
- page count;
- document size;
- the R2 object key;
- the presigned URL;
- complete print options.

Those are already durable in D1.

### 7.2 Queue consumer behavior

Conceptually:

```ts
async queue(batch, env) {
    for (const message of batch.messages) {
        const job = decodeQueueJob(message.body);

        const printer = env.PRINTERS.getByName(job.printerId);

        try {
            await printer.notifyJob(job.jobId);
            message.ack();
        } catch {
            message.retry();
        }
    }
}
```

`notifyJob()` does not imply that the Pi received the job.

It only asks the Durable Object to reconcile/dispatch.

If the Pi is offline, the Durable Object may safely return success because D1 still contains the queued job and reconnect reconciliation will deliver it later.

---

## 8. Durable Object

Use one Durable Object identity per printer.

Examples:

```text
printer:office-main
printer:front-desk
printer:lab-01
```

The Durable Object is responsible for serial device dispatch.

### 8.1 WebSocket hibernation

Use the Durable Object WebSocket Hibernation API.

The Pi remains connected while the Durable Object can hibernate when idle.

Avoid timers such as frequent `setInterval()` calls that unnecessarily keep the Durable Object active.

### 8.2 One connection per printer

For the initial implementation, allow one active Pi WebSocket per printer.

When a new authenticated connection replaces an old one:

1. close the old socket;
2. accept the new socket;
3. immediately run reconciliation.

### 8.3 Dispatch algorithm

When:

- a Queue notification arrives;
- a Pi connects/reconnects;
- a Pi reports a terminal job state;

run `dispatchNext()`.

Normal dispatch:

```text
Does this printer already have a printing/dispatched job?
        │
        ├── yes → do nothing
        │
        └── no
             │
             ▼
       find oldest queued job
             │
             ▼
       mint presigned R2 GET URL
             │
             ▼
       mark D1 status = dispatched
             │
             ▼
       send PrintJob over WebSocket
```

Query shape:

```sql
SELECT *
FROM print_jobs
WHERE printer_id = ?
  AND status = 'queued'
ORDER BY created_at ASC
LIMIT 1;
```

Before selecting a new job, ensure no row for that printer is already `dispatched` or `printing`.

### 8.4 Reconnect reconciliation

On a new Pi connection:

1. look for a job in `dispatched` or `printing`;
2. if one exists, resend that same immutable `job_id`;
3. otherwise dispatch the oldest `queued` job.

The Pi's local state prevents physical duplicate printing.

---

## 9. R2 Download Authorization

The Pi does not receive an R2 object key as a capability and does not receive R2 credentials.

The Worker/Durable Object uses the existing server-side R2 presigning implementation.

### 9.1 Mint at delivery time

Do not depend on a presigned URL created at original submission time.

A Pi can remain offline longer than a presigned URL remains valid.

Instead:

```text
D1:
    r2_object_key
         │
         ▼
Durable Object dispatch
         │
         ▼
server-side presigner
         │
         ▼
fresh short-lived GET URL
         │
         ▼
Pi
```

This preserves the desired security property:

> The Pi can read exactly the object referenced by the temporary URL without possessing a long-lived R2 key.

A 15-60 minute expiration is reasonable for the initial implementation.

If a URL somehow expires during a job attempt, the device can reconnect and receive the same job with a freshly signed URL; no separate job HTTP API is required.

---

## 10. Device WebSocket Endpoint

Use a dedicated Cloudflare-proxied device hostname, for example:

```text
wss://print-device.example.com/socket
```

The Pi itself does not need a hostname.

### 10.1 mTLS

Require a client certificate on this hostname.

Each Pi receives its own:

```text
device.crt
device.key
```

The private key remains local to that Pi.

Cloudflare verifies the client certificate and exposes the verified certificate information to the Worker through `request.cf.tlsClientAuth`.

### 10.2 Device mapping

The Worker maps a certificate attribute such as:

- certificate serial number; or
- certificate fingerprint;

to a printer/device ID.

For a single Pi, this mapping can initially be configuration rather than another database table.

Do not route based on a device ID supplied by the request.

Preferred route:

```text
GET /socket
```

Then:

```text
verified certificate
        │
        ▼
known printer_id
        │
        ▼
Durable Object for that printer
```

### 10.3 Pi credential storage

Store the certificate and private key under:

```text
/etc/print-agent/device.crt
/etc/print-agent/device.key
```

with restrictive permissions.

For example:

```text
root:root
0600 device.key
```

mTLS avoids a shared application secret, but software-only authentication still requires the Pi to possess private key material.

If physical extraction of that key later becomes part of the threat model, use a secure element or similar non-exportable key store.

---

## 11. Device Protocol

Use binary WebSocket frames containing Cap'n Proto messages.

WebSocket native ping/pong frames should handle connection-level keepalive; do not invent an application ping protocol unless necessary.

Example schema:

```capnp
@0xd591d3f7eea62e31;

struct PrintOptions {
  copies @0 :UInt16;

  duplex @1 :Duplex;
  color  @2 :Bool;
  media  @3 :Text;

  enum Duplex {
    none      @0;
    longEdge  @1;
    shortEdge @2;
  }
}

struct PrintJob {
  jobId          @0 :Text;
  downloadUrl    @1 :Text;
  expiresAtMs    @2 :UInt64;
  pageCount      @3 :UInt32;
  documentBytes  @4 :UInt64;
  options        @5 :PrintOptions;
}

struct JobStatus {
  jobId          @0 :Text;
  state          @1 :State;
  failureCode    @2 :Text;
  failureMessage @3 :Text;

  enum State {
    printing  @0;
    completed @1;
    failed    @2;
  }
}

struct Envelope {
  union {
    printJob  @0 :PrintJob;
    jobStatus @1 :JobStatus;
  }
}
```

The Pi does not need the submitting user's identity.

---

## 12. Pi Agent

Target:

```text
Raspberry Pi Zero 1.1
```

Optimize for:

- one small process;
- one Tokio runtime thread;
- no polling;
- low idle CPU;
- low memory usage;
- no `cloudflared`;
- no MQTT daemon.

### 12.1 Runtime

Use Tokio's current-thread runtime.

```rust
#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    // ...
}
```

This is appropriate because the daemon has concurrent I/O but only one CPU core is available.

Typical concurrent activity:

```text
WebSocket read
R2 HTTPS download
CUPS subprocess wait
status write over WebSocket
reconnect timer
```

When each task is waiting on I/O, Tokio can advance the others on the same OS thread.

### 12.2 Suggested crates

Use only the features required by the implementation.

Likely dependencies:

```text
tokio
tokio-tungstenite
tokio-rustls
rustls
rustls-pemfile
reqwest with rustls TLS
capnp
anyhow or thiserror
```

If a local SQLite ledger is desired later, use `rusqlite`.

For the initial low-resource implementation, filesystem job markers are sufficient.

---

## 13. Pi Local Durability

Cloud/network delivery cannot guarantee exactly-once physical printing.

Example failure:

```text
Pi receives job
    │
    ▼
Pi submits to CUPS
    │
    ▼
power failure before completion status reaches Cloudflare
    │
    ▼
same job is resent after reboot
```

Without local state, this can print twice.

### 13.1 Minimal local job journal

Avoid another daemon or database initially.

Use a state directory:

```text
/var/lib/print-agent/jobs/
```

One small state file per job:

```text
/var/lib/print-agent/jobs/{job_id}.json
```

Example:

```json
{
  "job_id": "019...",
  "state": "submitted",
  "cups_job_id": 42
}
```

Write state atomically:

1. write temporary file;
2. `fsync`;
3. rename into place.

### 13.2 Redelivery

When the same `job_id` arrives again:

- if local state says `completed`, do not print again; resend `completed`;
- if local state says `submitted`, reconcile against CUPS before doing anything;
- if the job was downloaded but never submitted, resume processing;
- if there is no local state, treat it as new.

Retain local markers at least as long as D1 retains jobs, then garbage-collect them.

---

## 14. Pi Job Processing

For each received `PrintJob`:

```text
receive binary WebSocket frame
        │
        ▼
decode Cap'n Proto
        │
        ▼
check local job journal
        │
        ▼
persist acceptance locally
        │
        ▼
send status = printing
        │
        ▼
stream R2 URL to temporary PDF
        │
        ▼
submit PDF to CUPS
        │
        ▼
determine terminal result
        │
        ├── success → status = completed
        └── failure → status = failed
        │
        ▼
remove temporary document
```

### 14.1 Streaming download

Do not buffer an entire document in RAM.

Use `reqwest` streaming and write to something like:

```text
/var/lib/print-agent/spool/{job_id}.pdf
```

### 14.2 CUPS

Start with the system `lp` command using `tokio::process::Command`.

Example shape:

```text
lp
  -n 2
  -o sides=two-sided-long-edge
  -o media=Letter
  file.pdf
```

Capture the CUPS job ID if available and persist it in the local job marker.

---

## 15. Completion Semantics

The implementation must document what `completed` means.

Preferred long-term meaning:

> CUPS reports the submitted job reached a terminal successful state.

For the first implementation, if reliable final CUPS-state monitoring is not yet implemented, `completed` may temporarily mean:

> The print job was successfully accepted by CUPS.

If using the weaker definition, make it explicit in code/comments so it can later be upgraded without changing the D1 schema.

---

## 16. Status Updates

The Pi reports state over the existing WebSocket.

No HTTP device job API is needed.

### Printing

```text
JobStatus {
    jobId = "...",
    state = printing
}
```

Server update:

```sql
UPDATE print_jobs
SET
    status = 'printing',
    updated_at = ?
WHERE id = ?
  AND printer_id = ?
  AND status IN ('queued', 'dispatched');
```

### Completed

```sql
UPDATE print_jobs
SET
    status = 'completed',
    completed_at = ?,
    updated_at = ?
WHERE id = ?
  AND printer_id = ?
  AND status IN ('dispatched', 'printing');
```

### Failed

```sql
UPDATE print_jobs
SET
    status = 'failed',
    failed_at = ?,
    failure_code = ?,
    failure_message = ?,
    updated_at = ?
WHERE id = ?
  AND printer_id = ?
  AND status IN ('dispatched', 'printing');
```

After a terminal update, call `dispatchNext()` for that printer.

Status handling must be idempotent.

Receiving `completed` twice must not produce an error or print another document.

---

## 17. Failure Codes

Use bounded machine-readable codes.

Initial set:

```text
download_failed
download_expired
invalid_document
cups_rejected
printer_unavailable
print_failed
internal_error
```

`failure_message` is diagnostic only.

Limit it to a small bounded size, for example 1 KiB.

Never store arbitrary unbounded logs or stderr in D1.

---

## 18. Reconnection

The Rust daemon maintains one outbound WebSocket.

Pseudo-flow:

```text
loop:
    connect with mTLS

    if connected:
        wait for incoming messages
        process jobs
        send statuses

    if disconnected:
        sleep with exponential backoff
        reconnect
```

On a successful reconnect, the Pi does not need to issue a job API request.

The Durable Object automatically performs reconciliation and resends the appropriate non-terminal job.

Use bounded exponential backoff with jitter.

For example:

```text
1s
2s
4s
8s
15s
30s max
```

Reset backoff after a stable successful connection.

---

## 19. Seven-Day Retention

D1 retains all job metadata from the last seven days.

Use a Worker Cron Trigger once per day.

Cutoff:

```ts
const cutoff =
  Date.now() - 7 * 24 * 60 * 60 * 1000;
```

### 19.1 Cleanup flow

Process expired rows in bounded batches.

```text
find D1 rows older than seven days
        │
        ├── delete associated R2 object
        │
        └── delete D1 row
```

Example query:

```sql
SELECT id, r2_object_key
FROM print_jobs
WHERE created_at < ?
ORDER BY created_at
LIMIT 100;
```

After successful R2 deletion:

```sql
DELETE FROM print_jobs
WHERE id = ?;
```

Repeat until the batch is empty or until the scheduled invocation's own work bound is reached.

A daily Cron means actual physical retention may be slightly over seven days; seven days is the logical retention target.

---

## 20. No Job API in Initial Scope

Do **not** implement any of the following yet:

```text
GET /api/jobs
GET /api/jobs/:id
POST /device/jobs/next
POST /device/jobs/:id/status
POST /device/jobs/:id/refresh
job-history UI
admin print-history UI
analytics API
manual retry API
```

Cloudflare-internal bindings and Durable Object method calls are fine.

The device communicates through:

```text
mTLS WebSocket
+
R2 presigned GET URL
```

only.

---

## 21. No `cloudflared`

Do not install or run Cloudflare Tunnel for this design.

The Pi initiates the WebSocket outbound, so NAT/firewall traversal is already solved.

```text
Pi private LAN address
      │
      │ outbound HTTPS/WSS
      ▼
Cloudflare
```

Nothing needs to initiate a new network connection toward the Pi.

This avoids:

- another daemon;
- tunnel credentials;
- another systemd unit;
- additional memory consumption;
- another failure/restart path.

---

## 22. systemd

Run the agent as one service.

Example:

```ini
[Unit]
Description=Print Agent
After=network-online.target cups.service
Wants=network-online.target

[Service]
Type=simple
User=print-agent
Group=print-agent
SupplementaryGroups=lp

ExecStart=/usr/local/bin/print-agent

Restart=always
RestartSec=5

StateDirectory=print-agent
ConfigurationDirectory=print-agent

[Install]
WantedBy=multi-user.target
```

Expected paths:

```text
/usr/local/bin/print-agent

/etc/print-agent/
    device.crt
    device.key
    config.toml

/var/lib/print-agent/
    jobs/
    spool/
```

Ensure the service account can read the mTLS key and submit jobs to CUPS.

---

## 23. Rust Release Profile

Optimize the binary for a small Raspberry Pi.

```toml
[profile.release]
opt-level = "s"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

Do not use Tokio's `"full"` feature set unless actually required.

Cross-compile in development/CI rather than doing expensive release builds directly on the Pi when convenient.

---

## 24. Security Model

### Protected from

- unsolicited inbound Internet connections to the Pi;
- stolen R2 bearer/API credentials from the Pi;
- stolen Cloudflare Queue tokens from the Pi;
- use of a shared static application secret across devices;
- one compromised device impersonating another device's certificate identity;
- arbitrary client choice of printer identity.

### Not protected from

A physical attacker with root/filesystem access to the Pi can potentially copy its client private key.

Mitigation, if later required:

- hardware secure element;
- non-exportable client key;
- short-lived/reissuable device certificates;
- device revocation.

---

## 25. Recommended Worker Layout

Prefer keeping the Cloudflare-side implementation in as few deployments as practical.

One project can contain:

```text
src/
  index.ts                # HTTP/OAuth app routing
  queue.ts                # Queue consumer handler
  scheduled.ts            # seven-day cleanup
  printer-do.ts           # Durable Object
  d1.ts                   # job persistence helpers
  r2.ts                   # upload/presigning helpers
  protocol.ts             # Cap'n Proto helpers
  device-auth.ts          # mTLS -> printer mapping

schema/
  queue.capnp
  device.capnp

migrations/
  0001_print_jobs.sql
```

If the existing web application is already a separate Worker project, keep it separate rather than forcing a migration. The Queue consumer and Durable Object can live together.

---

## 26. Recommended Pi Layout

```text
print-agent/
  Cargo.toml
  build.rs

  schema/
    device.capnp

  src/
    main.rs
    websocket.rs
    tls.rs
    protocol.rs
    download.rs
    cups.rs
    journal.rs
    config.rs
```

Responsibilities:

- `websocket.rs`: connect/reconnect and binary frames;
- `tls.rs`: rustls mTLS client configuration;
- `protocol.rs`: Cap'n Proto serialization;
- `download.rs`: streamed R2 download;
- `cups.rs`: `lp` invocation and CUPS reconciliation;
- `journal.rs`: atomic local state markers;
- `config.rs`: endpoint and certificate paths.

---

## 27. End-to-End Happy Path

```text
1. User uploads a PDF.

2. Submission Worker authenticates the user.

3. Worker determines:
       page count
       final PDF byte size

4. Worker stores:
       R2 object

5. Worker inserts:
       D1 job = queued

6. Worker enqueues:
       QueueJob(job_id, printer_id)

7. Queue consumer invokes:
       printer Durable Object

8. Durable Object sees the Pi is connected.

9. Durable Object queries D1 for oldest queued job.

10. Durable Object mints a fresh R2 presigned GET URL.

11. Durable Object changes:
       queued -> dispatched

12. Durable Object sends PrintJob over WSS.

13. Pi writes local durable job state.

14. Pi sends:
       status = printing

15. Pi streams PDF from R2 to disk.

16. Pi submits PDF to CUPS.

17. Pi determines terminal result.

18. Pi sends:
       completed
    or:
       failed

19. Durable Object updates D1.

20. Durable Object dispatches the next queued job.

21. After seven days:
       Cron deletes R2 object
       Cron deletes D1 row
```

---

## 28. Offline Pi Path

```text
job submitted
    │
    ▼
D1 = queued
    │
    ▼
Queue notification
    │
    ▼
Durable Object
    │
    └── no Pi socket
```

The Queue message can be acknowledged because D1 still contains the job.

Later:

```text
Pi reconnects
    │
    ▼
mTLS authentication succeeds
    │
    ▼
Durable Object reconciliation
    │
    ▼
oldest queued job is delivered
```

No polling is required.

---

## 29. Lost Connection Mid-Job

```text
Pi receives job
    │
    ▼
D1 = printing
    │
    ▼
WebSocket disconnects
```

On reconnect:

```text
Durable Object sees non-terminal printing job
        │
        ▼
resends same immutable job_id
        │
        ▼
Pi reads local journal
        │
        ├── already completed -> report completed
        ├── already submitted -> reconcile with CUPS
        └── not submitted     -> continue job
```

This is the primary defense against duplicate physical prints.

---

## 30. Acceptance Criteria

The initial implementation is complete when all of the following are true.

### Submission

- authenticated user can submit a printable PDF;
- R2 contains the final document;
- D1 records user, page count, document size, timestamp, printer, and state;
- Queue notification is created only after the D1 job is durable.

### Pi connectivity

- Pi has no inbound listener exposed to the network;
- Pi needs no public IP or DNS name;
- Pi maintains one outbound WSS connection;
- Pi authenticates with a unique mTLS client certificate;
- invalid/unrecognized certificates cannot reach a printer Durable Object.

### Dispatch

- online Pi receives a job promptly without polling;
- offline Pi receives queued work automatically after reconnect;
- multiple Queue wakeups do not cause multiple physical prints;
- printer processes jobs serially.

### R2

- Pi has no R2 API credentials;
- Pi receives a temporary presigned URL;
- downloads are streamed to disk rather than buffered fully in memory.

### Reliability

- WebSocket loss does not lose the job;
- Pi reboot does not blindly duplicate a previously submitted CUPS job;
- duplicate job/status frames are idempotent;
- terminal failures are recorded in D1.

### Retention

- D1 retains job metadata for approximately seven days;
- expired D1 jobs and their R2 objects are garbage-collected by Cron.

### Scope

- no `cloudflared`;
- no MQTT;
- no Queue polling;
- no device job API;
- no job-history API/UI.

---

## 31. Cloudflare References

Current Cloudflare documentation relevant to this design:

- Cloudflare Queues consumers and push/pull behavior:  
  https://developers.cloudflare.com/queues/reference/how-queues-works/

- Cloudflare Queue pull consumers use short polling:  
  https://developers.cloudflare.com/queues/configuration/pull-consumers/

- Durable Object WebSockets and Hibernation API:  
  https://developers.cloudflare.com/durable-objects/best-practices/websockets/

- Cloudflare mTLS client certificates:  
  https://developers.cloudflare.com/ssl/client-certificates/

- Client certificate information exposed to Workers:  
  https://developers.cloudflare.com/ssl/client-certificates/client-certificate-variables/

- R2 presigned URLs:  
  https://developers.cloudflare.com/r2/api/s3/presigned-urls/

- Cloudflare D1 / SQLite-compatible SQL:  
  https://developers.cloudflare.com/d1/sql-api/sql-statements/

- Worker Cron Triggers:  
  https://developers.cloudflare.com/workers/configuration/cron-triggers/
