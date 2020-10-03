const Airtable = require('airtable');
const baseId = "appWqzrY3SZ09xjYO"
const apiKey = "key8rNmGaRXvRhHaD";

export async function generateRemainingMatchCount() {
    const base = new Airtable({ apiKey: apiKey }).base(baseId);
    const records = await base("Users").select({ view: "Available Users" }).all();
    const users = records.map((record: any) => {
        const age = record.get("Age");
        const gender = record.get("Gender");

        // these contain airtable IDs
        const prevMatches = (record.get("Previous Matches A") || []).concat(record.get("Previous Matches B") || []);
        const blocklist = record.get("Blocklist") || [];
        return {
            name: record.get("Label"),
            id: record.get("UserID"),
            airtableId: record.id,
            age,
            gender,
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
    })

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
            if (user.prevMatches.includes(match.airtableId)) {
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
            remainingMatches: matches.length,
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