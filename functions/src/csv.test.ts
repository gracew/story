import { processAvailabilityCsv, processBulkSmsCsv, processMatchCsv } from "./csv";
import { client, TWILIO_NUMBER } from "./twilio";

// TODO(gracew): pass around the twilio client explicitly to avoid this
jest.mock("twilio", () => {
    return jest.fn().mockImplementation(() => {
        return { messages: { create: jest.fn() } };
    })
});

beforeEach(() => jest.resetAllMocks());

it("processBulkSmsCsv", async () => {
    processBulkSmsCsv("./testdata/bulkSms.csv")
    // wait 200ms, TODO(gracew): fix this
    await new Promise(r => setTimeout(r, 200));
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    const body1 = `Your Voicebar match will expire soon! If you'd like to connect this week, please reply in the next hour and let us know which days work for you for an 8pm call.

another line
`
    expect(client.messages.create).toHaveBeenCalledWith({ body: body1, from: TWILIO_NUMBER, to: "+1234567890" })
    expect(client.messages.create).toHaveBeenCalledWith({ body: "another message", from: TWILIO_NUMBER, to: "+10123456789" })
});

it("processAvailabilityCsv", async () => {
    const user1 = { exists: true, firstName: "Anna", phone: "+1234567890" };
    const user2 = { exists: true, firstName: "Grace", phone: "+10123456789" };
    const firestore = {
        getUser: jest.fn()
            .mockResolvedValue(user1)
            .mockResolvedValueOnce(user1)
            .mockResolvedValueOnce(user2),
        createMatch: jest.fn(),
    }
    processAvailabilityCsv("./testdata/availability.csv", firestore)
    // wait 200ms, TODO(gracew): fix this
    // await new Promise(r => setTimeout(r, 200));
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(client.messages.create).toHaveBeenCalledWith({
        body: "Hi Anna. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm ET any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.",
        from: TWILIO_NUMBER,
        to: user1.phone,
    })
    expect(client.messages.create).toHaveBeenCalledWith({
        body: "Hi Grace. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm PT any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.",
        from: TWILIO_NUMBER,
        to: user2.phone,
    })
});


it("processMatchCsv", async () => {
    const firestore = {
        getUser: jest.fn().mockResolvedValue({ exists: true }),
        createMatch: jest.fn(),
    }
    processMatchCsv("./testdata/matches.csv", firestore)
    // wait 200ms, TODO(gracew): fix this
    await new Promise(r => setTimeout(r, 200));
    expect(firestore.createMatch).toHaveBeenCalledTimes(2);
    expect(firestore.createMatch).toHaveBeenCalledWith({
        user_a_id: "UqS4ivx8v9xcUcrAKt3B",
        user_b_id: "wz931t4yTP2F5xvOW0QI",
        user_ids: ["UqS4ivx8v9xcUcrAKt3B", "wz931t4yTP2F5xvOW0QI"],
        created_at: new Date("2020-09-23T20:00:00-04:00"),
    })
    expect(firestore.createMatch).toHaveBeenCalledWith({
        user_a_id: "oS89cjnV1wRP5kKvHGoP",
        user_b_id: "zV4nHElSwPWNvFP0aVYs",
        user_ids: ["oS89cjnV1wRP5kKvHGoP", "zV4nHElSwPWNvFP0aVYs"],
        created_at: new Date("2020-09-23T20:00:00-07:00"),
    })
});
