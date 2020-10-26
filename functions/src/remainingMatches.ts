/* tslint:disable */
// @ts-nocheck
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
            id: user.id,
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

export async function generateAvailableMatches(week: string, tz: string) {
    const base = new Airtable({ apiKey: apiKey }).base(baseId);

    const users = await base("Users").select({ view: "Available Users" }).all();

    const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

    const usersInTZ = await Promise.all(users
        .filter((record: any) => {
            const userId = record.get('UserID');
            const timezone = record.get("Timezone")?.[0];
            return userId && userId in availabilityByUserId && timezone === tz;
        }).map((record: any) => formatAirtableUserRecord(record)));

    const pairs = [];
    for (const [userA, userB] of generatePairs(usersInTZ)) {
        if (!areUsersCompatible(userA, userB)) {
            continue;
        }
        const sharedAvailability = findCommonAvailability(availabilityByUserId[userA.id], availabilityByUserId[userB.id]);
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

function findCommonAvailability(a1: Record<string, boolean>, a2: Record<string, boolean>) {
    const ret = [];
    if (a1["mon"] && a2["mon"]) {
        ret.push("mon");
    }
    if (a1["tue"] && a2["tue"]) {
        ret.push("tue");
    }
    if (a1["wed"] && a2["wed"]) {
        ret.push("wed");
    }
    if (a1["thu"] && a2["thu"]) {
        ret.push("thu");
    }
    if (a1["fri"] && a2["fri"]) {
        ret.push("fri");
    }
    return ret;
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
        status: record.get("Status")[0],
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

export async function bipartite(week: string, tz: string) {
    const base = new Airtable({ apiKey: apiKey }).base(baseId);
    const users = await base("Users").select({ view: "Available Users" }).all();
    const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

    const usersInTZ: IAirtableUser[] = await Promise.all(users
        .filter((record: any) => {
            const userId = record.get('UserID');
            const timezone = record.get("Timezone")?.[0];
            return userId && userId in availabilityByUserId && timezone === tz;
        }).map((record: any) => formatAirtableUserRecord(record)));
    const usersById = Object.assign({}, ...usersInTZ.map(user => ({ [user.id]: user })))

    const possibleMatches: Record<string, boolean> = {}
    generatePairs(usersInTZ)
        .forEach(([userA, userB]: [IAirtableUser, IAirtableUser]) => {
            if (!areUsersCompatible(userA, userB)) {
                return;
            }
            const commonAvailability = findCommonAvailability(availabilityByUserId[userA.id], availabilityByUserId[userB.id]);
            if (commonAvailability.length > 0) {
                const aIsFemale = userA.gender === 'Female';
                const leftUser = aIsFemale ? userA.id : userB.id;
                const rightUser = aIsFemale ? userB.id : userA.id;
                possibleMatches[`${leftUser}_${rightUser}`] = true
            }
        })

    const womenIds: string[] = []
    const menIds: string[] = []
    const edges: any[] = []
    Object.keys(possibleMatches).forEach(matchStr => {
        let [fUserId, mUserId] = matchStr.split('_')
        edges.push([
            addOrFindInArray(womenIds, fUserId),
            addOrFindInArray(menIds, mUserId)
        ])
    })

    const matchedUsers = new Set();
    const matches = bipartiteMatching(womenIds.length, menIds.length, edges).map(edge => {
        const userAId = womenIds[edge[0]];
        const userBId = menIds[edge[1]];
        const userA = usersById[userAId];
        const userB = usersById[userBId];
        matchedUsers.add(userAId);
        matchedUsers.add(userBId);
        return {
            userA: userA.name,
            userB: userB.name,
            sameLocation: userA.location === userB.location,
            userAFlexible: userA.flexible,
            userBFlexible: userB.flexible,
            userAPrevMatches: userA.prevMatches.length,
            userBPrevMatches: userB.prevMatches.length,
            userAId: userA.id,
            userBId: userB.id,
            days: findCommonAvailability(availabilityByUserId[userA.id], availabilityByUserId[userB.id]),
        }
    })
    const unmatchedUsers = usersInTZ
        .filter(user => {
            const av = availabilityByUserId[user.id];
            if (!av || Object.keys(av).length === 0) {
                return false;
            }
            if (av["skip"]) {
                return false;
            }
            return !matchedUsers.has(user.id);
        })
        .map(user => ({
            ...user,
            availability: availabilityByUserId[user.id],
        }));
    return {
        matches,
        unmatchedUsers,
    };
}

// Return index in array of found or added new value
function addOrFindInArray(arr: any[], newVal: any) {
    let existingIdx = arr.findIndex(v => v === newVal)
    if (existingIdx > -1) {
        return existingIdx
    } else {
        arr.push(newVal)
        return arr.length - 1
    }
}

// Bipartite matching, lightly modified from
// https://github.com/mikolalysenko/bipartite-matching/blob/master/match.js
function bipartiteMatching(n: any, m: any, edges: any) {
    var INF = (1 << 28)

    //Initalize adjacency list, visit flag, distance
    var adjN = new Array(n)
    var g1 = new Array(n)
    var dist = new Array(n)
    for (var i = 0; i < n; ++i) {
        g1[i] = -1
        adjN[i] = []
        dist[i] = INF
    }
    var adjM = new Array(m)
    var g2 = new Array(m)
    for (var i = 0; i < m; ++i) {
        g2[i] = -1
        adjM[i] = []
    }

    //Build adjacency matrix
    var E = edges.length
    for (var i = 0; i < E; ++i) {
        var e = edges[i]
        adjN[e[0]].push(e[1])
        adjM[e[1]].push(e[0])
    }

    var dmax = INF

    function dfs(v: any) {
        if (v < 0) {
            return true
        }
        var adj = adjN[v]
        for (var i = 0, l = adj.length; i < l; ++i) {
            var u = adj[i]
            var pu = g2[u]
            var dpu = dmax
            if (pu >= 0) {
                dpu = dist[pu]
            }
            if (dpu === dist[v] + 1) {
                if (dfs(pu)) {
                    g1[v] = u
                    g2[u] = v
                    return true
                }
            }
        }
        dist[v] = INF
        return false
    }

    //Run search
    var toVisit = new Array(n)
    var matching = 0
    while (true) {

        //Initialize queue
        var count = 0
        for (var i = 0; i < n; ++i) {
            if (g1[i] < 0) {
                dist[i] = 0
                toVisit[count++] = i
            } else {
                dist[i] = INF
            }
        }

        //Run BFS
        var ptr = 0
        dmax = INF
        while (ptr < count) {
            var v = toVisit[ptr++]
            var dv = dist[v]
            if (dv < dmax) {
                var adj = adjN[v]
                for (var j = 0, l = adj.length; j < l; ++j) {
                    var u = adj[j]
                    var pu = g2[u]
                    if (pu < 0) {
                        if (dmax === INF) {
                            dmax = dv + 1
                        }
                    } else if (dist[pu] === INF) {
                        dist[pu] = dv + 1
                        toVisit[count++] = pu
                    }
                }
            }
        }


        //Check for termination
        if (dmax === INF) {
            break
        }

        //Run DFS on each vertex in N
        for (var i = 0; i < n; ++i) {
            if (g1[i] < 0) {
                if (dfs(i)) {
                    matching += 1
                }
            }
        }
    }

    //Construct result
    var count = 0
    var result = new Array(matching)
    for (var i = 0; i < n; ++i) {
        if (g1[i] < 0) {
            continue
        }
        result[count++] = [i, g1[i]]
    }

    //Return
    return result
}
