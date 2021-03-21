import csv
import json
from collections import defaultdict

import numpy as np
from scipy.optimize import linear_sum_assignment

# 2 files
# 1. user id to desired # of matches
# 2. all possible matches


def create_reward_matrix(num_users, possible_matches, id_to_idx):
    reward_matrix = np.zeros((num_users, num_users), dtype=np.int64)

    for row in possible_matches:
        user_a = row["userA"]
        user_b = row["userB"]

        if user_a["gender"] == user_b["gender"]:
            # handle these manually for now
            continue

        user_f = user_a if user_a["gender"] == "Female" else user_b
        user_m = user_b if user_a["gender"] == "Female" else user_a

        user_f_idx = id_to_idx[user_f["id"]]
        user_m_idx = id_to_idx[user_m["id"]]
        reward_matrix[user_f_idx][user_m_idx] = 1

    return reward_matrix


def match_has_ids(m, user_a_id, user_b_id):
    s = set()
    s.add(m["userA"]["id"])
    s.add(m["userB"]["id"])
    return user_a_id in s and user_b_id in s


def find_availability(possible_matches, user_a_id, user_b_id):
    row = next(m for m in possible_matches if match_has_ids(m, user_a_id, user_b_id))
    return row["days"]


def prune_possible_matches(possible_matches, matched_ids, preferred_num):
    pruned_matches = []
    for row in possible_matches:
        user_a_id = row["userA"]["id"]
        user_b_id = row["userB"]["id"]
        if user_a_id in matched_ids and matched_ids[user_a_id] == preferred_num[user_a_id]:
            continue
        if user_b_id in matched_ids and matched_ids[user_b_id] == preferred_num[user_b_id]:
            continue
        pruned_matches.append(row)

    return pruned_matches


def main(week):
    matched_ids = defaultdict(int)
    manual_f = open('./{}/manual_matches.csv'.format(week), newline='')
    manual_r = csv.reader(manual_f)
    for [id_a, id_b, _, _] in manual_r:
        matched_ids[id_a] += 1
        matched_ids[id_b] += 1

    preferred_num_f = open('./{}/num_matches.csv'.format(week), newline='')
    preferred_num_r = csv.reader(preferred_num_f)
    preferred_num = {}

    names = {}
    id_to_idx = {}
    idx_to_id = {}
    num_users = 0

    for [user_id, num_matches, name] in preferred_num_r:
        preferred_num[user_id] = min(2, int(num_matches))
        names[user_id] = name
        id_to_idx[user_id] = num_users
        idx_to_id[num_users] = user_id
        num_users += 1

    preferred_num_override = {}
    for o in preferred_num_override:
        preferred_num[o] = preferred_num_override[o]

    possible_matches_f = open('./{}/possible_matches.json'.format(week), newline='')
    possible_matches = json.load(possible_matches_f)

    possible_minus_manual = prune_possible_matches(possible_matches, matched_ids, preferred_num)
    reward_matrix = create_reward_matrix(num_users, possible_minus_manual, id_to_idx)
    [row_idx, col_idx] = linear_sum_assignment(reward_matrix, maximize=True)
    print("bipartite output: %d" % len(row_idx))

    out_f = open('./{}/output.csv'.format(week), 'w', newline='')
    out_w = csv.writer(out_f)

    final = 0
    for (x, y) in zip(row_idx, col_idx):
        if reward_matrix[x][y] == 0:
            continue
        final += 1
        user_a_id = idx_to_id[x]
        user_b_id = idx_to_id[y]
        matched_ids[user_a_id] += 1
        matched_ids[user_b_id] += 1
        av = find_availability(possible_matches, user_a_id, user_b_id)
        out_w.writerow([names[user_a_id], names[user_b_id], user_a_id, user_b_id, json.dumps(av)])

    print("allowed matches: %d" %  final)

    unmatched_ids = set(id_to_idx.keys()).difference(set(matched_ids.keys()))
    print("unmatched: %d" % len(unmatched_ids))
    print()

    # second pass
    remaining_matches = prune_possible_matches(possible_minus_manual, matched_ids, preferred_num)
    reward_matrix2 = create_reward_matrix(num_users, remaining_matches, id_to_idx)
    [row_idx, col_idx] = linear_sum_assignment(reward_matrix2, maximize=True)
    print("bipartite output: %d" % len(row_idx))

    for (x, y) in zip(row_idx, col_idx):
        if reward_matrix2[x][y] == 0:
            continue
        final += 1
        user_a_id = idx_to_id[x]
        user_b_id = idx_to_id[y]
        matched_ids[user_a_id] += 1
        matched_ids[user_b_id] += 1
        out_w.writerow([names[user_a_id], names[user_b_id], user_a_id, user_b_id, json.dumps(av)])

    print("allowed matches: %d" %  final)
    unmatched_ids = set(id_to_idx.keys()).difference(set(matched_ids.keys()))
    print("unmatched: %d" % len(unmatched_ids))
    for id in unmatched_ids:
        print(names[id])


main("2021-03-21")
