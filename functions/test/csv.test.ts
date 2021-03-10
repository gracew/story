import * as test from "firebase-functions-test";
import { processBulkSmsCsv } from "../src/csv";
import { TWILIO_NUMBER } from "../src/twilio";
test().mockConfig({ twilio: { auth_token: "token" } });

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
