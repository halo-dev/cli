export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

export type ProductType = "PHYSICAL" | "VIRTUAL" | "EXTERNAL" | "SUBSCRIPTION";
export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PricingType = "FIXED" | "INQUIRY";
export type OrderStatus = "OPEN" | "ARCHIVED" | "CANCELLED";
export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZING"
  | "PAID"
  | "REFUNDED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";
export type FulfillmentStatus = "PENDING" | "PROCESSING" | "FULFILLED";
export type RefundStatus = "NONE" | "PARTIAL" | "FULL";
export type CustomerStatus = "ACTIVE" | "BLOCKED";
export type CustomerType = "USER" | "GUEST";
export type CalculationType = "AMOUNT" | "PERCENTAGE";
export type DiscountScope = "ALL" | "QUALIFYING_ITEMS";
export type DiscountApplication = "AUTOMATIC" | "CODE";

export interface SpecDefinitionValue {
  value: string;
}

export interface SpecDefinition {
  id?: string;
  name: string;
  usedForSku?: boolean;
  values?: SpecDefinitionValue[];
}

export interface SpecValue {
  specId?: string;
  name?: string;
  value: string;
}

export interface ProductVariant {
  id?: number;
  productId?: number;
  specValues?: SpecValue[];
  price?: number;
  originalPrice?: number;
  pricingType?: PricingType;
  trackInventory?: boolean;
  stock?: number;
  maxPerOrder?: number;
  maxPerUser?: number;
  skuCode?: string;
  barcode?: string;
  shippingProfileId?: number;
  shippingRequired?: boolean;
  weightG?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  imageUrl?: string;
  status?: ProductStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: number;
  handle?: string;
  permalink?: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  productType: ProductType;
  specDefinition?: SpecDefinition[];
  categoryId?: number;
  status: ProductStatus;
  externalLinkUrl?: string;
  externalLinkButtonText?: string;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
  images?: string[];
  productVariants?: ProductVariant[];
  minPrice?: number;
  maxPrice?: number;
  minOriginalPrice?: number;
  maxOriginalPrice?: number;
}

export interface ProductRequest {
  title: string;
  productType: ProductType;
  status: ProductStatus;
  handle?: string;
  description?: string;
  categoryId?: number;
  externalLinkUrl?: string;
  externalLinkButtonText?: string;
  content?: string;
  images?: string[];
  specDefinition?: SpecDefinition[];
  productVariants?: ProductVariant[];
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: number;
  children?: ProductCategory[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductCategoryRequest {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: number;
}

export interface OrderItem {
  id: number;
  productVariantId?: number;
  productId?: number;
  quantity: number;
  refundedQuantity?: number;
  fulfilledQuantity?: number;
  unitPrice?: number;
  subtotal?: number;
  discountAmount?: number;
  itemTitle?: string;
  itemImageUrl?: string;
  subscriptionMetadata?: Record<string, unknown> | null;
}

export interface OrderShippingAddress {
  firstName?: string;
  lastName?: string;
  contactPhone?: string;
  province?: string;
  city?: string;
  district?: string;
  streetAddress?: string;
  postalCode?: string;
}

export interface Customer {
  id: number;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  phone?: string;
  note?: string;
  tags?: string[];
  acceptsMarketing?: boolean;
  ordersCount?: number;
  totalSpent?: number;
  type?: CustomerType;
  status?: CustomerStatus;
  createdAt?: string;
  lastOrderAt?: string;
  lastSeenAt?: string;
}

export interface Order {
  id: number;
  orderCode?: string;
  customerId?: number;
  totalAmount?: number;
  subtotalAmount?: number;
  discountAmount?: number;
  shippingAmount?: number;
  payableAmount?: number;
  paidAmount?: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  refundStatus?: RefundStatus;
  customerNotes?: string;
  ipAddress?: string;
  shippingAddress?: OrderShippingAddress;
  items?: OrderItem[];
  customer?: Customer;
  discountCode?: string;
  discountName?: string;
  couponDiscountAmount?: number;
  paidAt?: string;
  fulfilledAt?: string;
  autoConfirmAt?: string;
  confirmAt?: string;
  expireAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderCreateItem {
  productVariantId: number;
  quantity: number;
  customPrice: number;
  subscriptionTrial?: boolean;
}

export interface OrderCreateRequest {
  username: string;
  items: OrderCreateItem[];
  customerNotes?: string;
  trackInventory?: boolean;
}

export interface FulfillmentItemRequest {
  orderItemId: number;
  quantity: number;
}

export interface FulfillmentLabelRequest {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
}

export interface FulfillmentRequest {
  provider?: "MANUAL" | "VIRTUAL";
  items: FulfillmentItemRequest[];
  labels?: FulfillmentLabelRequest[];
}

export interface Address {
  id: number;
  customerId?: number;
  firstName?: string;
  lastName?: string;
  contactPhone?: string;
  province?: string;
  provinceCode?: string;
  city?: string;
  cityCode?: string;
  district?: string;
  districtCode?: string;
  streetAddress?: string;
  postalCode?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Coupon {
  id: number;
  name: string;
  description?: string;
  calculationType: CalculationType;
  discountValue: number;
  maxDiscountAmount?: number;
  scope: DiscountScope;
  qualifyingProductIds?: number[];
  qualifyingCategoryIds?: number[];
  excludedProductIds?: number[];
  excludedCategoryIds?: number[];
  excludeSaleItems?: boolean;
  minOrderAmount?: number;
  totalCount?: number;
  issuedCount?: number;
  perCustomerLimit?: number;
  isEnabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  validDays: number;
  combineWithCoupons?: boolean;
  combineWithOrderDiscount?: boolean;
  distributionProcessedCount?: number;
  distributionStartedAt?: string;
  distributionCompletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CouponRequest {
  name: string;
  description?: string;
  calculationType: CalculationType;
  discountValue: number;
  maxDiscountAmount?: number;
  scope: DiscountScope;
  qualifyingProductIds?: number[];
  qualifyingCategoryIds?: number[];
  excludedProductIds?: number[];
  excludedCategoryIds?: number[];
  excludeSaleItems?: boolean;
  minOrderAmount?: number;
  totalCount?: number;
  perCustomerLimit?: number;
  isEnabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  validDays: number;
  combineWithCoupons?: boolean;
  combineWithOrderDiscount?: boolean;
}

export interface Discount {
  id: number;
  name: string;
  description?: string;
  application: DiscountApplication;
  calculationType: CalculationType;
  discountValue: number;
  maxDiscountAmount?: number;
  scope: DiscountScope;
  code?: string;
  productIds?: number[];
  categoryIds?: number[];
  excludedProductIds?: number[];
  excludedCategoryIds?: number[];
  excludeSaleItems?: boolean;
  minOrderAmount?: number;
  totalUsageLimit?: number;
  usageLimitPerCustomer?: number;
  usageCount?: number;
  isEnabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiscountRequest {
  name: string;
  description?: string;
  application: DiscountApplication;
  calculationType: CalculationType;
  discountValue: number;
  maxDiscountAmount?: number;
  scope: DiscountScope;
  code?: string;
  productIds?: number[];
  categoryIds?: number[];
  excludedProductIds?: number[];
  excludedCategoryIds?: number[];
  excludeSaleItems?: boolean;
  minOrderAmount?: number;
  totalUsageLimit?: number;
  usageLimitPerCustomer?: number;
  isEnabled?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface DailyStatistics {
  date: string;
  orders: number;
  sales: number;
  productsSold: number;
  customers: number;
}

export interface ContactInformation {
  label: string;
  icon?: string;
  type?: "LINK" | "IMAGE";
  linkLabel?: string;
  linkUrl?: string;
  image?: string;
  imageHref?: string;
  help?: string;
}

export interface ShopSetting {
  contacts?: ContactInformation[];
  inquiryRedirectUrl?: string;
  guestCheckoutEnabled?: boolean;
  subscriptionMenuEnabled?: boolean;
}

export interface LicenseActivation {
  spec?: {
    productName?: string;
  };
  status?: {
    state?: string;
  };
}
