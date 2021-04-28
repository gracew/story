import * as test from "firebase-functions-test";
// WARNING: this must come first or else imported modules may not see this config value on load
test().mockConfig({ twilio: { auth_token: "token" } });
import * as uuid from "uuid";
import { firstCommonAvailability, videoNextStep } from "../src/app";
import { match, user } from "./mock";

const userA = user(uuid.v4());
const userB = user(uuid.v4());
const mockSendSms = jest.fn();
beforeEach(() => jest.resetAllMocks());

it("videoNextStep - match", async () => {
  const time = "2021-04-17T20:00:00-07:00";
  const videoAvailability = {
    [userA.id]: { selectedTimes: [time] },
    [userB.id]: { selectedTimes: [time] },
  };
  const m = match(userA.id, userB.id, "2021-04-17T20:00:00-07:00", {
    videoAvailability,
  });
  const res = await videoNextStep(userA, userB, m, mockSendSms);
  expect(res).toEqual({
    userAId: userA.id,
    userBId: userB.id,
    time: new Date(time),
    notified: true,
    mode: "video",
  });
  expect(mockSendSms).toHaveBeenCalledTimes(2);
  expect(mockSendSms.mock.calls[0][0].to).toEqual(userA.phone);
  expect(mockSendSms.mock.calls[0][0].body).toContain(
    "you'll be speaking again"
  );
  expect(mockSendSms.mock.calls[1][0].to).toEqual(userB.phone);
  expect(mockSendSms.mock.calls[1][0].body).toContain(
    "you'll be speaking again"
  );
});

it("videoNextStep - swap numbers", async () => {
  const videoAvailability = {
    [userA.id]: { selectedTimes: [], swapNumbers: true },
    [userB.id]: { selectedTimes: [], swapNumbers: true },
  };
  const m = match(userA.id, userB.id, "2021-04-17T20:00:00-07:00", {
    videoAvailability,
  });
  const res = await videoNextStep(userA, userB, m, mockSendSms);
  expect(res).toBeUndefined();
  expect(mockSendSms).toHaveBeenCalledTimes(2);
  expect(mockSendSms.mock.calls[0][0].to).toEqual(userA.phone);
  expect(mockSendSms.mock.calls[0][0].body).toContain("swap numbers");
  expect(mockSendSms.mock.calls[1][0].to).toEqual(userB.phone);
  expect(mockSendSms.mock.calls[1][0].body).toContain("swap numbers");
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
  expect(firstCommonAvailability(av1, av2)).toEqual(
    "2021-04-17T20:00:00-07:00"
  );
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
  expect(firstCommonAvailability(av1, av2)).toEqual(
    "2021-04-17T20:00:00-04:00"
  );
});

it("firstCommonAvailability - none", () => {
  const av1 = ["2021-04-17T18:00:00-07:00", "2021-04-17T19:00:00-07:00"];
  const av2 = ["2021-04-17T20:00:00-07:00", "2021-04-18T20:00:00-07:00"];
  expect(firstCommonAvailability(av1, av2)).toBeUndefined();
});
