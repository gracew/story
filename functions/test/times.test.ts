import * as moment from "moment-timezone";
import { Timezone, videoTimeOptions } from "../src/times";

const getTimestamp = () => moment("2021-04-08T20:00:00-04:00");

it("videoTimeOptions PT with PT, MT", () => {
    const options = [
        '2021-04-09T18:00:00-07:00',
        '2021-04-09T19:00:00-07:00',
        '2021-04-09T20:00:00-07:00',
        '2021-04-10T18:00:00-07:00',
        '2021-04-10T19:00:00-07:00',
        '2021-04-10T20:00:00-07:00',
        '2021-04-11T18:00:00-07:00',
        '2021-04-11T19:00:00-07:00',
        '2021-04-11T20:00:00-07:00',
    ];
    expect(videoTimeOptions(Timezone.PT, Timezone.PT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.PT, Timezone.MT, getTimestamp)).toEqual(options);
});

it("videoTimeOptions PT with CT, ET", () => {
    const options = [
        '2021-04-09T18:00:00-07:00',
        '2021-04-10T18:00:00-07:00',
        '2021-04-11T18:00:00-07:00',
    ];
    expect(videoTimeOptions(Timezone.PT, Timezone.CT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.PT, Timezone.ET, getTimestamp)).toEqual(options);
});

it("videoTimeOptions MT with PT, MT", () => {
    const options = [
        '2021-04-09T19:00:00-06:00',
        '2021-04-09T20:00:00-06:00',
        '2021-04-09T21:00:00-06:00',
        '2021-04-10T19:00:00-06:00',
        '2021-04-10T20:00:00-06:00',
        '2021-04-10T21:00:00-06:00',
        '2021-04-11T19:00:00-06:00',
        '2021-04-11T20:00:00-06:00',
        '2021-04-11T21:00:00-06:00',
    ];
    expect(videoTimeOptions(Timezone.MT, Timezone.PT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.MT, Timezone.MT, getTimestamp)).toEqual(options);
});

it("videoTimeOptions MT with CT, ET", () => {
    const options = [
        '2021-04-09T19:00:00-06:00',
        '2021-04-10T19:00:00-06:00',
        '2021-04-11T19:00:00-06:00',
    ];
    expect(videoTimeOptions(Timezone.MT, Timezone.CT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.MT, Timezone.ET, getTimestamp)).toEqual(options);
});

it("videoTimeOptions CT with PT, MT", () => {
    const options = [
        '2021-04-09T20:00:00-05:00',
        '2021-04-10T20:00:00-05:00',
        '2021-04-11T20:00:00-05:00',
    ];
    expect(videoTimeOptions(Timezone.CT, Timezone.PT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.CT, Timezone.MT, getTimestamp)).toEqual(options);
});

it("videoTimeOptions CT with CT, ET", () => {
    const options = [
        '2021-04-09T18:00:00-05:00',
        '2021-04-09T19:00:00-05:00',
        '2021-04-09T20:00:00-05:00',
        '2021-04-10T18:00:00-05:00',
        '2021-04-10T19:00:00-05:00',
        '2021-04-10T20:00:00-05:00',
        '2021-04-11T18:00:00-05:00',
        '2021-04-11T19:00:00-05:00',
        '2021-04-11T20:00:00-05:00',
    ];
    expect(videoTimeOptions(Timezone.CT, Timezone.CT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.CT, Timezone.ET, getTimestamp)).toEqual(options);
});

it("videoTimeOptions ET with PT, MT", () => {
    const options = [
        '2021-04-09T21:00:00-04:00',
        '2021-04-10T21:00:00-04:00',
        '2021-04-11T21:00:00-04:00',
    ];
    expect(videoTimeOptions(Timezone.ET, Timezone.PT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.ET, Timezone.MT, getTimestamp)).toEqual(options);
});

it("videoTimeOptions ET with CT, ET", () => {
    const options = [
        '2021-04-09T19:00:00-04:00',
        '2021-04-09T20:00:00-04:00',
        '2021-04-09T21:00:00-04:00',
        '2021-04-10T19:00:00-04:00',
        '2021-04-10T20:00:00-04:00',
        '2021-04-10T21:00:00-04:00',
        '2021-04-11T19:00:00-04:00',
        '2021-04-11T20:00:00-04:00',
        '2021-04-11T21:00:00-04:00',
    ];
    expect(videoTimeOptions(Timezone.ET, Timezone.CT, getTimestamp)).toEqual(options);
    expect(videoTimeOptions(Timezone.ET, Timezone.ET, getTimestamp)).toEqual(options);
});

it("videoTimeOptions when called on Saturday", () => {
    // previously the code assumed this would only be called Tue-Fri
    const options = videoTimeOptions(Timezone.PT, Timezone.ET, () => moment("2021-04-10T20:00:00-04:00"));
    expect(options).toEqual([
        '2021-04-11T18:00:00-07:00',
        '2021-04-12T18:00:00-07:00',
        '2021-04-13T18:00:00-07:00',
    ])
});
