import { createHmac } from "node:crypto";
import {
  computeTotals,
  orderLabel,
  parseOrderLabel,
  PREPAID_DISCOUNT_PERCENT,
} from "@/lib/orders/pricing";
import { checkoutInput, verifyInput } from "@/lib/orders/schema";
import { tokenMatches } from "@/lib/orders/service";
import {
  MOCK_KEY_ID,
  MOCK_KEY_SECRET,
  getPaymentsConfig,
  isLocalSiteUrl,
  onlinePaymentAvailable,
} from "@/lib/payments/config";
import {
  PaymentProviderError,
  createProviderOrder,
  safeEqualHex,
  signPayment,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));

describe("computeTotals", () => {
  it("gives prepaid orders 10% off the subtotal and COD orders none", () => {
    expect(PREPAID_DISCOUNT_PERCENT).toBe(10);
    expect(computeTotals(179800, "RAZORPAY")).toEqual({
      subtotalPaise: 179800,
      discountPaise: 17980,
      shippingPaise: 0,
      totalPaise: 161820,
    });
    expect(computeTotals(179800, "COD")).toEqual({
      subtotalPaise: 179800,
      discountPaise: 0,
      shippingPaise: 0,
      totalPaise: 179800,
    });
  });
  it("only ever produces whole paise, rounding the discount to the nearest paisa", () => {
    for (const subtotal of [1, 5, 99, 12345, 89901, 129901, 1000001]) {
      const t = computeTotals(subtotal, "RAZORPAY");
      expect(Number.isInteger(t.discountPaise)).toBe(true);
      expect(Number.isInteger(t.totalPaise)).toBe(true);
      expect(t.totalPaise).toBe(t.subtotalPaise - t.discountPaise);
      expect(Math.abs(t.discountPaise - subtotal * 0.1)).toBeLessThanOrEqual(0.5);
    }
    expect(computeTotals(12345, "RAZORPAY").discountPaise).toBe(1235); // 1234.5 rounds up
  });
  it("never discounts below zero or charges shipping", () => {
    const t = computeTotals(0, "RAZORPAY");
    expect(t.totalPaise).toBe(0);
    expect(computeTotals(500000, "COD").shippingPaise).toBe(0);
  });
});

describe("order numbers", () => {
  it("formats and parses customer-facing order numbers", () => {
    expect(orderLabel(1001)).toBe("BB1001");
    expect(parseOrderLabel("BB1001")).toBe(1001);
    expect(parseOrderLabel("bb1001")).toBe(1001);
    expect(parseOrderLabel("1001")).toBe(1001);
  });
  it.each(["", "BB", "BBabc", "10 01", "-5", "1001; DROP", "BB1001x", "1".repeat(12)])(
    "rejects %j",
    (bad) => {
      expect(parseOrderLabel(bad)).toBeNull();
    },
  );
});

describe("checkoutInput", () => {
  const base = {
    idempotencyKey: "0b8d6a52-6d3f-4a49-9a0c-3c1e0f1c2d3e",
    paymentMethod: "COD",
    email: "  Asha@Example.COM ",
    phone: "+91 98765-43210",
    address: {
      fullName: "Asha Verma",
      phone: "98765 43210",
      line1: "12 Mansarovar Colony",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302020",
    },
  };

  it("accepts a good request and normalises email and phone numbers", () => {
    const r = checkoutInput.parse(base);
    expect(r.email).toBe("asha@example.com");
    expect(r.phone).toBe("9876543210");
    expect(r.address?.phone).toBe("9876543210");
  });
  it("accepts a saved address id instead of a typed address", () => {
    const { address: _a, ...rest } = base;
    void _a;
    expect(checkoutInput.safeParse({ ...rest, addressId: "addr_1" }).success).toBe(true);
  });
  it("needs exactly one of a saved address or a typed address", () => {
    const { address: _a, ...rest } = base;
    void _a;
    expect(checkoutInput.safeParse(rest).success).toBe(false);
    expect(checkoutInput.safeParse({ ...base, addressId: "addr_1" }).success).toBe(false);
  });
  it("refuses any attempt to send prices, totals or discounts", () => {
    for (const extra of [
      { totalPaise: 1 },
      { total: 1 },
      { subtotalPaise: 100 },
      { discountPaise: 99999 },
      { items: [] },
      { userId: "x" },
      { status: "CONFIRMED" },
    ]) {
      expect(checkoutInput.safeParse({ ...base, ...extra }).success).toBe(false);
    }
    expect(
      checkoutInput.safeParse({ ...base, address: { ...base.address, price: 1 } }).success,
    ).toBe(false);
  });
  it.each([
    ["idempotencyKey", "not-a-uuid"],
    ["paymentMethod", "BITCOIN"],
    ["paymentMethod", undefined],
    ["email", "nope"],
    ["email", ""],
    ["phone", "12345"],
  ])("rejects %s = %j", (field, value) => {
    expect(checkoutInput.safeParse({ ...base, [field]: value }).success).toBe(false);
  });
  it("validates the typed address like the account address form does", () => {
    for (const [k, v] of [
      ["pincode", "12"],
      ["state", "Atlantis"],
      ["phone", "1"],
      ["fullName", "A"],
    ] as const) {
      expect(
        checkoutInput.safeParse({ ...base, address: { ...base.address, [k]: v } }).success,
      ).toBe(false);
    }
  });
});

describe("verifyInput", () => {
  it("is strict about shape", () => {
    const ok = {
      orderNumber: 1001,
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "abc",
    };
    expect(verifyInput.safeParse(ok).success).toBe(true);
    expect(verifyInput.safeParse({ ...ok, orderNumber: "1001" }).success).toBe(false);
    expect(verifyInput.safeParse({ ...ok, amount: 1 }).success).toBe(false);
    expect(verifyInput.safeParse({ ...ok, razorpay_signature: "" }).success).toBe(false);
  });
});

describe("tokenMatches", () => {
  it("accepts only the exact token", () => {
    expect(tokenMatches("secret-token", "secret-token")).toBe(true);
    expect(tokenMatches("secret-token", "secret-tokeN")).toBe(false);
    expect(tokenMatches("secret-token", "secret")).toBe(false);
    expect(tokenMatches("secret-token", "")).toBe(false);
    expect(tokenMatches("secret-token", undefined)).toBe(false);
    expect(tokenMatches("secret-token", null)).toBe(false);
  });
});

describe("payment configuration", () => {
  it("uses real Razorpay whenever both keys are set", () => {
    const c = getPaymentsConfig({ RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "shh" });
    expect(c).toEqual({ mode: "live", keyId: "rzp_test_abc", keySecret: "shh" });
  });
  it("real keys win over the mock switch", () => {
    const c = getPaymentsConfig({
      RAZORPAY_KEY_ID: "k",
      RAZORPAY_KEY_SECRET: "s",
      PAYMENTS_MOCK: "true",
      BETTER_AUTH_URL: "http://localhost:3000",
    });
    expect(c.mode).toBe("live");
  });
  it("allows the mock only with the flag AND a localhost site address", () => {
    expect(
      getPaymentsConfig({ PAYMENTS_MOCK: "true", BETTER_AUTH_URL: "http://localhost:3000" }),
    ).toEqual({
      mode: "mock",
      keyId: MOCK_KEY_ID,
      keySecret: MOCK_KEY_SECRET,
    });
    expect(
      getPaymentsConfig({ PAYMENTS_MOCK: "true", BETTER_AUTH_URL: "http://127.0.0.1:3000" }).mode,
    ).toBe("mock");
    expect(
      getPaymentsConfig({
        PAYMENTS_MOCK: "true",
        NEXT_PUBLIC_APP_URL: "http://shop.localhost:3000",
      }).mode,
    ).toBe("mock");
  });
  it("can never switch the mock on for a real website", () => {
    for (const url of [
      "https://theblockbagru.com",
      "https://localhost.evil.com",
      "http://evil.com/localhost",
      "not a url",
      undefined,
      "",
    ]) {
      expect(getPaymentsConfig({ PAYMENTS_MOCK: "true", BETTER_AUTH_URL: url }).mode).toBe(
        "unconfigured",
      );
    }
  });
  it("does not turn on for any value other than exactly 'true'", () => {
    for (const v of ["TRUE", "1", "yes", "false", ""]) {
      expect(
        getPaymentsConfig({ PAYMENTS_MOCK: v, BETTER_AUTH_URL: "http://localhost:3000" }).mode,
      ).toBe("unconfigured");
    }
  });
  it("treats blank or half-set keys as not configured", () => {
    expect(getPaymentsConfig({ RAZORPAY_KEY_ID: "k" }).mode).toBe("unconfigured");
    expect(getPaymentsConfig({ RAZORPAY_KEY_ID: "  ", RAZORPAY_KEY_SECRET: "  " }).mode).toBe(
      "unconfigured",
    );
    expect(onlinePaymentAvailable({})).toBe(false);
    expect(onlinePaymentAvailable({ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" })).toBe(true);
  });
  it("recognises localhost urls", () => {
    expect(isLocalSiteUrl("http://localhost:3000")).toBe(true);
    expect(isLocalSiteUrl("https://example.com")).toBe(false);
  });
});

describe("payment signatures", () => {
  const secret = "test-secret";
  const sign = (data: string) => createHmac("sha256", secret).update(data).digest("hex");

  it("signs '<order>|<payment>' with HMAC-SHA256, as Razorpay documents", () => {
    expect(signPayment("order_123", "pay_456", secret)).toBe(sign("order_123|pay_456"));
  });
  it("accepts the right signature and rejects every kind of tampering", () => {
    const good = sign("order_123|pay_456");
    const check = (o: string, p: string, s: string, sec = secret) =>
      verifyPaymentSignature({ orderId: o, paymentId: p, signature: s }, sec);
    expect(check("order_123", "pay_456", good)).toBe(true);
    expect(check("order_123", "pay_456", good.toUpperCase())).toBe(true); // hex is case-insensitive
    expect(check("order_124", "pay_456", good)).toBe(false);
    expect(check("order_123", "pay_457", good)).toBe(false);
    expect(check("order_123", "pay_456", good.slice(0, -2) + "00")).toBe(false);
    expect(check("order_123", "pay_456", good, "other-secret")).toBe(false);
    expect(check("order_123", "pay_456", "")).toBe(false);
    expect(check("order_123", "pay_456", "not-hex!")).toBe(false);
    expect(check("order_123", "pay_456", good + "00")).toBe(false);
  });
  it("safeEqualHex rejects odd input without throwing", () => {
    expect(safeEqualHex("ab", "ab")).toBe(true);
    expect(safeEqualHex("ab", "abcd")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
  });
  it("verifies webhooks over the exact raw body", () => {
    const body = '{"event":"payment.captured","payload":{}}';
    const sig = sign(body);
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false); // one extra byte
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "")).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef", secret)).toBe(false);
  });
});

describe("createProviderOrder", () => {
  const live = { mode: "live", keyId: "rzp_test_key", keySecret: "rzp_secret" } as const;
  const mock = { mode: "mock", keyId: MOCK_KEY_ID, keySecret: MOCK_KEY_SECRET } as const;
  const okResponse = (body: unknown) =>
    ({ ok: true, status: 200, json: async () => body, text: async () => "" }) as Response;

  it("mock mode makes a fake order id and never calls the network", async () => {
    const f = vi.fn();
    const o = await createProviderOrder({ amountPaise: 12300, receipt: "r1" }, mock, f as never);
    expect(o).toMatchObject({ amountPaise: 12300, currency: "INR" });
    expect(o.id).toMatch(/^order_mock_[0-9a-f]{18}$/);
    expect(f).not.toHaveBeenCalled();
  });
  it("live mode sends the amount in paise to Razorpay with basic auth", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(okResponse({ id: "order_abc", amount: 161820, currency: "INR" }));
    const o = await createProviderOrder(
      { amountPaise: 161820, receipt: "a".repeat(60), notes: { order: "1001" } },
      live,
      f as never,
    );
    expect(o).toEqual({ id: "order_abc", amountPaise: 161820, currency: "INR" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("rzp_test_key:rzp_secret").toString("base64")}`,
    );
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      amount: 161820,
      currency: "INR",
      receipt: "a".repeat(40),
      notes: { order: "1001" },
    });
  });
  it("refuses tiny or fractional amounts before calling anyone", async () => {
    const f = vi.fn();
    for (const amountPaise of [0, 99, -500, 1000.5, Number.NaN]) {
      await expect(
        createProviderOrder({ amountPaise, receipt: "r" }, live, f as never),
      ).rejects.toBeInstanceOf(PaymentProviderError);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("turns provider errors into a safe message that does not leak details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Authentication failed: key rzp_test_key",
    });
    const err = await createProviderOrder(
      { amountPaise: 5000, receipt: "r" },
      live,
      f as never,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentProviderError);
    expect(err.message).not.toMatch(/rzp_|Authentication|401/);
    spy.mockRestore();
  });
  it("handles network failure and a surprising answer", async () => {
    const down = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      createProviderOrder({ amountPaise: 5000, receipt: "r" }, live, down as never),
    ).rejects.toThrow(/couldn't reach/);
    const wrong = vi
      .fn()
      .mockResolvedValue(okResponse({ id: "order_x", amount: 1, currency: "INR" }));
    await expect(
      createProviderOrder({ amountPaise: 5000, receipt: "r" }, live, wrong as never),
    ).rejects.toThrow(/unexpected/);
  });
});
