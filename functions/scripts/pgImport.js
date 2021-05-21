const { Client } = require('pg');
const client = new Client({database: 'story_dev'});
const _ = require('lodash');

const moment = require('moment');
const dump = require('../firestore_dump.json');

const daysOfWeek = ["mon", "tue", "wed", "thu", "fri", "sat"];

function pgParams(num) {
    const paramStrs = [];
    for (let i = 1; i <= num; i++) {
        paramStrs.push(`$${i}`);
    }
    return paramStrs.join(', ');
}

function fromFirestoreTimestamp(ts) {
    if (!ts) {
        return ts
    }
    return new Date(ts._seconds * 1000);
}

async function insert(client, tableName, kv) {
    const keys = Object.keys(kv);
    const q = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${pgParams(keys.length)})`;
    return client.query(q, Object.values(kv));
}

function getPath(obj, ...path) {
    let resolved = obj;
    for (const step of path) {
        resolved = obj[step];
        if (!resolved) {
            return resolved;
        }
    }
    return resolved;
}

function getArray(obj, ...path) {
    const resolved = getPath(obj, ...path);
    if (!resolved) {
        return [];
    }
    if (Array.isArray(resolved)) {
        return resolved;
    }
    return [resolved];
}

(async () => {
    await client.connect();

    /// blocklist
    for (const [_, block] of Object.entries(dump.blocklist)) {
        await client.query('INSERT INTO blocklists(user_ids) VALUES ($1)', [block.userIds]);
    }

    /// users
    for (const [userId, user] of Object.entries(dump.users)) {
        if (!user.firstName) {
            console.warn("preferences not found for", user, "skipping");
            continue;
        }

        await insert(client, "users", {
            id: userId,
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
            is_eligible: true,
            created_at: fromFirestoreTimestamp(user.registeredAt) || new Date(0),
            fun_facts: [user.funFacts],
            gender: user.gender || "Unknown",
            interests_blurb: user.interests,
            heard_about_us_thru: user.whereDidYouHearAboutUs,
            location: user.location,
            phone: user.phone,
            is_ethnicity_self_reported: true,
        });

        /// prefs
        const prefs = dump.preferences[userId];
        if (!prefs) {
            console.warn("preferences not found for", userId, "skipping");
            continue;
        }

        const relationType = getPath(prefs, 'relationshipType', 'value');
        if (!relationType) {
            console.warn("relationType not found for", userId, "skipping");
            continue;
        }
        await insert(client, "match_preferences", {
            user_id: userId,
            connection_types: getArray(prefs, 'connectionType', 'value'),
            interested_in_genders: [user.genderPreference],
            drugs_alcohol_dealbreakers: getArray(prefs, 'drugsAlcohol', 'dealbreakers'),
            drugs_alcohol_profile: getArray(prefs, 'drugsAlcohol', 'value'),
            kids_dealbreakers: getArray(prefs, 'kids', 'dealbreakers'),
            kids_profile: getArray(prefs, 'kids', 'value'),
            politics_dealbreakers: getArray(prefs, 'politics', 'dealbreakers'),
            politics_profile: getArray(prefs, 'politics', 'value'),
            relation_type: relationType,
            religion_dealbreakers: getArray(prefs, 'religion', 'dealbreakers'),
            religion_profile: getArray(prefs, 'religion', 'value'),
            smoking_dealbreakers: getArray(prefs, 'smoking', 'dealbreakers'),
            smoking_profile: getArray(prefs, 'smoking', 'value'),
        });
    }

    /// scheduling
    for (const [weekStr, {subCollection}] of Object.entries(dump.scheduling)) {
        const weekDate = new Date(weekStr);
        const weekMoment = moment(weekDate);
        const subCollections = Object.values(subCollection);
        const optinsByUserId = _.maxBy(subCollections, obj => Object.keys(obj).length);
        for (const [userId, payload] of Object.entries(optinsByUserId)) {
            let availableTimes = [];
            for (const dayOfWeek of daysOfWeek) {
                if (payload[dayOfWeek]) {
                    availableTimes.push(weekMoment.day(dayOfWeek).toDate());
                }
            }

            const numMatches = payload.matches || null;

            if (payload.available) {
                if (Array.isArray(payload.available)) {
                    for (const ts of payload.available) {
                        availableTimes.push(fromFirestoreTimestamp(ts));
                    }
                } else {
                    console.warn("got unexpected value for available", payload.available);
                }
            }

            if (payload.skip) {
                availableTimes = [];
            }

            await insert(client, "weekly_call_optins", {
                user_id: userId,
                num_matches: numMatches,
                available_times: availableTimes,
                week: weekDate,
            });
        }
    }


    await client.end();
})();
