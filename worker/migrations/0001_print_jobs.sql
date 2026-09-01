CREATE TABLE print_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    printer_id TEXT NOT NULL,
    r2_object_key TEXT NOT NULL,
    page_count INTEGER NOT NULL CHECK (page_count >= 1),
    document_bytes INTEGER NOT NULL CHECK (document_bytes >= 0),
    options_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'dispatched', 'printing', 'completed', 'failed')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    failed_at INTEGER,
    failure_code TEXT,
    failure_message TEXT
);

CREATE INDEX idx_print_jobs_created_at
ON print_jobs(created_at DESC);

CREATE INDEX idx_print_jobs_user_created
ON print_jobs(user_id, created_at DESC);

CREATE INDEX idx_print_jobs_printer_status_created
ON print_jobs(printer_id, status, created_at ASC);

CREATE UNIQUE INDEX idx_print_jobs_one_active_per_printer
ON print_jobs(printer_id)
WHERE status IN ('dispatched', 'printing');
