---
name: halo-cli-shop
version: 1.0.0
description: Use when managing a Halo Pro or Halo Commercial shop from the terminal or as an AI agent. Covers products, product categories, orders, customers, coupons, discounts, daily statistics, and shop configuration through `halo shop ...`. Trigger this skill whenever the user mentions Halo shop, Halo 商城, ecommerce products, orders, customers, coupons, discounts, or shop operations.
references:
  - ../halo-cli-shared
metadata:
  openclaw:
    category: developer-tools
    requires:
      bins: ["halo"]
    cliHelp: "halo shop --help"
---

# Halo CLI Shop

Manage the Halo shop area through the `console.api.ecommerce.halo.run/v1alpha1` API.

## Prerequisites

The shop API only exists on Halo Pro / Halo Commercial instances with the shop feature enabled.

```bash
halo shop doctor --json
```

Run `doctor` before a shop workflow. It reports edition, activation, `shopApiAvailable`, `shopApiStatus` (`available`, `denied`, `unavailable`, or `unknown`), per-feature readability, read/write permissions for each shop resource, configuration counts, and actionable `warnings`.

Use `shopApiStatus` rather than the boolean alone: `denied` means the API exists but the current profile lacks permission, while `unavailable` means the instance does not expose the shop API. A `features` entry is true only when the current profile can read that resource; use `warnings` to distinguish `PERMISSION_DENIED` from `RESOURCE_UNAVAILABLE`. If a warning uses `PERMISSION_DENIED`, `PERMISSIONS_UNAVAILABLE`, or `READ_ONLY_ACCESS`, adjust the profile or token instead of retrying.

`halo shop status --json` is a lighter check that only reports edition, activation, and API availability.

All commands accept `--profile <name>` and `--json`. Prefer `--json` for agent workflows.

## Command Map

```bash
halo shop status
halo shop doctor

halo shop product list|get|create|update|publish|unpublish|delete
halo shop category list|get|create|update|delete
halo shop order list|get|create|cancel|mark-paid|fulfill|note
halo shop customer list|get|update|addresses|entitlements
halo shop coupon list|get|create|update|delete|distribute
halo shop discount list|get|create|update|delete
halo shop stats daily
halo shop config get|set
```

Run `halo shop <group> --help` or `halo shop <group> <command> --help` before guessing flags.

## Common Workflows

Inspect products and publish one:

```bash
halo shop product list --status DRAFT --json
halo shop product get 12 --json
halo shop product publish 12
```

Create a simple virtual product with one variant:

```bash
halo shop product create \
  --title "Digital license" \
  --type VIRTUAL \
  --status PUBLISHED \
  --price 99 \
  --sku DIGITAL-001 \
  --variant-status PUBLISHED
```

Create a product with complex variants, specs, or images from a JSON payload:

```bash
halo shop product create --file product.json --json
halo shop product update 12 --file product.json --json
```

`--file -` reads the payload from stdin.

Order operations:

```bash
halo shop order list --payment-status PAID --json
halo shop order get 1001 --json
halo shop order create --username demo --item 5:1:99 --json
halo shop order mark-paid 1001 --force
halo shop order fulfill 1001 --all --force --json
halo shop order note 1001 --message "Called the buyer"
```

`order fulfill --all` fulfills every remaining unfulfilled quantity. Use `--item <orderItemId>:<quantity>` for partial fulfillment.

Marketing:

```bash
halo shop coupon list --json
halo shop coupon create \
  --name "Spring sale" \
  --calculation-type PERCENTAGE \
  --discount-value 10 \
  --scope ALL \
  --valid-days 30
halo shop coupon distribute 1 --username demo
halo shop coupon get 1 --json   # distribution is asynchronous; poll to confirm
halo shop discount list --json
```

`coupon distribute` schedules issuance; a backend scheduler processes recipients asynchronously. Do not report the coupons as issued until `coupon get` shows the distribution as completed.

Statistics and configuration:

```bash
halo shop stats daily --start 2026-01-01 --end 2026-01-31 --json
halo shop config get --json
halo shop config set --guest-checkout true
halo shop config set --group payment --file payment.json
```

`config set --group` merges the file over the current group payload. Nested objects are replaced; omitted top-level groups are preserved.

## JSON Payloads

Payloads follow the Halo console API schemas. Common shapes:

Product request:

```json
{
  "title": "Digital license",
  "productType": "VIRTUAL",
  "status": "PUBLISHED",
  "description": "One-year license",
  "images": ["https://example.com/cover.png"],
  "content": "<p>Details</p>",
  "productVariants": [{ "price": 99, "skuCode": "DIGITAL-001", "status": "PUBLISHED" }]
}
```

Order create request:

```json
{
  "username": "demo",
  "items": [{ "productVariantId": 5, "quantity": 1, "customPrice": 99 }],
  "customerNotes": "Created by agent",
  "trackInventory": true
}
```

For `product update`, the CLI loads the current product first and merges the provided file and flags over it. For physical and virtual products, basic info, content, status, and specifications are updated through their dedicated endpoints so unrelated variant stock is not resubmitted. Variants are preserved unless the payload replaces `productVariants`. For an existing variant in the payload, fields omitted from the file are inherited from the current variant, so stock and other attributes are not reset. If an update needs confirmation, the CLI re-reads the product before writing specifications; provide explicit stock values if you intentionally want to overwrite concurrent changes.

FIXED variants require a `price`; only `pricingType: "INQUIRY"` variants may omit it. A new variant without an explicit `status` defaults to `DRAFT`; when updating, an existing variant that omits `status` keeps its current status. Set `--variant-status PUBLISHED` or include `status` in the file to make a variant purchasable.

## Safety

- `product delete`, `category delete`, `coupon delete`, `discount delete`, `order cancel`, `order mark-paid`, `order fulfill`, `product unpublish`, `product update --status DRAFT|ARCHIVED`, `product update --variant-status DRAFT|ARCHIVED` on a published product, `coupon update --enabled false`, `discount update --enabled false`, `coupon distribute --all`, and `customer update --status BLOCKED` require interactive confirmation or `--force` in non-interactive mode.
- `product update --file` follows full-array replacement for `productVariants`: removing any variant (including a draft variant, or sending an empty array) while the product is published requires confirmation.
- `order fulfill --all` skips subscription order lines. Subscription lines are fulfilled by the integrator and cannot be fulfilled manually. Use `--provider MANUAL`; the current backend does not expose a VIRTUAL fulfillment provider. Fulfillment cannot be reversed through the API, so confirm before using `--force`.
- Prefer `--json` and inspect the returned resource after every mutation.
- Do not print or send payment secrets from `shop config get --group payment`; treat them as credentials.
