import { afterEach, expect, test, vi } from "vite-plus/test";

import {
  printConfig,
  printCouponList,
  printDailyStatistics,
  printEntitlements,
  printOrderList,
  printProductList,
} from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("printProductList writes JSON when json mode is enabled", () => {
  const stdoutSpy = mockStdout();
  const page = {
    content: [{ id: 1, title: "Example", productType: "VIRTUAL", status: "DRAFT" }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true,
  };

  printProductList(page as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(page, null, 2)}\n`);
});

test("printProductList renders a table and pagination footer", () => {
  const stdoutSpy = mockStdout();

  printProductList(
    {
      content: [
        {
          id: 1,
          title: "Example",
          productType: "PHYSICAL",
          status: "PUBLISHED",
          minPrice: 9.9,
          maxPrice: 19.9,
          categoryId: 3,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
      first: true,
      last: true,
    } as never,
    false,
  );

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const footerOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("TITLE");
  expect(tableOutput).toContain("Example");
  expect(tableOutput).toContain("9.90 ~ 19.90");
  expect(footerOutput).toContain("1 product(s)");
});

test("printOrderList renders payment and fulfillment statuses", () => {
  const stdoutSpy = mockStdout();

  printOrderList(
    {
      content: [
        {
          id: 1001,
          orderCode: "ORD-1",
          status: "OPEN",
          paymentStatus: "PENDING",
          fulfillmentStatus: "PENDING",
          payableAmount: 88,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
      first: true,
      last: true,
    } as never,
    false,
  );

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("ORD-1");
  expect(output).toContain("PENDING");
  expect(output).toContain("88.00");
});

test("printCouponList formats percentage and amount values", () => {
  const stdoutSpy = mockStdout();

  printCouponList(
    {
      content: [
        {
          id: 1,
          name: "Ten percent",
          calculationType: "PERCENTAGE",
          discountValue: 10,
          scope: "ALL",
          isEnabled: true,
          issuedCount: 2,
          totalCount: 10,
        },
        {
          id: 2,
          name: "Five off",
          calculationType: "AMOUNT",
          discountValue: 5,
          scope: "QUALIFYING_ITEMS",
          isEnabled: false,
          issuedCount: 1,
        },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 20,
      first: true,
      last: true,
    } as never,
    false,
  );

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("10%");
  expect(output).toContain("5.00");
  expect(output).toContain("2/10");
});

test("printDailyStatistics writes JSON when json mode is enabled", () => {
  const stdoutSpy = mockStdout();
  const statistics = [
    { date: "2026-01-01", orders: 2, sales: 99.5, productsSold: 3, customers: 1 },
  ];

  printDailyStatistics(statistics, true);

  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(statistics, null, 2)}\n`);
});

test("printEntitlements parses JSON strings", () => {
  const stdoutSpy = mockStdout();

  printEntitlements('{"vip":true}', true);

  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify({ vip: true }, null, 2)}\n`);
});

test("printConfig writes JSON when json mode is enabled", () => {
  const stdoutSpy = mockStdout();
  const config = { guestCheckoutEnabled: true };

  printConfig(config, true);

  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(config, null, 2)}\n`);
});
