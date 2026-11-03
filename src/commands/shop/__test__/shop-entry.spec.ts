import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vite-plus/test";

import { CliError } from "../../../utils/errors.js";
import { tryRunShopCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

async function writeJsonFile(
  content: unknown,
): Promise<{ file: string; cleanup: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), "halo-shop-"));
  const file = join(directory, "payload.json");
  await writeFile(file, JSON.stringify(content), "utf8");
  return { file, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function createRuntimeMock(axios: Record<string, unknown>) {
  return {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: {
        name: "local",
        baseUrl: "https://example.com",
      },
      clients: {
        axios,
      },
    }),
  };
}

function readStdout(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map((call) => String(call[0] as string | undefined)).join("");
}

test("tryRunShopCommand returns false for unrelated commands", async () => {
  await expect(tryRunShopCommand(["post"], {} as never)).resolves.toBe(false);
});

test("tryRunShopCommand shows help for bare shop commands", async () => {
  silenceStdout();

  await expect(tryRunShopCommand(["shop"], {} as never)).resolves.toBe(true);
});

test("tryRunShopCommand shows help for shop groups", async () => {
  silenceStdout();

  await expect(tryRunShopCommand(["shop", "product"], {} as never)).resolves.toBe(true);
});

test("tryRunShopCommand rejects unknown shop commands", async () => {
  silenceStdout();

  await expect(tryRunShopCommand(["shop", "unknown"], {} as never)).rejects.toThrow(CliError);
});

test("shop status reports edition, activation, and API availability", async () => {
  const stdoutSpy = silenceStdout();

  const get = vi.fn((url: string) => {
    if (url === "/actuator/info") {
      return Promise.resolve({
        data: { build: { name: "halo-pro", version: "2.28.0" } },
      });
    }

    return Promise.resolve({
      data: [
        {
          spec: { productName: "product-halo-commercial" },
          status: { state: "active" },
        },
      ],
    });
  });
  const request = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });
  const runtime = createRuntimeMock({ get, request });

  await expect(tryRunShopCommand(["shop", "status", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual({
    profile: "local",
    baseUrl: "https://example.com",
    edition: "halo-pro",
    version: "2.28.0",
    commercialActivated: true,
    activationState: "active",
    shopApiAvailable: true,
  });
});

test("shop status recognizes a Halo Pro activation", async () => {
  const stdoutSpy = silenceStdout();

  const get = vi.fn((url: string) => {
    if (url === "/actuator/info") {
      return Promise.resolve({ data: { build: { name: "halo-pro" } } });
    }

    return Promise.resolve({
      data: [
        {
          spec: { productName: "product-halo-commercial" },
          status: { state: "inactive" },
        },
        {
          spec: { productName: "product-halo-pro" },
          status: { state: "active" },
        },
      ],
    });
  });
  const request = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });
  const runtime = createRuntimeMock({ get, request });

  await expect(tryRunShopCommand(["shop", "status", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  expect(JSON.parse(readStdout(stdoutSpy))).toMatchObject({
    commercialActivated: true,
    activationState: "active",
  });
});

function notFoundError() {
  return Object.assign(new Error("not found"), {
    isAxiosError: true,
    response: { status: 404, data: { detail: "No static resource products" } },
  });
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status },
  });
}

test("shop status tolerates missing edition and license APIs", async () => {
  const stdoutSpy = silenceStdout();

  const get = vi.fn().mockRejectedValue(notFoundError());
  const request = vi.fn().mockRejectedValue(notFoundError());
  const runtime = createRuntimeMock({ get, request });

  await expect(tryRunShopCommand(["shop", "status", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual({
    profile: "local",
    baseUrl: "https://example.com",
    edition: "unknown",
    commercialActivated: false,
    shopApiAvailable: false,
  });
});

test("shop status surfaces authentication failures", async () => {
  silenceStdout();

  const unauthorized = Object.assign(new Error("401 Unauthorized"), {
    isAxiosError: true,
    response: { status: 401 },
  });
  const runtime = createRuntimeMock({
    get: vi.fn().mockRejectedValue(unauthorized),
    request: vi.fn().mockRejectedValue(unauthorized),
  });

  await expect(tryRunShopCommand(["shop", "status", "--json"], runtime as never)).rejects.toThrow(
    "401 Unauthorized",
  );
});

const SHOP_DOCTOR_PROBES: Record<string, unknown> = {
  "/apis/console.api.ecommerce.halo.run/v1alpha1/products?page=1&size=1": {
    content: [],
    totalElements: 3,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/product-categories?tree=false": [],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/orders?page=1&size=1": {
    content: [],
    totalElements: 2,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/customers?page=1&size=1": {
    content: [],
    totalElements: 1,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/coupons?page=1&size=1": {
    content: [],
    totalElements: 0,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/discounts?page=1&size=1": {
    content: [],
    totalElements: 0,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/digital-resources": [],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/virtual-delivery-configs": [],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/cdks?page=1&size=1": {
    content: [],
    totalElements: 0,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/subscriptions?page=1&size=1": {
    content: [],
    totalElements: 0,
  },
  "/apis/console.api.ecommerce.halo.run/v1alpha1/statistics/orders/daily": [],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/ecommerceconfigs/shop": {},
  "/apis/console.api.ecommerce.halo.run/v1alpha1/payment-providers": [{}, {}],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/payment-methods": [{}],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/shipping-profiles": [{}],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/sales-channels": [{}],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/fulfillment-methods": [{}],
  "/apis/console.api.ecommerce.halo.run/v1alpha1/product-spec-templates?page=1&size=1": {
    content: [],
    totalElements: 0,
  },
};

function createDoctorGet(rules: Array<Record<string, unknown>>) {
  return vi.fn((url: string) => {
    if (url === "/actuator/info") {
      return Promise.resolve({
        data: { build: { name: "halo-pro", version: "2.28.0" } },
      });
    }
    if (url === "/apis/console.api.license.pro.halo.run/v1alpha1/activations") {
      return Promise.resolve({
        data: [
          {
            spec: { productName: "product-halo-commercial" },
            status: { state: "active" },
          },
        ],
      });
    }
    if (url === "/apis/uc.api.halo.run/v1alpha1/users/-/permissions") {
      return Promise.resolve({
        data: {
          roles: [{ metadata: { name: "super-role" } }],
          permissions: [{ metadata: { name: "role-template-shop-admin" }, rules }],
        },
      });
    }
    if (url in SHOP_DOCTOR_PROBES) {
      return Promise.resolve({ data: SHOP_DOCTOR_PROBES[url] });
    }
    return Promise.reject(notFoundError());
  });
}

test("shop doctor reports capabilities, permissions, and configuration", async () => {
  const stdoutSpy = silenceStdout();
  const get = createDoctorGet([
    {
      apiGroups: ["console.api.ecommerce.halo.run"],
      resources: ["*"],
      verbs: ["*"],
    },
  ]);
  const request = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 1 } });
  const runtime = createRuntimeMock({ get, request });

  await expect(tryRunShopCommand(["shop", "doctor", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  const result = JSON.parse(readStdout(stdoutSpy));
  expect(result).toMatchObject({
    profile: "local",
    baseUrl: "https://example.com",
    edition: "halo-pro",
    version: "2.28.0",
    commercialActivated: true,
    activationState: "active",
    shopApiAvailable: true,
    shopApiStatus: "available",
    permissions: {
      roles: ["super-role"],
      write: {
        products: true,
        categories: true,
        orders: true,
        statistics: true,
      },
    },
    configuration: {
      paymentProviders: 2,
      paymentMethods: 1,
      shippingProfiles: 1,
      salesChannels: 1,
      fulfillmentMethods: 1,
      specTemplates: 0,
    },
    warnings: [],
  });
  expect(Object.values(result.features)).toEqual(Array(18).fill(true));
  expect(runtime.getClientsForOptions).toHaveBeenCalledTimes(1);
});

test("shop doctor reports read-only permissions and missing configuration", async () => {
  const stdoutSpy = silenceStdout();
  const get = createDoctorGet([
    {
      apiGroups: ["console.api.ecommerce.halo.run"],
      resources: ["*"],
      verbs: ["get", "list"],
    },
  ]);
  const getWithEmptyConfiguration = vi.fn((url: string) => {
    if (url === "/apis/console.api.ecommerce.halo.run/v1alpha1/cdks?page=1&size=1") {
      return Promise.reject(notFoundError());
    }
    if (
      url === "/apis/console.api.ecommerce.halo.run/v1alpha1/payment-providers" ||
      url === "/apis/console.api.ecommerce.halo.run/v1alpha1/payment-methods" ||
      url === "/apis/console.api.ecommerce.halo.run/v1alpha1/shipping-profiles" ||
      url === "/apis/console.api.ecommerce.halo.run/v1alpha1/sales-channels" ||
      url === "/apis/console.api.ecommerce.halo.run/v1alpha1/fulfillment-methods"
    ) {
      return Promise.resolve({ data: [] });
    }
    return get(url);
  });
  const request = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });
  const runtime = createRuntimeMock({ get: getWithEmptyConfiguration, request });

  await expect(tryRunShopCommand(["shop", "doctor", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  const result = JSON.parse(readStdout(stdoutSpy));
  expect(Object.values(result.permissions.write)).toEqual(Array(18).fill(false));
  expect(result.warnings.map((warning: { code: string }) => warning.code)).toEqual(
    expect.arrayContaining([
      "READ_ONLY_ACCESS",
      "NO_PAYMENT_PROVIDERS",
      "NO_PAYMENT_METHODS",
      "NO_SHIPPING_PROFILES",
      "NO_SALES_CHANNELS",
      "NO_FULFILLMENT_METHODS",
    ]),
  );
});

test("shop doctor reports unknown write access when permissions are unavailable", async () => {
  const stdoutSpy = silenceStdout();
  const get = createDoctorGet([]);
  const getWithForbiddenPermissions = vi.fn((url: string) => {
    if (url === "/apis/uc.api.halo.run/v1alpha1/users/-/permissions") {
      return Promise.reject(
        Object.assign(new Error("forbidden"), {
          isAxiosError: true,
          response: { status: 403 },
        }),
      );
    }
    return get(url);
  });
  const request = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });
  const runtime = createRuntimeMock({ get: getWithForbiddenPermissions, request });

  await expect(tryRunShopCommand(["shop", "doctor", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  const result = JSON.parse(readStdout(stdoutSpy));
  expect(Object.values(result.permissions.write)).toEqual(Array(18).fill(null));
  expect(result.warnings.map((warning: { code: string }) => warning.code)).toContain(
    "PERMISSIONS_UNAVAILABLE",
  );
});

test("shop doctor keeps probing when product listing is denied", async () => {
  const stdoutSpy = silenceStdout();
  const get = createDoctorGet([
    {
      apiGroups: ["console.api.ecommerce.halo.run"],
      resources: ["*"],
      verbs: ["get", "list"],
    },
  ]);
  const getWithDeniedProbes = vi.fn((url: string) => {
    if (url.startsWith("/apis/console.api.ecommerce.halo.run/v1alpha1/")) {
      return Promise.reject(httpError(403));
    }
    return get(url);
  });
  const request = vi.fn().mockRejectedValue(httpError(403));
  const runtime = createRuntimeMock({ get: getWithDeniedProbes, request });

  await expect(tryRunShopCommand(["shop", "doctor", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  const result = JSON.parse(readStdout(stdoutSpy));
  expect(result).toMatchObject({
    shopApiAvailable: false,
    shopApiStatus: "denied",
  });
  const codes = result.warnings.map((warning: { code: string }) => warning.code);
  expect(codes).toContain("PERMISSION_DENIED");
  expect(codes).toContain("READ_ONLY_ACCESS");
  expect(codes).not.toContain("SHOP_API_UNAVAILABLE");
});

test("shop doctor reports probe failures without aborting the diagnosis", async () => {
  const stdoutSpy = silenceStdout();
  const get = createDoctorGet([
    {
      apiGroups: ["console.api.ecommerce.halo.run"],
      resources: ["*"],
      verbs: ["*"],
    },
  ]);
  const request = vi.fn().mockRejectedValue(httpError(500));
  const runtime = createRuntimeMock({ get, request });

  await expect(tryRunShopCommand(["shop", "doctor", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  const result = JSON.parse(readStdout(stdoutSpy));
  expect(result).toMatchObject({
    shopApiAvailable: false,
    shopApiStatus: "unknown",
  });
  expect(result.features.products).toBe(false);
  expect(result.features.orders).toBe(true);
  const codes = result.warnings.map((warning: { code: string }) => warning.code);
  expect(codes).toContain("PROBE_FAILED");
  expect(codes).not.toContain("SHOP_API_UNAVAILABLE");
});

test("shop doctor reports shop API unavailability", async () => {
  const stdoutSpy = silenceStdout();
  const get = vi.fn().mockRejectedValue(notFoundError());
  const request = vi.fn().mockRejectedValue(notFoundError());
  const runtime = createRuntimeMock({ get, request });

  await expect(tryRunShopCommand(["shop", "doctor", "--json"], runtime as never)).resolves.toBe(
    true,
  );

  const result = JSON.parse(readStdout(stdoutSpy));
  expect(result).toMatchObject({
    shopApiAvailable: false,
    shopApiStatus: "unavailable",
    permissions: {
      roles: [],
    },
    warnings: [
      {
        code: "SHOP_API_UNAVAILABLE",
      },
    ],
  });
  expect(Object.values(result.features)).toEqual(Array(18).fill(false));
});

test("shop product create posts the request and prints JSON", async () => {
  const stdoutSpy = silenceStdout();

  const product = {
    id: 7,
    title: "Example",
    productType: "VIRTUAL",
    status: "DRAFT",
    permalink: "/products/example",
  };
  const request = vi.fn().mockResolvedValue({ data: product });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "product",
        "create",
        "--title",
        "Example",
        "--type",
        "VIRTUAL",
        "--price",
        "9.9",
        "--json",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual(product);
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/products"),
      data: expect.objectContaining({
        title: "Example",
        productType: "VIRTUAL",
        status: "DRAFT",
        productVariants: [
          expect.objectContaining({
            price: 9.9,
            status: "DRAFT",
          }),
        ],
      }),
    }),
  );
});

test("shop product create defaults a new variant to draft", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: { id: 8 } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "product",
        "create",
        "--title",
        "Published product",
        "--status",
        "PUBLISHED",
        "--price",
        "9.9",
        "--json",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: "PUBLISHED",
        productVariants: [expect.objectContaining({ price: 9.9, status: "DRAFT" })],
      }),
    }),
  );
});

test("shop product update preserves existing variant status and drafts new variants", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 10 }, { price: 20 }],
  });

  try {
    const current = {
      id: 7,
      title: "Example",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({
        data: {
          ...current,
          productVariants: [
            { id: 11, price: 10, status: "PUBLISHED" },
            { id: 12, price: 20, status: "DRAFT" },
          ],
        },
      });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/products/7/specifications"),
        data: expect.objectContaining({
          productVariants: [
            expect.objectContaining({ id: 11, status: "PUBLISHED" }),
            expect.objectContaining({ price: 20, status: "DRAFT" }),
          ],
        }),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop product create requires a title", async () => {
  silenceStdout();

  const runtime = createRuntimeMock({ request: vi.fn() });

  await expect(
    tryRunShopCommand(["shop", "product", "create", "--json"], runtime as never),
  ).rejects.toThrow("Product title is required");
});

test("shop product update merges flags with the current product", async () => {
  const stdoutSpy = silenceStdout();

  const current = {
    id: 7,
    title: "Old title",
    handle: "old-title",
    productType: "PHYSICAL",
    status: "DRAFT",
    content: "Body",
    images: ["https://example.com/a.png"],
    productVariants: [
      {
        id: 11,
        price: 10,
        stock: 3,
        trackInventory: true,
        status: "PUBLISHED",
        specValues: [],
      },
    ],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({
      data: { ...current, title: "New title" },
    });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "update", "7", "--title", "New title", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toMatchObject({ title: "New title" });
  expect(request).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ method: "GET", url: expect.stringContaining("/products/7") }),
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7/basic-info"),
      data: {
        title: "New title",
        handle: "old-title",
        description: undefined,
        categoryId: undefined,
      },
    }),
  );
});

test("shop order create requires items", async () => {
  silenceStdout();

  const runtime = createRuntimeMock({ request: vi.fn() });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "create", "--username", "demo", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("At least one order item is required");
});

test("shop order fulfill requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "fulfill", "1001", "--item", "1:1", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop order fulfill --all fills unfulfilled quantities", async () => {
  const stdoutSpy = silenceStdout();

  const order = {
    id: 1001,
    status: "OPEN",
    items: [
      { id: 1, quantity: 3, refundedQuantity: 0, fulfilledQuantity: 1 },
      { id: 2, quantity: 2, refundedQuantity: 2, fulfilledQuantity: 0 },
    ],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: order })
    .mockResolvedValueOnce({ data: { id: 55 } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "fulfill", "1001", "--all", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual({ id: 55 });
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/orders/1001/request-fulfillment"),
      data: {
        items: [
          { orderItemId: 1, quantity: 2 },
          { orderItemId: 2, quantity: 2 },
        ],
      },
    }),
  );
});

test("shop order list --order-code also searches by keyword", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({
    data: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 },
  });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "order", "list", "--order-code", "ORDER-CODE-1"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        keyword: "ORDER-CODE-1",
        orderCode: "ORDER-CODE-1",
      }),
    }),
  );
});

test("shop coupon distribute by username sends allCustomers false", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "coupon", "distribute", "3", "--username", "admin", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/coupons/3/auto-distribute"),
      data: { allCustomers: false, usernames: ["admin"] },
    }),
  );
});

test("shop customer update --clear-note sends an empty note", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({
    data: { id: 7, note: null, status: "ACTIVE" },
  });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "customer", "update", "7", "--clear-note", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "PATCH",
      url: expect.stringContaining("/customers/7"),
      data: { note: "" },
    }),
  );
});

test("shop customer update accepts --clear-note before the id", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({
    data: { id: 7, note: null, status: "ACTIVE" },
  });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "customer", "update", "--clear-note", "7", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "PATCH",
      url: expect.stringContaining("/customers/7"),
      data: { note: "" },
    }),
  );
});

test("shop resource get treats an empty response as not found", async () => {
  silenceStdout();

  const runtime = createRuntimeMock({ request: vi.fn().mockResolvedValue({ data: "" }) });

  await expect(
    tryRunShopCommand(["shop", "product", "get", "999999"], runtime as never),
  ).rejects.toThrow("Product 999999 was not found.");
});

test("shop config set prints a fallback when the API returns no body", async () => {
  const stdoutSpy = silenceStdout();

  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: { guestCheckoutEnabled: true } })
    .mockResolvedValueOnce({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "config", "set", "--guest-checkout", "false", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual({ updated: true });
});

test("shop customer update requires at least one field", async () => {
  silenceStdout();

  const runtime = createRuntimeMock({ request: vi.fn() });

  await expect(
    tryRunShopCommand(["shop", "customer", "update", "1"], runtime as never),
  ).rejects.toThrow("Provide at least one option");
});

test("shop stats daily validates date options", async () => {
  silenceStdout();

  const runtime = createRuntimeMock({ request: vi.fn() });

  await expect(
    tryRunShopCommand(["shop", "stats", "daily", "--start", "2026/01/01"], runtime as never),
  ).rejects.toThrow("yyyy-MM-dd");
});

test("shop order list forwards repeated filters", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({
    data: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 },
  });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "order",
        "list",
        "--status",
        "OPEN,CANCELLED",
        "--payment-status",
        "PAID",
        "--customer",
        "9",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "GET",
      url: expect.stringContaining("/orders"),
      params: expect.objectContaining({
        page: 1,
        size: 20,
        statuses: ["OPEN", "CANCELLED"],
        paymentStatuses: ["PAID"],
        customerId: 9,
      }),
    }),
  );
});

test("shop coupon create maps marketing flags", async () => {
  const stdoutSpy = silenceStdout();

  const coupon = {
    id: 3,
    name: "Spring sale",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    validDays: 30,
  };
  const request = vi.fn().mockResolvedValue({ data: coupon });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "coupon",
        "create",
        "--name",
        "Spring sale",
        "--calculation-type",
        "PERCENTAGE",
        "--discount-value",
        "10",
        "--scope",
        "ALL",
        "--valid-days",
        "30",
        "--json",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual(coupon);
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/coupons"),
      data: expect.objectContaining({
        name: "Spring sale",
        calculationType: "PERCENTAGE",
        discountValue: 10,
        scope: "ALL",
        validDays: 30,
      }),
    }),
  );
});

test("shop coupon create rejects a percentage above 100", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "coupon",
        "create",
        "--name",
        "Too much",
        "--calculation-type",
        "PERCENTAGE",
        "--discount-value",
        "101",
        "--scope",
        "ALL",
        "--valid-days",
        "30",
        "--json",
      ],
      runtime as never,
    ),
  ).rejects.toThrow("between 0 and 100");

  expect(request).not.toHaveBeenCalled();
});

test("shop coupon create rejects a non-scalar discount value from a file", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    name: "Invalid value",
    calculationType: "AMOUNT",
    discountValue: [10],
    scope: "ALL",
    validDays: 30,
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "coupon", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("Coupon discount value must be a non-negative number");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop discount create requires an application type", async () => {
  silenceStdout();

  const runtime = createRuntimeMock({ request: vi.fn() });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "discount",
        "create",
        "--name",
        "Ten percent",
        "--calculation-type",
        "PERCENTAGE",
        "--discount-value",
        "10",
        "--scope",
        "ALL",
      ],
      runtime as never,
    ),
  ).rejects.toThrow("Discount application is required");
});

test("shop discount create rejects a percentage above 100", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "discount",
        "create",
        "--name",
        "Too much",
        "--application",
        "AUTOMATIC",
        "--calculation-type",
        "PERCENTAGE",
        "--discount-value",
        "101",
        "--scope",
        "ALL",
        "--json",
      ],
      runtime as never,
    ),
  ).rejects.toThrow("between 0 and 100");

  expect(request).not.toHaveBeenCalled();
});

test("shop discount create rejects a non-scalar discount value", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    name: "Invalid value",
    application: "AUTOMATIC",
    calculationType: "AMOUNT",
    discountValue: [10],
    scope: "ALL",
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "discount", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("Discount value must be a non-negative number");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop config set rejects --group combined with shop settings", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "config", "set", "--group", "payment", "--guest-checkout", "true", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("--group cannot be combined with shop setting options");

  expect(request).not.toHaveBeenCalled();
});

test("shop stats daily rejects an invalid calendar date", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "stats", "daily", "--start", "2026-02-31", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("valid date");

  expect(request).not.toHaveBeenCalled();
});

test("shop config set merges shop settings over the current config", async () => {
  silenceStdout();

  const request = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        contacts: [{ label: "Email", type: "LINK", linkUrl: "mailto:hi@example.com" }],
        guestCheckoutEnabled: false,
      },
    })
    .mockResolvedValueOnce({
      data: {
        contacts: [{ label: "Email", type: "LINK", linkUrl: "mailto:hi@example.com" }],
        guestCheckoutEnabled: true,
      },
    });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "config", "set", "--guest-checkout", "true", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/ecommerceconfigs/shop"),
      data: expect.objectContaining({
        guestCheckoutEnabled: true,
        contacts: [expect.objectContaining({ label: "Email" })],
      }),
    }),
  );
});

test("shop product delete --force=false still requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "delete", "7", "--force=false", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop product create preserves raw string identifiers and boolean values", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: { id: 8 } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "product",
        "create",
        "--title",
        "Raw values",
        "--price",
        "9.9",
        "--sku",
        "0012",
        "--barcode",
        "000123",
        "--track-inventory",
        "0",
        "--json",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        productVariants: [
          expect.objectContaining({
            skuCode: "0012",
            barcode: "000123",
            trackInventory: false,
          }),
        ],
      }),
    }),
  );
});

test("shop product create rejects an empty price", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "create", "--title", "Empty price", "--price", "", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("--price requires a non-empty value.");

  expect(request).not.toHaveBeenCalled();
});

test("shop product update accepts an explicitly empty image list", async () => {
  const stdoutSpy = silenceStdout();

  const current = {
    id: 7,
    title: "Example",
    productType: "PHYSICAL",
    status: "DRAFT",
    images: ["https://example.com/a.png"],
    productVariants: [],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, images: [] } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "update", "7", "--images", "", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toMatchObject({ images: [] });
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7/content"),
      data: expect.objectContaining({ images: [] }),
    }),
  );
});

test("shop product create rejects file variants without a price", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    title: "License",
    productType: "VIRTUAL",
    status: "PUBLISHED",
    productVariants: [{ skuCode: "LICENSE" }],
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "product", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("requires a price for FIXED pricing");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop product create rejects a negative file variant price", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    title: "License",
    productType: "VIRTUAL",
    status: "DRAFT",
    productVariants: [{ price: -1 }],
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "product", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("price must be a non-negative number");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop product update rejects a negative file variant stock before writing", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 10, stock: -2 }],
  });

  try {
    const current = {
      id: 7,
      title: "Example",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, stock: 3, status: "PUBLISHED" }],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("stock must be a non-negative integer");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update rejects a non-array variant payload before writing", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    title: "New title",
    productVariants: {},
  });

  try {
    const current = {
      id: 7,
      title: "Old title",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--price", "10", "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("productVariants must be an array");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop coupon create rejects a negative valid days value from a file", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    name: "Expired immediately",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    validDays: -1,
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "coupon", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("Coupon valid days must be a positive integer");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop discount update clears the code when switching to AUTOMATIC", async () => {
  silenceStdout();

  const current = {
    id: 3,
    name: "Ten percent",
    application: "CODE",
    code: "SAVE10",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    isEnabled: true,
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, application: "AUTOMATIC", code: undefined } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "discount", "update", "3", "--application", "AUTOMATIC", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/discounts/3"),
      data: expect.objectContaining({ application: "AUTOMATIC", code: undefined }),
    }),
  );
});

test("shop order create rejects a negative file item price", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    username: "demo",
    items: [{ productVariantId: 1, quantity: 1, customPrice: -10 }],
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "order", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("must be a non-negative number");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop order fulfill rejects the unavailable VIRTUAL provider", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "fulfill", "1001", "--item", "1:1", "--provider", "VIRTUAL", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("Invalid --provider");

  expect(request).not.toHaveBeenCalled();
});

test("shop order create rejects boolean file item fields", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    username: "demo",
    items: [{ productVariantId: true, quantity: true, customPrice: 0 }],
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "order", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("must be a number");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop order create rejects array file item prices", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    username: "demo",
    items: [{ productVariantId: 1, quantity: 1, customPrice: [0] }],
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "order", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("must be a number");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop order fulfill treats a null provider as the default", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    provider: null,
    items: [{ orderItemId: 1, quantity: 1 }],
  });

  try {
    const request = vi.fn().mockResolvedValueOnce({ data: { id: 55 } });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "order", "fulfill", "1001", "--file", file, "--force", "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: expect.stringContaining("/orders/1001/request-fulfillment"),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop order create rejects an empty item price", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "create", "--username", "demo", "--item", "1:1:", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow('Unit price is required in --item "1:1:"');

  expect(request).not.toHaveBeenCalled();
});

test("shop order fulfill --all skips subscription lines", async () => {
  const stdoutSpy = silenceStdout();

  const order = {
    id: 1001,
    status: "OPEN",
    items: [
      {
        id: 1,
        quantity: 2,
        refundedQuantity: 0,
        fulfilledQuantity: 0,
        subscriptionMetadata: { type: "PLAN" },
      },
      { id: 2, quantity: 1, refundedQuantity: 0, fulfilledQuantity: 0 },
    ],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: order })
    .mockResolvedValueOnce({ data: { id: 55 } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "fulfill", "1001", "--all", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(JSON.parse(readStdout(stdoutSpy))).toEqual({ id: 55 });
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/orders/1001/request-fulfillment"),
      data: { items: [{ orderItemId: 2, quantity: 1 }] },
    }),
  );
});

test("shop coupon distribute reports that distribution is scheduled", async () => {
  const stdoutSpy = silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "coupon", "distribute", "3", "--username", "admin"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(readStdout(stdoutSpy)).toContain("Scheduled coupon 3 distribution");
});

test("shop coupon distribute --all requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "coupon", "distribute", "3", "--all", "--json"], runtime as never),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop coupon distribute --all --force sends the request", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "coupon", "distribute", "3", "--all", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/coupons/3/auto-distribute"),
      data: { allCustomers: true },
    }),
  );
});

test("shop product unpublish requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "product", "unpublish", "7", "--json"], runtime as never),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop product unpublish --force updates the status", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: { id: 7, status: "DRAFT" } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "product", "unpublish", "7", "--force", "--json"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7/status"),
      data: { status: "DRAFT" },
    }),
  );
});

test("shop product update requires confirmation when unpublishing", async () => {
  silenceStdout();

  const current = {
    id: 7,
    title: "Published product",
    productType: "PHYSICAL",
    status: "PUBLISHED",
    productVariants: [],
  };
  const request = vi.fn().mockResolvedValueOnce({ data: current });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "update", "7", "--status", "DRAFT", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET" }));
});

test("shop product update --force allows unpublishing", async () => {
  silenceStdout();

  const current = {
    id: 7,
    title: "Published product",
    productType: "PHYSICAL",
    status: "PUBLISHED",
    productVariants: [],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, status: "DRAFT" } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "update", "7", "--status", "DRAFT", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7"),
      data: expect.objectContaining({ status: "DRAFT" }),
    }),
  );
});

test("shop product update re-reads stock after confirmation", async () => {
  silenceStdout();

  const initial = {
    id: 7,
    title: "Published product",
    productType: "PHYSICAL",
    status: "PUBLISHED",
    productVariants: [{ id: 11, price: 10, stock: 3, status: "PUBLISHED" }],
  };
  const refreshed = {
    ...initial,
    productVariants: [{ id: 11, price: 10, stock: 1, status: "PUBLISHED" }],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: initial })
    .mockResolvedValueOnce({ data: refreshed })
    .mockResolvedValueOnce({
      data: {
        ...refreshed,
        productVariants: [{ id: 11, price: 10, stock: 1, status: "DRAFT" }],
      },
    });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "product",
        "update",
        "7",
        "--variant",
        "11",
        "--variant-status",
        "DRAFT",
        "--force",
        "--json",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7/specifications"),
      data: expect.objectContaining({
        productVariants: [expect.objectContaining({ id: 11, stock: 1, status: "DRAFT" })],
      }),
    }),
  );
});

test("shop product update merges partial file variants with current fields", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 12 }],
  });

  try {
    const current = {
      id: 7,
      title: "Draft product",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, stock: 5, skuCode: "SKU-11", status: "PUBLISHED" }],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({
        data: {
          ...current,
          productVariants: [
            { id: 11, price: 12, stock: 5, skuCode: "SKU-11", status: "PUBLISHED" },
          ],
        },
      });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/products/7/specifications"),
        data: expect.objectContaining({
          productVariants: [
            expect.objectContaining({
              id: 11,
              price: 12,
              stock: 5,
              skuCode: "SKU-11",
              status: "PUBLISHED",
            }),
          ],
        }),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop product create rejects external link fields for non-external products", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "product",
        "create",
        "--title",
        "Physical product",
        "--external-url",
        "https://example.com/product",
        "--json",
      ],
      runtime as never,
    ),
  ).rejects.toThrow("External link fields are only supported for EXTERNAL products");

  expect(request).not.toHaveBeenCalled();
});

test("shop product create rejects a non-array variant payload before applying flags", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({ productVariants: {} });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        [
          "shop",
          "product",
          "create",
          "--title",
          "Example",
          "--file",
          file,
          "--price",
          "10",
          "--json",
        ],
        runtime as never,
      ),
    ).rejects.toThrow("productVariants must be an array");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop product update re-reads variants before an unconfirmed specifications update", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 12 }],
  });

  try {
    const current = {
      id: 7,
      title: "Draft product",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, stock: 5, status: "PUBLISHED" }],
    };
    const refreshed = {
      ...current,
      productVariants: [{ id: 11, price: 10, stock: 2, status: "PUBLISHED" }],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: refreshed })
      .mockResolvedValueOnce({ data: refreshed });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/products/7/specifications"),
        data: expect.objectContaining({
          productVariants: [expect.objectContaining({ id: 11, price: 12, stock: 2 })],
        }),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop product update rejects external link fields for non-external products", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    externalLinkUrl: "https://example.com/product",
  });

  try {
    const current = {
      id: 7,
      title: "Physical product",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("External link fields are only supported for EXTERNAL products");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update with only a title change does not require confirmation", async () => {
  silenceStdout();

  const current = {
    id: 7,
    title: "Published product",
    productType: "PHYSICAL",
    status: "PUBLISHED",
    productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, title: "Renamed product" } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "update", "7", "--title", "Renamed product", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7/basic-info"),
      data: expect.objectContaining({ title: "Renamed product" }),
    }),
  );
});

test("shop product update requires confirmation when disabling a published variant", async () => {
  silenceStdout();

  const current = {
    id: 7,
    title: "Published product",
    productType: "PHYSICAL",
    status: "PUBLISHED",
    productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
  };
  const request = vi.fn().mockResolvedValueOnce({ data: current });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "product", "update", "7", "--variant", "11", "--variant-status", "DRAFT", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).toHaveBeenCalledOnce();
});

test("shop product update --force allows disabling a published variant", async () => {
  silenceStdout();

  const current = {
    id: 7,
    title: "Published product",
    productType: "PHYSICAL",
    status: "PUBLISHED",
    productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({
      data: {
        ...current,
        productVariants: [{ id: 11, price: 10, status: "DRAFT" }],
      },
    });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      [
        "shop",
        "product",
        "update",
        "7",
        "--variant",
        "11",
        "--variant-status",
        "DRAFT",
        "--force",
        "--json",
      ],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/products/7/specifications"),
      data: expect.objectContaining({
        productVariants: [expect.objectContaining({ id: 11, status: "DRAFT" })],
      }),
    }),
  );
});

test("shop product update requires confirmation when a published variant is removed via --file", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({ productVariants: [] });

  try {
    const current = {
      id: 7,
      title: "Published product",
      productType: "PHYSICAL",
      status: "PUBLISHED",
      productVariants: [
        { id: 11, price: 10, status: "PUBLISHED" },
        { id: 12, price: 20, status: "PUBLISHED" },
      ],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update requires confirmation when one published variant is removed", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
  });

  try {
    const current = {
      id: 7,
      title: "Published product",
      productType: "PHYSICAL",
      status: "PUBLISHED",
      productVariants: [
        { id: 11, price: 10, status: "PUBLISHED" },
        { id: 12, price: 20, status: "PUBLISHED" },
      ],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update requires confirmation when a draft variant is removed", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
  });

  try {
    const current = {
      id: 7,
      title: "Published product",
      productType: "PHYSICAL",
      status: "PUBLISHED",
      productVariants: [
        { id: 11, price: 10, status: "PUBLISHED" },
        { id: 12, price: 20, status: "DRAFT" },
      ],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update requires confirmation for lowercase variant status via --file", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 10, status: "draft" }],
  });

  try {
    const current = {
      id: 7,
      title: "Published product",
      productType: "PHYSICAL",
      status: "PUBLISHED",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update --force normalizes variant status from --file", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: 11, price: 10, status: "draft" }],
  });

  try {
    const current = {
      id: 7,
      title: "Published product",
      productType: "PHYSICAL",
      status: "PUBLISHED",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({
        data: {
          ...current,
          productVariants: [{ id: 11, price: 10, status: "DRAFT" }],
        },
      });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--force", "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/products/7"),
        data: expect.objectContaining({
          productVariants: [expect.objectContaining({ id: 11, status: "DRAFT" })],
        }),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop product update treats a null variant list as removal", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({ productVariants: null });

  try {
    const current = {
      id: 7,
      title: "Published product",
      productType: "PHYSICAL",
      status: "PUBLISHED",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update ignores variant lists for subscription products", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    title: "Renamed plan",
    productVariants: [],
  });

  try {
    const current = {
      id: 7,
      title: "Plan",
      productType: "SUBSCRIPTION",
      status: "PUBLISHED",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: { ...current, title: "Renamed plan" } });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/products/7"),
        data: expect.objectContaining({ title: "Renamed plan" }),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop product update rejects variants that belong to another product", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    title: "New title",
    productVariants: [{ id: 999, price: 10, status: "PUBLISHED" }],
  });

  try {
    const current = {
      id: 7,
      title: "Old title",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("Variant 999 was not found on this product");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop product update accepts a null variant id as a new variant", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    productVariants: [{ id: null, price: 10, status: "DRAFT" }],
  });

  try {
    const current = {
      id: 7,
      title: "Draft product",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({
        data: {
          ...current,
          productVariants: [{ id: 12, price: 10, status: "DRAFT" }],
        },
      });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/products/7/specifications"),
        data: expect.objectContaining({
          productVariants: [expect.objectContaining({ id: null, price: 10 })],
        }),
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop product update reports domains applied before a later failure", async () => {
  silenceStdout();
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const { file, cleanup } = await writeJsonFile({
    title: "New title",
    productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
  });

  try {
    const current = {
      id: 7,
      title: "Old title",
      productType: "PHYSICAL",
      status: "DRAFT",
      productVariants: [{ id: 11, price: 10, status: "PUBLISHED" }],
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: current })
      .mockResolvedValueOnce({ data: { ...current, title: "New title" } })
      .mockRejectedValueOnce(new Error("spec failed"));
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "product", "update", "7", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("spec failed");

    expect(readStdout(stderr)).toContain("failed during specifications");
    expect(readStdout(stderr)).toContain("Applied domains: basic-info");
    expect(readStdout(stderr)).toContain("may have been partially applied");
  } finally {
    await cleanup();
  }
});

test("shop coupon update disabling via --file requires confirmation", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({ isEnabled: "false" });

  try {
    const current = {
      id: 3,
      name: "Spring sale",
      calculationType: "PERCENTAGE",
      discountValue: 10,
      scope: "ALL",
      validDays: 30,
      isEnabled: true,
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "coupon", "update", "3", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop discount update disabling via --file requires confirmation", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({ isEnabled: "false" });

  try {
    const current = {
      id: 3,
      name: "Ten percent",
      application: "AUTOMATIC",
      calculationType: "PERCENTAGE",
      discountValue: 10,
      scope: "ALL",
      isEnabled: true,
    };
    const request = vi.fn().mockResolvedValueOnce({ data: current });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "discount", "update", "3", "--file", file, "--json"],
        runtime as never,
      ),
    ).rejects.toThrow("requires confirmation in interactive mode or use --force");

    expect(request).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("shop coupon update disabling requires confirmation", async () => {
  silenceStdout();

  const current = {
    id: 3,
    name: "Spring sale",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    validDays: 30,
    isEnabled: true,
  };
  const request = vi.fn().mockResolvedValueOnce({ data: current });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "coupon", "update", "3", "--enabled", "false", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).toHaveBeenCalledOnce();
});

test("shop coupon update --force allows disabling", async () => {
  silenceStdout();

  const current = {
    id: 3,
    name: "Spring sale",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    validDays: 30,
    isEnabled: true,
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, isEnabled: false } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "coupon", "update", "3", "--enabled", "false", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/coupons/3"),
      data: expect.objectContaining({ isEnabled: false }),
    }),
  );
});

test("shop discount update disabling requires confirmation", async () => {
  silenceStdout();

  const current = {
    id: 3,
    name: "Ten percent",
    application: "AUTOMATIC",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    isEnabled: true,
  };
  const request = vi.fn().mockResolvedValueOnce({ data: current });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "discount", "update", "3", "--enabled", "false", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).toHaveBeenCalledOnce();
});

test("shop discount update --force allows disabling", async () => {
  silenceStdout();

  const current = {
    id: 3,
    name: "Ten percent",
    application: "AUTOMATIC",
    calculationType: "PERCENTAGE",
    discountValue: 10,
    scope: "ALL",
    isEnabled: true,
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, isEnabled: false } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "discount", "update", "3", "--enabled", "false", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/discounts/3"),
      data: expect.objectContaining({ isEnabled: false }),
    }),
  );
});

test("shop customer update --status BLOCKED requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "customer", "update", "7", "--status", "BLOCKED", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop customer update --status BLOCKED --force sends the request", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: { id: 7, status: "BLOCKED" } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "customer", "update", "7", "--status", "BLOCKED", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "PATCH",
      url: expect.stringContaining("/customers/7"),
      data: { status: "BLOCKED" },
    }),
  );
});

test("shop order cancel requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "order", "cancel", "1001", "--json"], runtime as never),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop order cancel --force sends the request", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "order", "cancel", "1001", "--force", "--json"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/orders/1001/cancel"),
    }),
  );
});

test("shop order mark-paid requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "order", "mark-paid", "1001", "--json"], runtime as never),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop order mark-paid --force sends the request", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "mark-paid", "1001", "--force", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/orders/1001/mark-as-paid"),
    }),
  );
});

test("shop category create posts the request", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: { id: 5, name: "Digital", slug: "digital" } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "category", "create", "--name", "Digital", "--slug", "digital", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      url: expect.stringContaining("/product-categories"),
      data: expect.objectContaining({ name: "Digital", slug: "digital" }),
    }),
  );
});

test("shop category delete requires confirmation", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "category", "delete", "5", "--json"], runtime as never),
  ).rejects.toThrow("requires confirmation in interactive mode or use --force");

  expect(request).not.toHaveBeenCalled();
});

test("shop category delete --force deletes the category", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "category", "delete", "5", "--force", "--json"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "DELETE",
      url: expect.stringContaining("/product-categories/5"),
    }),
  );
});

test("shop coupon delete --force deletes the coupon", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "coupon", "delete", "3", "--force", "--json"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "DELETE",
      url: expect.stringContaining("/coupons/3"),
    }),
  );
});

test("shop discount delete --force deletes the discount", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: "" });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "discount", "delete", "3", "--force", "--json"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "DELETE",
      url: expect.stringContaining("/discounts/3"),
    }),
  );
});

test("shop config set --group merges the group payload over the current config", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({ provider: "stripe" });

  try {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { provider: "stripe", currency: "USD" } })
      .mockResolvedValue({ data: "" });
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(
        ["shop", "config", "set", "--group", "payment", "--file", file, "--json"],
        runtime as never,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: "GET",
        url: expect.stringContaining("/ecommerceconfigs/payment"),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/ecommerceconfigs/payment"),
        data: { provider: "stripe", currency: "USD" },
      }),
    );
  } finally {
    await cleanup();
  }
});

test("shop category list passes the tree flag", async () => {
  silenceStdout();

  const request = vi.fn().mockResolvedValue({ data: [] });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(["shop", "category", "list", "--tree", "--json"], runtime as never),
  ).resolves.toBe(true);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "GET",
      url: expect.stringContaining("/product-categories"),
      params: { tree: true },
    }),
  );
});

test("shop category update merges flags with the current category", async () => {
  silenceStdout();

  const current = {
    id: 5,
    name: "Old name",
    slug: "digital",
    description: "Old description",
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: current })
    .mockResolvedValueOnce({ data: { ...current, name: "New name" } });
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "category", "update", "5", "--name", "New name", "--json"],
      runtime as never,
    ),
  ).resolves.toBe(true);

  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: "PUT",
      url: expect.stringContaining("/product-categories/5"),
      data: expect.objectContaining({ name: "New name", slug: "digital" }),
    }),
  );
});

test("shop discount create rejects an invalid startsAt instant", async () => {
  silenceStdout();

  const { file, cleanup } = await writeJsonFile({
    name: "Invalid window",
    application: "AUTOMATIC",
    calculationType: "AMOUNT",
    discountValue: 10,
    scope: "ALL",
    startsAt: "tomorrow",
  });

  try {
    const request = vi.fn();
    const runtime = createRuntimeMock({ request });

    await expect(
      tryRunShopCommand(["shop", "discount", "create", "--file", file, "--json"], runtime as never),
    ).rejects.toThrow("Discount startsAt must be an ISO-8601 instant");

    expect(request).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("shop order list rejects an invalid start date", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "list", "--start-date", "2026-02-31", "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("--start-date must be an ISO-8601 instant");

  expect(request).not.toHaveBeenCalled();
});

test("shop order note rejects messages over 1000 characters", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "order", "note", "1001", "--message", "x".repeat(1001), "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("at most 1000 characters");

  expect(request).not.toHaveBeenCalled();
});

test("shop customer update rejects notes over 500 characters", async () => {
  silenceStdout();

  const request = vi.fn();
  const runtime = createRuntimeMock({ request });

  await expect(
    tryRunShopCommand(
      ["shop", "customer", "update", "7", "--note", "x".repeat(501), "--json"],
      runtime as never,
    ),
  ).rejects.toThrow("at most 500 characters");

  expect(request).not.toHaveBeenCalled();
});
