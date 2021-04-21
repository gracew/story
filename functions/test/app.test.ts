import * as test from "firebase-functions-test";
// WARNING: this must come first or else imported modules may not see this config value on load
test().mockConfig({ twilio: { auth_token: "token" } });
import { firstCommonAvailability, swapNumbers } from "../src/app";

it("swapNumbers", () => {
    expect(swapNumbers({ a: { swapNumbers: true }, b: { swapNumbers: true }})).toEqual(true);
    expect(swapNumbers({ a: { swapNumbers: false }, b: { swapNumbers: true }})).toEqual(false);
    expect(swapNumbers({ a: { swapNumbers: true }, b: { swapNumbers: false }})).toEqual(false);
    expect(swapNumbers({ a: { swapNumbers: false }, b: { swapNumbers: false }})).toEqual(false);
});

it("firstCommonAvailability", () => {
    const av1 = [
        "2021-04-17T18:00:00-07:00",
        "2021-04-17T19:00:00-07:00",
        "2021-04-17T20:00:00-07:00",
        "2021-04-18T20:00:00-07:00",
    ];
    const av2 = [
        "2021-04-16T20:00:00-07:00",
        "2021-04-17T20:00:00-07:00",
        "2021-04-18T20:00:00-07:00",
    ];
    expect(firstCommonAvailability(av1, av2)).toEqual("2021-04-17T20:00:00-07:00");
});

it("firstCommonAvailability - diff time zones", () => {
    const av1 = [
        "2021-04-17T18:00:00-05:00",
        "2021-04-17T19:00:00-05:00",
        "2021-04-17T20:00:00-05:00",
        "2021-04-18T20:00:00-05:00",
    ];
    const av2 = [
        "2021-04-16T20:00:00-04:00",
        "2021-04-17T20:00:00-04:00",
        "2021-04-18T20:00:00-04:00",
    ];
    expect(firstCommonAvailability(av1, av2)).toEqual("2021-04-17T20:00:00-04:00");
});

it("firstCommonAvailability - none", () => {
    const av1 = [
        "2021-04-17T18:00:00-07:00",
        "2021-04-17T19:00:00-07:00",
    ];
    const av2 = [
        "2021-04-17T20:00:00-07:00",
        "2021-04-18T20:00:00-07:00",
    ];
    expect(firstCommonAvailability(av1, av2)).toBeUndefined();
});
