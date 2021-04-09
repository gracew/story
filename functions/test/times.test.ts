import * as moment from "moment-timezone";
import { Timezone, videoTimeOptions } from "../src/times";

const getTimestamp = () => moment("2021-04-08T20:00:00-04:00");

it("videoTimeOptions PT PT", () => {
    const options = videoTimeOptions(Timezone.PT, Timezone.PT, getTimestamp);
    expect(options).toEqual([
        '2021-04-09T18:00:00-07:00',
        '2021-04-09T19:00:00-07:00',
        '2021-04-09T20:00:00-07:00',
        '2021-04-10T18:00:00-07:00',
        '2021-04-10T19:00:00-07:00',
        '2021-04-10T20:00:00-07:00',
        '2021-04-11T18:00:00-07:00',
        '2021-04-11T19:00:00-07:00',
        '2021-04-11T20:00:00-07:00',
    ])
});

it("videoTimeOptions PT CT", () => {
    const options = videoTimeOptions(Timezone.PT, Timezone.CT, getTimestamp);
    expect(options).toEqual([
        '2021-04-09T18:00:00-07:00',
        '2021-04-10T18:00:00-07:00',
        '2021-04-11T18:00:00-07:00',
    ])
});

it("videoTimeOptions PT ET", () => {
    const options = videoTimeOptions(Timezone.PT, Timezone.ET, getTimestamp);
    expect(options).toEqual([
        '2021-04-09T18:00:00-07:00',
        '2021-04-10T18:00:00-07:00',
        '2021-04-11T18:00:00-07:00',
    ])
});

it("videoTimeOptions CT CT", () => {
    const options = videoTimeOptions(Timezone.PT, Timezone.PT, getTimestamp);
    expect(options).toEqual([
        '2021-04-09T18:00:00-07:00',
        '2021-04-09T19:00:00-07:00',
        '2021-04-09T20:00:00-07:00',
        '2021-04-10T18:00:00-07:00',
        '2021-04-10T19:00:00-07:00',
        '2021-04-10T20:00:00-07:00',
        '2021-04-11T18:00:00-07:00',
        '2021-04-11T19:00:00-07:00',
        '2021-04-11T20:00:00-07:00',
    ])
});

it("videoTimeOptions CT ET", () => {
    const options = videoTimeOptions(Timezone.CT, Timezone.ET, getTimestamp);
    expect(options).toEqual([
        '2021-04-09T18:00:00-05:00',
        '2021-04-09T19:00:00-05:00',
        '2021-04-09T20:00:00-05:00',
        '2021-04-10T18:00:00-05:00',
        '2021-04-10T19:00:00-05:00',
        '2021-04-10T20:00:00-05:00',
        '2021-04-11T18:00:00-05:00',
        '2021-04-11T19:00:00-05:00',
        '2021-04-11T20:00:00-05:00',
    ])
});

it("videoTimeOptions ET ET", () => {
    const options = videoTimeOptions(Timezone.ET, Timezone.ET, getTimestamp);
    expect(options).toEqual([
        '2021-04-09T19:00:00-04:00',
        '2021-04-09T20:00:00-04:00',
        '2021-04-09T21:00:00-04:00',
        '2021-04-10T19:00:00-04:00',
        '2021-04-10T20:00:00-04:00',
        '2021-04-10T21:00:00-04:00',
        '2021-04-11T19:00:00-04:00',
        '2021-04-11T20:00:00-04:00',
        '2021-04-11T21:00:00-04:00',
    ])
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
