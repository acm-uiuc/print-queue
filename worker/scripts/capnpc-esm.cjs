#!/usr/bin/env node

const fs = require("node:fs");
const { run } = require("capnpc-ts");

run()
  .then((context) => {
    for (const file of context.files) {
      const source = fs.readFileSync(file.tsPath, "utf8");
      const withoutImport = source.replace(/^import \* as capnp from "capnp-ts";\r?\n/mu, "");
      if (!/\bcapnp\./u.test(withoutImport)) {
        fs.writeFileSync(file.tsPath, withoutImport);
      }
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
