import * as admin from "firebase-admin";
import * as functions from "firebase-functions";


const Airtable = require('airtable');
const baseId = functions.config().airtable.id;
const apiKey = functions.config().airtable.key;

interface IAirtableUser {
    name: string;
    first: string;
    id: string;
    airtableId: string;
    age: number;
    gender: string;
    phone: string;
    status: string;
    matchMax: number;
    matchMin: number;
    location: string;
    timezone: string;
    flexible: string;
    wants: string[];
    prevMatches: string[];
    blocklist: string[];
}

export async function generateRemainingMatchCount(excludeNames: string[]) {
    const base = new Airtable({ apiKey: apiKey }).base(baseId);
    const records = await base("Users").select({ view: "Available Users" }).all();
    const users: IAirtableUser[] = await Promise.all(records
        .filter((record: any) => !excludeNames.includes(record.get("Label")))
        .map((record: any) => formatAirtableUserRecord(record)));

    const results = [];
    for (const user of users) {
        const matches = users.filter((match: IAirtableUser) => areUsersCompatible(user, match));

        results.push({
            name: user.name,
            first: user.first,
            gender: user.gender,
            age: user.age,
            timezone: user.timezone,
            location: user.location,
            phone: user.phone,
            remainingMatches: matches.map(m => m.name),
            status: user.status,
            previousMatches: user.prevMatches.length,
        });
    }

    return results;
}

export async function generateAvailableMatches(view: string, tz: string) {
    const base = new Airtable({ apiKey: apiKey }).base(baseId);

    const users = await base("Users").select({ view: "Available Users" }).all();
    const availability = await base("Scheduling").select({ view }).all();

    const availabilityByUserId: Record<string, string[]> = {}
    const usersInRound = availability.map((record: any) => {
        const id = record.get('UserID')[0];
        availabilityByUserId[id] = record.get('Response') || [];
        return id;
    })

    const usersInTZ = await Promise.all(users
        .filter((record: any) => {
            const userId = record.get('UserID');
            const timezone = record.get("Timezone")?.[0];
            return userId && usersInRound.includes(userId) && timezone === tz;
        }).map((record: any) => formatAirtableUserRecord(record)));

    const pairs = [];
    for (const [userA, userB] of generatePairs(usersInTZ)) {
        if (!areUsersCompatible(userA, userB)) {
            continue;
        }
        const sharedAvailability = findCommonElements(availabilityByUserId[userA.id], availabilityByUserId[userB.id]);
        if (sharedAvailability.length > 0) {
            pairs.push({
                userA: userA.name,
                userB: userB.name,
                sameLocation: userA.location === userB.location,
                userAFlexible: userA.flexible,
                userBFlexible: userB.flexible,
                userAPrevMatches: userA.prevMatches.length,
                userBPrevMatches: userB.prevMatches.length,
                userAId: userA.id,
                userBId: userB.id,
                days: sharedAvailability
            });
        }
    }
    return pairs;
}

function findCommonElements(arr1: any[], arr2: any[]) {
    return arr1.filter(item => arr2.includes(item))
}

// returns all possible pairings of an array
function generatePairs(array: any[]) {
    return array.reduce((acc, v, i) =>
        acc.concat(array.slice(i + 1).map(w => [v, w])),
        []);
}

function defaultMatchMax(match_gender: string, match_age: number) {
    return match_gender === "Female" ? match_age + 7 : match_age + 4
}

function defaultMatchMin(match_gender: string, match_age: number) {
    return match_gender === "Female" ? match_age - 1 : match_age - 5
}

async function getPreviousMatches(id: string) {
    if (!id) {
        return [];
    }
    const matches = await admin.firestore().collection("matches")
        .where("user_ids", "array-contains", id).get();
    return matches.docs.map(doc => doc.get("user_a_id") === id ? doc.get("user_b_id") : doc.get("user_a_id"));
}

async function formatAirtableUserRecord(record: any): Promise<IAirtableUser> {
    const firebaseId = record.get("UserID");
    const age = record.get("Age");
    const gender = record.get("Gender");

    // these contain airtable IDs
    const prevMatches = await getPreviousMatches(firebaseId);
    const blocklist = record.get("Blocklist") || [];
    return {
        name: record.get("Label"),
        first: record.get("First"),
        id: firebaseId,
        airtableId: record.id,
        age,
        gender,
        phone: record.get("Phone"),
        status: record.get("Status"),
        matchMax: record.get("Max Match Age") || defaultMatchMax(gender, age),
        matchMin: record.get("Min Match Age") || defaultMatchMin(gender, age),
        location: record.get("Location")[0],
        timezone: record.get("Timezone")[0],
        flexible: record.get("Flexible on Location"),
        // convert wants to Gender Field options
        wants: record.get("Wants").map((want: any) => want === "Men" ? "Male" : "Female"),
        prevMatches,
        blocklist,
    };
}

function areUsersCompatible(user: IAirtableUser, match: IAirtableUser) {
    // ensure user isn't matching with self
    if (user.id === match.id) {
        return false;
    }

    // check if match meets user's age criteria
    if (match.age > user.matchMax || match.age < user.matchMin) {
        return false;
    }

    // check if user meets match's age criteria
    if (user.age > match.matchMax || user.age < match.matchMin) {
        return false;
    }

    // check gender
    if (!user.wants.includes(match.gender) || !match.wants.includes(user.gender)) {
        if (!(user.gender === "Other" && match.wants.length > 1 || match.gender === "Other" && user.wants.length > 1)) {
            return false;
        }
    }

    // check timezone
    if (match.timezone !== user.timezone) {
        return false
    }

    // if users are in different locations, check if both are flexible. defaults to true if flexibility is unknown
    if (match.location !== user.location) {
        if (match.flexible === "No" || user.flexible === "No") {
            return false
        }
    }

    // If user has previous matches or blocklist, filter them out of results
    if (user.prevMatches.includes(match.id)) {
        return false;
    }
    if (user.blocklist.includes(match.airtableId)) {
        return false;
    }

    return true;
}
