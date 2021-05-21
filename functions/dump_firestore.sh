#!/bin/bash
set -e
node ./scripts/20210507_dumpAllTables.js > ./firestore_dump.json
