import axios, { type AxiosInstance } from "axios";

import { CliError } from "../../utils/errors.js";
import type {
  Address,
  Coupon,
  CouponRequest,
  Customer,
  CustomerStatus,
  DailyStatistics,
  Discount,
  DiscountRequest,
  FulfillmentRequest,
  Order,
  OrderCreateRequest,
  Page,
  Product,
  ProductCategory,
  ProductCategoryRequest,
  ProductRequest,
  ShopSetting,
} from "./types.js";

const SHOP_API_BASE = "/apis/console.api.ecommerce.halo.run/v1alpha1";

export interface ProductListQuery {
  page?: number;
  size?: number;
  keyword?: string;
  categoryId?: number;
  statuses?: string[];
  types?: string[];
  sort?: string;
}

export interface OrderListQuery {
  page?: number;
  size?: number;
  keyword?: string;
  customerId?: number;
  username?: string;
  orderCode?: string;
  statuses?: string[];
  paymentStatuses?: string[];
  fulfillmentStatuses?: string[];
  refundStatuses?: string[];
  startDate?: string;
  endDate?: string;
  sort?: string;
}

export interface CustomerListQuery {
  page?: number;
  size?: number;
  keyword?: string;
  status?: string;
  type?: string;
  sort?: string;
}

export interface CouponListQuery {
  page?: number;
  size?: number;
  keyword?: string;
  isEnabled?: boolean;
  sort?: string;
}

export interface DiscountListQuery {
  page?: number;
  size?: number;
  sort?: string;
}

interface RequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
}

function isMissingShopApi(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const detail = (data as Record<string, unknown>).detail;
  if (typeof detail !== "string") {
    return false;
  }

  // Spring reports an unknown route as "No static resource <path>". Resource-level
  // 404s from the shop API do not mention the API group.
  return /no static resource/i.test(detail) || detail.includes("console.api.ecommerce.halo.run");
}

function translateShopApiError(error: unknown): unknown {
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    if (isMissingShopApi(error.response.data)) {
      return new CliError(
        "Shop API is not available on this Halo instance. The shop commands require Halo Pro or Halo Commercial with the shop feature enabled.",
      );
    }
  }

  return error;
}

export class ShopApi {
  constructor(private readonly axios: AxiosInstance) {}

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    try {
      const response = await this.axios.request<T>({
        method,
        url: `${SHOP_API_BASE}${path}`,
        params: options.params,
        paramsSerializer: { indexes: null },
        data: options.data,
      });
      const data = response.data;
      return (data === "" || data === null ? undefined : data) as T;
    } catch (error) {
      throw translateShopApiError(error);
    }
  }

  private async getResource<T>(path: string, label: string): Promise<T> {
    const value = await this.request<T | undefined>("GET", path);
    if (value === undefined) {
      throw new CliError(`${label} was not found.`);
    }
    return value;
  }

  listProducts(query: ProductListQuery = {}): Promise<Page<Product>> {
    return this.request("GET", "/products", { params: { ...query } });
  }

  getProduct(id: number): Promise<Product> {
    return this.getResource(`/products/${id}`, `Product ${id}`);
  }

  createProduct(payload: ProductRequest): Promise<Product> {
    return this.request("POST", "/products", { data: payload });
  }

  updateProduct(id: number, payload: ProductRequest): Promise<Product> {
    return this.request("PUT", `/products/${id}`, { data: payload });
  }

  updateProductBasicInfo(
    id: number,
    payload: { title: string; handle?: string; description?: string; categoryId?: number },
  ): Promise<Product> {
    return this.request("PUT", `/products/${id}/basic-info`, { data: payload });
  }

  updateProductContent(
    id: number,
    payload: { content?: string; images?: string[] },
  ): Promise<Product> {
    return this.request("PUT", `/products/${id}/content`, { data: payload });
  }

  updateProductSpecifications(
    id: number,
    payload: Pick<ProductRequest, "specDefinition" | "productVariants">,
  ): Promise<Product> {
    return this.request("PUT", `/products/${id}/specifications`, { data: payload });
  }

  updateProductStatus(id: number, status: ProductRequest["status"]): Promise<Product> {
    return this.request("PUT", `/products/${id}/status`, { data: { status } });
  }

  deleteProduct(id: number): Promise<void> {
    return this.request("DELETE", `/products/${id}`);
  }

  listCategories(tree = false): Promise<ProductCategory[]> {
    return this.request("GET", "/product-categories", { params: tree ? { tree: true } : {} });
  }

  getCategory(id: number): Promise<ProductCategory> {
    return this.getResource(`/product-categories/${id}`, `Product category ${id}`);
  }

  createCategory(payload: ProductCategoryRequest): Promise<ProductCategory> {
    return this.request("POST", "/product-categories", { data: payload });
  }

  updateCategory(id: number, payload: ProductCategoryRequest): Promise<ProductCategory> {
    return this.request("PUT", `/product-categories/${id}`, { data: payload });
  }

  deleteCategory(id: number): Promise<void> {
    return this.request("DELETE", `/product-categories/${id}`);
  }

  listOrders(query: OrderListQuery = {}): Promise<Page<Order>> {
    return this.request("GET", "/orders", { params: { ...query } });
  }

  getOrder(id: number): Promise<Order> {
    return this.getResource(`/orders/${id}`, `Order ${id}`);
  }

  createOrder(payload: OrderCreateRequest): Promise<Order> {
    return this.request("POST", "/orders", { data: payload });
  }

  cancelOrder(id: number): Promise<void> {
    return this.request("POST", `/orders/${id}/cancel`);
  }

  markOrderAsPaid(id: number): Promise<void> {
    return this.request("POST", `/orders/${id}/mark-as-paid`);
  }

  fulfillOrder(id: number, payload: FulfillmentRequest): Promise<unknown> {
    return this.request("POST", `/orders/${id}/request-fulfillment`, { data: payload });
  }

  addOrderNote(id: number, message: string, payload?: string): Promise<unknown> {
    return this.request("POST", `/orders/${id}/timeline/notes`, {
      data: payload === undefined ? { message } : { message, payload },
    });
  }

  listCustomers(query: CustomerListQuery = {}): Promise<Page<Customer>> {
    return this.request("GET", "/customers", { params: { ...query } });
  }

  getCustomer(id: number): Promise<Customer> {
    return this.getResource(`/customers/${id}`, `Customer ${id}`);
  }

  updateCustomer(
    id: number,
    payload: { note?: string; status?: CustomerStatus },
  ): Promise<Customer> {
    return this.request("PATCH", `/customers/${id}`, { data: payload });
  }

  listCustomerAddresses(id: number): Promise<Address[]> {
    return this.request("GET", `/customers/${id}/addresses`);
  }

  getCustomerEntitlements(customerId: number, productId: number): Promise<unknown> {
    return this.request("GET", `/customers/${customerId}/entitlements`, {
      params: { productId },
    });
  }

  listCoupons(query: CouponListQuery = {}): Promise<Page<Coupon>> {
    return this.request("GET", "/coupons", { params: { ...query } });
  }

  getCoupon(id: number): Promise<Coupon> {
    return this.getResource(`/coupons/${id}`, `Coupon ${id}`);
  }

  createCoupon(payload: CouponRequest): Promise<Coupon> {
    return this.request("POST", "/coupons", { data: payload });
  }

  updateCoupon(id: number, payload: CouponRequest): Promise<Coupon> {
    return this.request("PUT", `/coupons/${id}`, { data: payload });
  }

  deleteCoupon(id: number): Promise<void> {
    return this.request("DELETE", `/coupons/${id}`);
  }

  distributeCoupon(
    id: number,
    payload: { allCustomers?: boolean; usernames?: string[] },
  ): Promise<unknown> {
    return this.request("POST", `/coupons/${id}/auto-distribute`, { data: payload });
  }

  listDiscounts(query: DiscountListQuery = {}): Promise<Page<Discount>> {
    return this.request("GET", "/discounts", { params: { ...query } });
  }

  getDiscount(id: number): Promise<Discount> {
    return this.getResource(`/discounts/${id}`, `Discount ${id}`);
  }

  createDiscount(payload: DiscountRequest): Promise<Discount> {
    return this.request("POST", "/discounts", { data: payload });
  }

  updateDiscount(id: number, payload: DiscountRequest): Promise<Discount> {
    return this.request("PUT", `/discounts/${id}`, { data: payload });
  }

  deleteDiscount(id: number): Promise<void> {
    return this.request("DELETE", `/discounts/${id}`);
  }

  getDailyStatistics(startDate?: string, endDate?: string): Promise<DailyStatistics[]> {
    return this.request("GET", "/statistics/orders/daily", {
      params: { startDate, endDate },
    });
  }

  getShopConfig(): Promise<ShopSetting> {
    return this.request("GET", "/ecommerceconfigs/shop");
  }

  updateShopConfig(payload: ShopSetting): Promise<ShopSetting | undefined> {
    return this.request("PUT", "/ecommerceconfigs/shop", { data: payload });
  }

  getConfigGroup(group: string): Promise<unknown> {
    return this.request("GET", `/ecommerceconfigs/${encodeURIComponent(group)}`);
  }

  updateConfigGroup(group: string, payload: unknown): Promise<unknown> {
    return this.request("PUT", `/ecommerceconfigs/${encodeURIComponent(group)}`, {
      data: payload,
    });
  }
}
