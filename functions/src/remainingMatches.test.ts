import { generateRemainingMatchCount } from "./remainingMatches";

it("test airtable", async () => {
    const res = await generateRemainingMatchCount();
    console.log(res);
});
