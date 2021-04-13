import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { IUser } from "./firestore";
import moment = require("moment");

/** Used in each round to determine which users should be included (based on number of potential matches). */
export const remainingMatches = functions.https.onRequest(
    async (request, response) => {
        const excludeIds = request.body.excludeIds || [];
        const usersRaw = await admin.firestore().collection("users").where("status", "in", ["waitlist", "contacted", "pause", "resurrected"]).get();
        const users = usersRaw.docs.filter(d => !excludeIds.includes(d.id)).map(d => formatUser(d));
        const [prevMatches, blocklist, optInLikelihood] = await Promise.all([getPrevMatches(), getBlocklist(), getOptInLikelihood()]);

        const results = [];
        for (const user of users) {
            const remaining = users.filter(match => areUsersCompatible(user, match, prevMatches, blocklist));
            const remainingSameTz = remaining.filter(match => match.timezone === user.timezone);

            const remainingLikely = remaining.reduce((acc, u) => acc + (optInLikelihood[u.id] || 0), 0);
            const remainingSameTzLikely = remainingSameTz.reduce((acc, u) => acc + (optInLikelihood[u.id] || 0), 0);

            results.push({
                ...user,
                optInLikelihood: optInLikelihood[user.id],
                remainingMatches: remaining.map(u => u.firstName + " " + u.lastName),
                remainingMatchesSameTz: remainingSameTz.map(u => u.firstName + " " + u.lastName),
                remainingLikely,
                remainingSameTzLikely,
                // @ts-ignore
                prevMatches: prevMatches[user.id],
            });
        }

        response.send(results);
    }
);

async function getOptInLikelihood() {
    // check the last 4 weeks of history
    const optIns: Record<string, number> = {};
    const count: Record<string, number> = {};
    for (let i = 1; i <= 4; i++) {
        const week = moment().startOf("week").subtract(i, "weeks").format("YYYY-MM-DD");
        const results = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
        results.forEach(doc => {
            if (!(doc.id in count)) {
                count[doc.id] = 0;
            }
            count[doc.id]++;

            const available = doc.get("available");
            if (available && available.length > 0) {
                if (!(doc.id in optIns)) {
                    optIns[doc.id] = 0;
                }
                optIns[doc.id]++;
            }
        })
    }
    const likelihood: Record<string, number> = {};
    Object.entries(count).forEach(([userId, n]) => {
        likelihood[userId] = (optIns[userId] || 0) / n;
    })
    return likelihood;
}

/** Used in each round after obtaining availability to generate matches. */
export const potentialMatches = functions.https.onRequest(
    async (request, response) => {
        const result = await potentialMatchesHelper(request.body.schedulingView);
        response.send(result);
    }
);

export const bipartiteMatches = functions.https.onRequest(
    async (request, response) => {
        const result = await bipartiteMatchesHelper(request.body.schedulingView);
        response.send(result);
    }
);


function formatUser(d: any) {
    const o = d.data();
    return {
        ...o,
        matchMax: o.matchMax || defaultMatchMax(o.gender, o.age),
        matchMin: o.matchMin || defaultMatchMin(o.gender, o.age),
    };
}

async function getPrevMatches() {
    const matches = await admin.firestore().collection("matches").where("canceled", "==", false).get();
    const ret: Record<string, string[]> = {};
    matches.forEach(m => {
        const data = m.data();
        if (!(data.user_a_id in ret)) {
            ret[data.user_a_id] = [];
        }
        ret[data.user_a_id].push(data.user_b_id);

        if (!(data.user_b_id in ret)) {
            ret[data.user_b_id] = [];
        }
        ret[data.user_b_id].push(data.user_a_id);
    })
    return ret;
}

async function getBlocklist() {
    const blocklists = await admin.firestore().collection("blocklist").get();
    const ret: Record<string, string[]> = {};
    blocklists.forEach(b => {
        const [id1, id2] = b.get("userIds");

        if (!(id1 in ret)) {
            ret[id1] = [];
        }
        ret[id1].push(id2);

        if (!(id2 in ret)) {
            ret[id2] = [];
        }
        ret[id2].push(id1);
    })
    return ret;
}

async function potentialMatchesHelper(week: string) {
    const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

    const userRefs = availability.docs.map(doc => admin.firestore().collection("users").doc(doc.id));
    const users = (await admin.firestore().getAll(...userRefs)).map(d => formatUser(d));

    const pairs = [];
    const [prevMatches, blocklist] = await Promise.all([getPrevMatches(), getBlocklist()]);
    for (const [userA, userB] of generatePairs(users)) {
        if (!areUsersCompatible(userA, userB, prevMatches, blocklist)) {
            continue;
        }
        const sharedAvailability = findCommonAvailability(availabilityByUserId[userA.id].available, availabilityByUserId[userB.id].available);
        if (sharedAvailability.length > 0) {
            pairs.push({
                userA,
                userB,
                sameLocation: userA.location === userB.location,
                userAPrevMatches: (prevMatches[userA.id] || []).length,
                userBPrevMatches: (prevMatches[userB.id] || []).length,
                days: sharedAvailability
            });
        }
    }
    return pairs;
}

function findCommonAvailability(a1?: admin.firestore.Timestamp[], a2?: admin.firestore.Timestamp[]) {
    if (!a1 || !a2) {
        return [];
    }
    const set = new Set(a1.map(t => t.toDate().toISOString()));
    return a2.map(t => t.toDate()).filter(d => set.has(d.toISOString()));
}

// returns all possible pairings of an array
function generatePairs(array: any[]) {
    return array.reduce((acc, v, i) =>
        acc.concat(array.slice(i + 1).map(w => [v, w])),
        []);
}

function defaultMatchMax(gender: string, age: number) {
    return gender === "Female" ? age + 6 : age + 4
}

function defaultMatchMin(gender: string, age: number) {
    return gender === "Female" ? age - 2 : age - 4
}

export function checkGenderPreference(user: IUser, match: IUser) {
    switch (user.genderPreference) {
        case "Everyone":
            return true;
        case "Men":
            return match.gender === "Male";
        case "Women":
            return match.gender === "Female";
        default:
            return false;
    }
}

function areUsersCompatible(user: IUser, match: IUser, prevMatches: Record<string, string[]>, blocklist: Record<string, string[]>) {
    // ensure user isn't matching with self
    if (user.id === match.id) {
        return false;
    }

    // check if match meets user's age criteria
    if (match.age > (user.matchMax + 1) || match.age < (user.matchMin - 1)) {
        return false;
    }

    // check if user meets match's age criteria
    if (user.age > (match.matchMax + 1) || user.age < (match.matchMin) - 1) {
        return false;
    }

    // check gender
    if (!checkGenderPreference(user, match) || !checkGenderPreference(match, user)) {
        return false;
    }

    // if users are in different locations, check if both are flexible. defaults to true if flexibility is unknown
    if (match.location !== user.location) {
        if (match.locationFlexibility === false || user.locationFlexibility === false) {
            return false;
        }
    }

    // If user has previous matches or blocklist, filter them out of results
    if ((prevMatches[user.id] || []).includes(match.id)) {
        return false;
    }
    if ((blocklist[user.id] || []).includes(match.id)) {
        return false;
    }

    return true;
}

async function bipartiteMatchesHelper(week: string) {
    const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

    const userRefs = availability.docs.map(doc => admin.firestore().collection("users").doc(doc.id));
    const users = (await admin.firestore().getAll(...userRefs)).map(d => formatUser(d));

    const usersById = Object.assign({}, ...users.map(user => ({ [user.id]: user })))
    const [prevMatches, blocklist] = await Promise.all([getPrevMatches(), getBlocklist()]);

    const possibleMatches: Record<string, boolean> = {}
    generatePairs(users)
        .forEach(([userA, userB]: [any, any]) => {
            if (!areUsersCompatible(userA, userB, prevMatches, blocklist)) {
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
        const [fUserId, mUserId] = matchStr.split('_')
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
            userA: userA.firstName + " " + userA.lastName,
            userB: userB.firstName + " " + userB.lastName,
            sameLocation: userA.location === userB.location,
            userAFlexible: userA.locationFlexibility,
            userBFlexible: userB.locationFlexibility,
            userAPrevMatches: (prevMatches[userA.id] || []).length,
            userBPrevMatches: (prevMatches[userB.id] || []).length,
            userAId: userA.id,
            userBId: userB.id,
            days: findCommonAvailability(availabilityByUserId[userA.id], availabilityByUserId[userB.id]),
        }
    })
    const unmatchedUsers = users
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
    const existingIdx = arr.findIndex(v => v === newVal)
    if (existingIdx > -1) {
        return existingIdx
    } else {
        arr.push(newVal)
        return arr.length - 1
    }
}

/* tslint:disable */
// @ts-nocheck
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
