export interface Product {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  price: number;
  category: string;
  images: string[];
  modelFile?: string; // Path to 3D model file (Supabase storage path or null for R2)
  storageProvider?: 'supabase' | 'r2'; // Where the STL file is stored
  storageKey?: string; // R2 object key (for R2-stored files)
  fileSizeBytes?: number; // Original file size in bytes
  storageMetadata?: Record<string, any>; // Additional storage metadata
  variants?: ProductVariant[];
  inStock: boolean;
  featured?: boolean;
  specifications?: Record<string, string>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price?: number; // If different from base price
  attributes: Record<string, string>; // e.g., { color: "red", size: "medium" }
  sku?: string;
  inStock: boolean;
}

export interface CartItem {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: Address;
  subtotal: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'manufacturing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface CustomQuoteRequest {
  id: string;
  customerName: string;
  email: string;
  phone?: string;
  projectDescription: string;
  application?: string;
  quantity: number;
  dimensions?: string;
  material?: string;
  deadline?: string;
  attachments?: string[];
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
}

export type QuoteStatus =
  | 'submitted'
  | 'reviewing'
  | 'quoted'
  | 'accepted'
  | 'declined';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}
