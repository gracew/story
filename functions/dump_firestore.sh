#!/bin/bash
set -e
node ./scripts/20200507_dumpAllTables.js > ./firestore_dump.json
