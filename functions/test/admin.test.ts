import * as test from "firebase-functions-test";
// WARNING: this must come first or else imported modules may not see this config value on load
test().mockConfig({ twilio: { auth_token: "token" } })
import * as uuid from "uuid";
import { checkGenderPreference } from "../src/admin";
import { user } from "./mock";

const male = user(uuid.v4(), { gender: "Male" });
const female = user(uuid.v4(), { gender: "Female" });
const nonBinary = user(uuid.v4(), { gender: "Non-binary" });

it("checkGenderPreference - interested in men", () => {
    const u = user(uuid.v4(), { genderPreference: "Men" });
    expect(checkGenderPreference(u, male)).toEqual(true);
    expect(checkGenderPreference(u, female)).toEqual(false);
    expect(checkGenderPreference(u, nonBinary)).toEqual(false);
});

it("checkGenderPreference - interested in women", () => {
    const u = user(uuid.v4(), { genderPreference: "Women" });
    expect(checkGenderPreference(u, male)).toEqual(false);
    expect(checkGenderPreference(u, female)).toEqual(true);
    expect(checkGenderPreference(u, nonBinary)).toEqual(false);
});

it("checkGenderPreference - interested in everyone", () => {
    const u = user(uuid.v4(), { genderPreference: "Everyone" });
    expect(checkGenderPreference(u, male)).toEqual(true);
    expect(checkGenderPreference(u, female)).toEqual(true);
    expect(checkGenderPreference(u, nonBinary)).toEqual(true);
});
