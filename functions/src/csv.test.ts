import * as twilio from "twilio";
import { processBulkSmsCsv } from "./csv";

jest.mock("twilio", () => {
    return jest.fn().mockImplementation(() => {
        return { messages: { create: jest.fn() } };
    })
});

it("bulkSms", async () => {
    // @ts-ignore
    // twilio.Twilio.prototype.messages = { create: mockSms };
    const mockTwilio = twilio("accountSid", "token");
    await processBulkSmsCsv("./testdata/bulkSms.csv", mockTwilio)
    expect(mockTwilio.messages.create).toHaveBeenCalledTimes(2);
});

it("createMatches", () => {
});
