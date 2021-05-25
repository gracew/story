#!/bin/bash
set -ex

dropdb story_dev
createdb story_dev
psql story_dev < ./schema.sql

node scripts/pgImport.js
