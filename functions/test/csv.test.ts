import * as test from "firebase-functions-test";
test().mockConfig({ twilio: { auth_token: "token" } });
import { processBulkSmsCsv } from "../src/csv";

const mockSendSms = jest.fn();
beforeEach(() => jest.resetAllMocks());

it("processBulkSmsCsv", async () => {
    await processBulkSmsCsv("./testdata/bulkSms.csv", mockSendSms)
    expect(mockSendSms).toHaveBeenCalledTimes(2);
    const body1 = `Your match will expire soon! If you'd like to connect this week, please reply in the next hour and let us know which days work for you for an 8pm call.

another line
`
    expect(mockSendSms).toHaveBeenCalledWith({ body: body1, to: "+1234567890" })
    expect(mockSendSms).toHaveBeenCalledWith({ body: "another message", to: "+10123456789" })
});
