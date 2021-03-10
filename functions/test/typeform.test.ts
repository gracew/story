import * as moment from "moment-timezone";
import { parseAvailability } from "../src/typeform";

const getTimestamp = () => moment("2021-03-10");

it("parseAvailability ET", () => {
    const answers = [
        { field: { ref: "matches" }, choice: { label: "2" } },
        {
            field: { ref: "timesET" },
            choices: {
                labels: ["Tue 7pm", "Wed 8pm", "Thu 9pm"],
            }
        }
    ];
    expect(parseAvailability(answers, getTimestamp)).toEqual({
        "interactions.responded": true,
        skip: false,
        matches: 2,
        available: [
            new Date("2021-03-10T00:00:00.000Z"),
            new Date("2021-03-11T01:00:00.000Z"),
            new Date("2021-03-12T02:00:00.000Z"),
        ],
    });
});

it("parseAvailability CT", () => {
    const answers = [
        { field: { ref: "matches" }, choice: { label: "2" } },
        {
            field: { ref: "timesCT" },
            choices: {
                labels: ["Tue 6pm", "Wed 7pm", "Thu 8pm"],
            }
        }
    ];
    expect(parseAvailability(answers, getTimestamp)).toEqual({
        "interactions.responded": true,
        skip: false,
        matches: 2,
        available: [
            new Date("2021-03-10T00:00:00.000Z"),
            new Date("2021-03-11T01:00:00.000Z"),
            new Date("2021-03-12T02:00:00.000Z"),
        ],
    });
});

it("parseAvailability PT", () => {
    const answers = [
        { field: { ref: "matches" }, choice: { label: "2" } },
        {
            field: { ref: "timesPT" },
            choices: {
                labels: ["Tue 6pm", "Wed 7pm", "Thu 8pm"],
            }
        }
    ];
    expect(parseAvailability(answers, getTimestamp)).toEqual({
        "interactions.responded": true,
        skip: false,
        matches: 2,
        available: [
            new Date("2021-03-10T02:00:00.000Z"),
            new Date("2021-03-11T03:00:00.000Z"),
            new Date("2021-03-12T04:00:00.000Z"),
        ],
    });
});

it("parseAvailability unknown time", () => {
    const answers = [
        { field: { ref: "matches" }, choice: { label: "2" } },
        {
            field: { ref: "timesPT" },
            choices: {
                labels: ["Tue 5pm", "Wed 7pm"],
            }
        }
    ];
    expect(parseAvailability(answers, getTimestamp)).toEqual({
        "interactions.responded": true,
        skip: false,
        matches: 2,
        available: [
            new Date("2021-03-11T03:00:00.000Z"),
        ],
    });
});


it("parseAvailability skip", async () => {
    const answers = [
        { field: { ref: "matches" }, choice: { label: "Skip this week" } },
    ];
    expect(parseAvailability(answers, getTimestamp)).toEqual({
        "interactions.responded": true,
        skip: true,
        matches: 0,
        available: [],
    });
});