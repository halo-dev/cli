import { type CAC } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printAddressList, printCustomer, printCustomerList, printEntitlements } from "./format.js";
import {
  parseEnumListOption,
  parseEnumOption,
  parsePageOption,
  parsePositiveInteger,
  parseSizeOption,
  requireString,
} from "./input.js";
import type { CustomerStatus } from "./types.js";

const CUSTOMER_STATUSES = ["ACTIVE", "BLOCKED"] as const;
const CUSTOMER_TYPES = ["USER", "GUEST"] as const;

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface CustomerListOptions extends ShopCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  status?: string;
  type?: string;
  sort?: string;
}

interface CustomerUpdateOptions extends ShopCommandOptions {
  status?: string;
  note?: string;
  clearNote?: boolean;
  force?: boolean;
}

interface CustomerEntitlementsOptions extends ShopCommandOptions {
  product?: string;
}

export function buildCustomerCli(runtime: RuntimeContext): CAC {
  const customerCli = createShopCli("halo shop customer");

  customerCli
    .command("list", "List customers")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--status <status>", "Customer status: ACTIVE or BLOCKED")
    .option("--type <type>", "Customer type: USER or GUEST")
    .option("--sort <sort>", "Sort expression, e.g. id,desc")
    .action(async (options: CustomerListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const statuses = parseEnumListOption(options.status, CUSTOMER_STATUSES, "--status");
      const types = parseEnumListOption(options.type, CUSTOMER_TYPES, "--type");

      if (statuses && statuses.length > 1) {
        throw new CliError("--status accepts a single customer status.");
      }
      if (types && types.length > 1) {
        throw new CliError("--type accepts a single customer type.");
      }

      const page = await api.listCustomers({
        page: parsePageOption(options.page),
        size: parseSizeOption(options.size),
        keyword: options.keyword,
        status: statuses?.[0],
        type: types?.[0],
        sort: options.sort,
      });
      printCustomerList(page, options.json);
    });

  customerCli
    .command("get <id>", "Show customer details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const customer = await api.getCustomer(parsePositiveInteger(id, "Customer ID"));
      printCustomer(customer, options.json);
    });

  customerCli
    .command("update <id>", "Update a customer's status or internal note")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--status <status>", "ACTIVE or BLOCKED")
    .option("--note <text>", "Internal note")
    .option("--clear-note", "Clear the internal note")
    .option("--force", "Block the customer without confirmation")
    .action(async (id: string, options: CustomerUpdateOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const customerId = parsePositiveInteger(id, "Customer ID");
      const status = parseEnumOption(options.status, CUSTOMER_STATUSES, "--status");
      const clearNote = options.clearNote === true;

      if (clearNote && options.note !== undefined) {
        throw new CliError("Use either --note or --clear-note, not both.");
      }
      if (status === undefined && options.note === undefined && !clearNote) {
        throw new CliError("Provide at least one option: --status, --note, or --clear-note.");
      }
      if (options.note !== undefined && String(options.note).length > 500) {
        throw new CliError("Customer note must be at most 500 characters.");
      }

      if (
        status === "BLOCKED" &&
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop customer update",
            actionLabel: "Block",
            resourceLabel: "customer",
            resourceName: String(customerId),
            cancellationVerb: "blocking",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      const payload: { note?: string; status?: CustomerStatus } = {};
      if (clearNote) payload.note = "";
      else if (options.note !== undefined) payload.note = String(options.note);
      if (status !== undefined) payload.status = status;

      const customer = await api.updateCustomer(customerId, payload);

      if (options.json) {
        printJson(customer);
        return;
      }

      process.stdout.write(`Updated customer ${customerId}.\n`);
    });

  customerCli
    .command("addresses <id>", "List a customer's addresses")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const addresses = await api.listCustomerAddresses(parsePositiveInteger(id, "Customer ID"));
      printAddressList(addresses, options.json);
    });

  customerCli
    .command("entitlements <id>", "Show a customer's entitlements for a product")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--product <id>", "Product ID")
    .action(async (id: string, options: CustomerEntitlementsOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const customerId = parsePositiveInteger(id, "Customer ID");
      const productId = parsePositiveInteger(
        requireString(options.product, "--product is required."),
        "--product",
      );
      const entitlements = await api.getCustomerEntitlements(customerId, productId);
      printEntitlements(entitlements, options.json);
    });

  customerCli.usage("<command> [flags]");
  customerCli.example((bin) => `${bin} list --status ACTIVE`);
  customerCli.example((bin) => `${bin} get 1`);
  customerCli.example((bin) => `${bin} update 1 --status BLOCKED`);
  customerCli.example((bin) => `${bin} update 1 --clear-note`);
  customerCli.example((bin) => `${bin} addresses 1`);
  customerCli.example((bin) => `${bin} entitlements 1 --product 2`);
  customerCli.help();

  return customerCli;
}
