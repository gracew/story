/* tslint:disable */
// @ts-nocheck
import * as admin from "firebase-admin";

function formatUser(d: any) {
    // convert wants to Gender Field options
    const o = d.data();
    const genderPreference = o.genderPreference.map((want: any) => want === "Men" ? "Male" : "Female");
    return {
        ...o,
        genderPreference,
        matchMax: o.matchMax || defaultMatchMax(o.gender, o.age),
        matchMin: o.matchMin || defaultMatchMin(o.gender, o.age),
    };
}

export async function generateRemainingMatchCount(excludeNames: string[]) {
    // TODO(gracew): incorporate excludeNames again
    const usersRaw = await admin.firestore().collection("users").where("eligible", "==", true).get();
    const users = usersRaw.docs.map(d => formatUser(d));
    const prevMatches = await getPrevMatches();

    const results = [];
    for (const user of users) {
        const remainingMatches = users.filter(match => areUsersCompatible(user, match, prevMatches));

        results.push({
            ...user,
            remainingMatches,
            // @ts-ignore
            prevMatches: prevMatches[user.id],
        });
    }

    return results;
}

async function getPrevMatches() {
    const matches = await admin.firestore().collection("matches").get();
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

export async function generateAvailableMatches(week: string, tz: string) {
    const usersRaw = await admin.firestore().collection("users").where("eligible", "==", true).get();
    const users = usersRaw.docs.map(d => formatUser(d));

    const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

    // @ts-ignore
    const usersInTZ = users.filter(u => u.id in availabilityByUserId && u.timezone === tz);

    const pairs = [];
    const prevMatches = await getPrevMatches();
    for (const [userA, userB] of generatePairs(usersInTZ)) {
        if (!areUsersCompatible(userA, userB, prevMatches)) {
            continue;
        }
        const sharedAvailability = findCommonAvailability(availabilityByUserId[userA.id], availabilityByUserId[userB.id]);
        if (sharedAvailability.length > 0) {
            pairs.push({
                userA: userA.firstName + " " + userA.lastName,
                userB: userB.firstName + " " + userB.lastName,
                sameLocation: userA.location === userB.location,
                userAFlexible: userA.locationFlexibility,
                userBFlexible: userB.locationFlexibility,
                userAPrevMatches: (prevMatches[userA.id] || []).length,
                userBPrevMatches: (prevMatches[userB.id] || []).length,
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

function defaultMatchMax(gender: string, age: number) {
    return gender === "Female" ? age + 7 : age + 4
}

function defaultMatchMin(gender: string, age: number) {
    return gender === "Female" ? age - 1 : age - 5
}

function areUsersCompatible(user: any, match: any, prevMatches: Record<string, string[]>) {
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
    if (!user.genderPreference.includes(match.gender) || !match.genderPreference.includes(user.gender)) {
        if (!(user.gender === "Other" && match.genderPreference.length > 1 || match.gender === "Other" && user.genderPreference.length > 1)) {
            return false;
        }
    }

    // check timezone
    if (match.timezone !== user.timezone) {
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
    /*if (user.blocklist.includes(match.airtableId)) {
        return false;
    }*/

    return true;
}

export async function bipartite(week: string, tz: string) {
    const usersRaw = await admin.firestore().collection("users").where("eligible", "==", true).get();
    const users = usersRaw.docs.map(d => formatUser(d));

    const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

    // @ts-ignore
    const usersInTZ = users.filter(u => u.id in availabilityByUserId && u.timezone === tz);

    const usersById = Object.assign({}, ...usersInTZ.map(user => ({ [user.id]: user })))
    const prevMatches = await getPrevMatches();

    const possibleMatches: Record<string, boolean> = {}
    generatePairs(usersInTZ)
        .forEach(([userA, userB]: [any, any]) => {
            if (!areUsersCompatible(userA, userB, prevMatches)) {
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
