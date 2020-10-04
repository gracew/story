import * as admin from "firebase-admin";
import * as functions from "firebase-functions";


const Airtable = require('airtable');
const baseId = functions.config().airtable.id;
const apiKey = functions.config().airtable.key;

export async function generateRemainingMatchCount() {
    const base = new Airtable({ apiKey: apiKey }).base(baseId);
    const records = await base("Users").select({ view: "Available Users" }).all();
    const users: any[] = await Promise.all(records.map(async (record: any) => {
        const firebaseId = record.get("UserID");
        const age = record.get("Age");
        const gender = record.get("Gender");

        // these contain airtable IDs
        const prevMatches = await getPreviousMatches(firebaseId);
        const blocklist = record.get("Blocklist") || [];
        return {
            name: record.get("Label"),
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
    }));

    const results = [];
    for (const user of users) {
        const matches = users.filter((match: any) => {
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
        });

        results.push({
            name: user.name,
            gender: user.gender,
            age: user.age,
            timezone: user.timezone,
            location: user.location,
            phone: user.phone,
            remainingMatches: matches.map(m => m.name),
            status: user.status,
            previousMatches: user.prevMatches.length
        });
    }

    return results;
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