@0xd591d3f7eea62e31;

struct PrintOptions {
  copies @0 :UInt16;
  duplex @1 :Duplex;
  color @2 :Bool;
  media @3 :Text;
  pageRanges @4 :Text;
  orientation @5 :Orientation;

  enum Duplex {
    none @0;
    longEdge @1;
    shortEdge @2;
  }

  enum Orientation {
    portrait @0;
    landscape @1;
  }
}

struct PrintJob {
  jobId @0 :Text;
  downloadUrl @1 :Text;
  expiresAtMs @2 :UInt64;
  pageCount @3 :UInt32;
  documentBytes @4 :UInt64;
  options @5 :PrintOptions;
}

struct JobStatus {
  jobId @0 :Text;
  state @1 :State;
  failureCode @2 :Text;
  failureMessage @3 :Text;

  enum State {
    printing @0;
    completed @1;
    failed @2;
  }
}

struct Envelope {
  union {
    printJob @0 :PrintJob;
    jobStatus @1 :JobStatus;
  }
}
