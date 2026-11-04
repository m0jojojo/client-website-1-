import { addressInput, addressPatch, normalizePhone } from "@/lib/account/address-schema";
import { INDIAN_STATES } from "@/lib/account/states";
import { safeNextPath } from "@/lib/safe-redirect";
import { signCookieValue } from "../helpers/test-user";

const valid = {
  fullName: "Asha Verma",
  phone: "98765 43210",
  line1: "12 Mansarovar Colony",
  line2: "",
  landmark: "  ",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302020",
};

describe("safeNextPath", () => {
  it("allows normal in-site paths, keeping query and hash", () => {
    expect(safeNextPath("/account/addresses")).toBe("/account/addresses");
    expect(safeNextPath("/collections/all?sort=price-asc#top")).toBe(
      "/collections/all?sort=price-asc#top",
    );
  });
  it.each([
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/\u0000x",
    "/ok\nHost: evil",
    "",
    "x".repeat(400),
  ])("rejects %j", (bad) => {
    expect(safeNextPath(bad)).toBe("/account");
  });
  it("handles missing values and custom fallbacks", () => {
    expect(safeNextPath(undefined)).toBe("/account");
    expect(safeNextPath(null, "/")).toBe("/");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["98765 43210", "9876543210"],
    ["+91 98765-43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["(98765) 43210", "9876543210"],
  ])("%s -> %s", (input, out) => expect(normalizePhone(input)).toBe(out));
});

describe("address validation", () => {
  it("accepts a good address, normalising phone and dropping blank optional fields", () => {
    const r = addressInput.parse(valid);
    expect(r.phone).toBe("9876543210");
    expect(r.line2).toBeUndefined();
    expect(r.landmark).toBeUndefined();
    expect(r.fullName).toBe("Asha Verma");
  });
  it.each([
    ["fullName", "A"],
    ["phone", "12345"],
    ["phone", "5876543210"],
    ["line1", "ab"],
    ["city", ""],
    ["state", "Atlantis"],
    ["state", ""],
    ["pincode", "012345"],
    ["pincode", "12345"],
    ["pincode", "12345a"],
  ])("rejects %s = %j", (field, value) => {
    expect(addressInput.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
  it("rejects unknown fields (no mass assignment of userId or id)", () => {
    expect(addressInput.safeParse({ ...valid, userId: "someone-else" }).success).toBe(false);
    expect(addressPatch.safeParse({ id: "x" }).success).toBe(false);
  });
  it("patch allows partial updates but still validates what is sent", () => {
    expect(addressPatch.safeParse({ isDefault: true }).success).toBe(true);
    expect(addressPatch.safeParse({ city: "Udaipur" }).success).toBe(true);
    expect(addressPatch.safeParse({ pincode: "bad" }).success).toBe(false);
  });
  it("covers all 28 states and 8 union territories", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
  });
});

describe("test cookie signing (matches Better Auth's format)", () => {
  it("is url-encoded token.signature", () => {
    const v = signCookieValue("abc", "secret");
    const [token, sig] = decodeURIComponent(v).split(".");
    expect(token).toBe("abc");
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
