import * as test from "firebase-functions-test";
test().mockConfig({ twilio: { auth_token: "token" } });
import { processAvailabilityCsv, processBulkSmsCsv, processMatchCsv } from "../src/csv";
import { firestore, match, user } from "./mock";
import { TWILIO_NUMBER } from "../src/twilio";

const mockSendSms = jest.fn();
beforeEach(() => jest.resetAllMocks());

it("processBulkSmsCsv", async () => {
    await processBulkSmsCsv("./testdata/bulkSms.csv", mockSendSms)
    expect(mockSendSms).toHaveBeenCalledTimes(2);
    const body1 = `Your match will expire soon! If you'd like to connect this week, please reply in the next hour and let us know which days work for you for an 8pm call.

another line
`
    expect(mockSendSms).toHaveBeenCalledWith({ body: body1, from: TWILIO_NUMBER, to: "+1234567890" })
    expect(mockSendSms).toHaveBeenCalledWith({ body: "another message", from: TWILIO_NUMBER, to: "+10123456789" })
});

it("processAvailabilityCsv", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    firestore.getUser = jest.fn()
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);
    await processAvailabilityCsv("./testdata/availability.csv", firestore, mockSendSms)
    expect(mockSendSms).toHaveBeenCalledTimes(2);
    expect(mockSendSms).toHaveBeenCalledWith({
        body: "Hi Anna. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm ET any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.",
        from: TWILIO_NUMBER,
        to: user1.phone,
    })
    expect(mockSendSms).toHaveBeenCalledWith({
        body: "Hi Grace. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm PT any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.",
        from: TWILIO_NUMBER,
        to: user2.phone,
    })
});


it("processMatchCsv", async () => {
    const { id: id1, ...match1 } = match("UqS4ivx8v9xcUcrAKt3B", "wz931t4yTP2F5xvOW0QI", "2020-09-23T20:00:00-04:00");
    const { id: id2, ...match2 } = match("oS89cjnV1wRP5kKvHGoP", "zV4nHElSwPWNvFP0aVYs", "2020-09-23T20:00:00-07:00");
    firestore.getUser.mockResolvedValue({ exists: true });
    firestore.getUsersForMatches.mockResolvedValue({
        UqS4ivx8v9xcUcrAKt3B: {},
        wz931t4yTP2F5xvOW0QI: {},
        oS89cjnV1wRP5kKvHGoP: {},
        zV4nHElSwPWNvFP0aVYs: {},
    })
    await processMatchCsv("./testdata/matches.csv", firestore, mockSendSms)
    expect(firestore.createMatch).toHaveBeenCalledTimes(2);
    expect(firestore.createMatch).toHaveBeenCalledWith(match1)
    expect(firestore.createMatch).toHaveBeenCalledWith(match2)
    expect(mockSendSms).toHaveBeenCalledTimes(4);
});

it("processMatchCsv - multiple dates", async () => {
    const { id: id1, ...match1 } = match("UqS4ivx8v9xcUcrAKt3B", "wz931t4yTP2F5xvOW0QI", "2020-09-23T20:00:00-04:00");
    const { id: id2, ...match2 } = match("UqS4ivx8v9xcUcrAKt3B", "zV4nHElSwPWNvFP0aVYs", "2020-09-23T20:00:00-07:00");
    firestore.getUser.mockResolvedValue({ exists: true });
    firestore.getUsersForMatches.mockResolvedValue({
        UqS4ivx8v9xcUcrAKt3B: {},
        wz931t4yTP2F5xvOW0QI: {},
        zV4nHElSwPWNvFP0aVYs: {},
    })
    await processMatchCsv("./testdata/matchesMultipleDates.csv", firestore, mockSendSms)
    expect(firestore.createMatch).toHaveBeenCalledTimes(2);
    expect(firestore.createMatch).toHaveBeenCalledWith(match1)
    expect(firestore.createMatch).toHaveBeenCalledWith(match2)
    expect(mockSendSms).toHaveBeenCalledTimes(3);
});

it("processMatchCsv - multiple texts per user", async () => {
    const { id: id1, ...match1 } = match("UqS4ivx8v9xcUcrAKt3B", "wz931t4yTP2F5xvOW0QI", "2020-09-23T20:00:00-04:00");
    const { id: id2, ...match2 } = match("UqS4ivx8v9xcUcrAKt3B", "zV4nHElSwPWNvFP0aVYs", "2020-09-23T20:00:00-07:00");
    firestore.getUser.mockResolvedValue({ exists: true });
    firestore.getUsersForMatches.mockResolvedValue({
        UqS4ivx8v9xcUcrAKt3B: { funFacts: "funFacts" },
        wz931t4yTP2F5xvOW0QI: { funFacts: "funFacts" },
        zV4nHElSwPWNvFP0aVYs: { funFacts: "funFacts" },
    })
    await processMatchCsv("./testdata/matchesMultipleDates.csv", firestore, mockSendSms)
    expect(firestore.createMatch).toHaveBeenCalledTimes(2);
    expect(firestore.createMatch).toHaveBeenCalledWith(match1)
    expect(firestore.createMatch).toHaveBeenCalledWith(match2)
    expect(mockSendSms).toHaveBeenCalledTimes(7);
});
