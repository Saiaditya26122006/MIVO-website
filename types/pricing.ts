// MIVO Pricing Types

export type PricingMethod = 'fixed' | 'configurable' | 'quote';

export interface SizeOption {
  name: string;
  dimensions: string;
  price: number; // Final price for this size
}

export interface MaterialOption {
  name: string;
  priceAdjustment: number; // Added to base/size price
}

export interface ColorOption {
  name: string;
  additionalCharge: number; // Added to final price
}

export interface FixedPricingConfig {
  basePrice: number;
}

export interface ConfigurablePricingConfig {
  basePrice: number;
  sizes?: SizeOption[];
  materials?: MaterialOption[];
  colors?: ColorOption[];
}

export interface QuotePricingConfig {
  requiredInfo?: string[]; // e.g., ['dimensions', 'quantity', 'material']
  referencePhotosRequired?: boolean;
}

export type PricingConfig =
  | FixedPricingConfig
  | ConfigurablePricingConfig
  | QuotePricingConfig;

export interface ProductConfiguration {
  sizeIndex?: number;
  materialIndex?: number;
  colorIndex?: number;
  quantity: number;
}

export interface PriceBreakdown {
  basePrice: number;
  sizePrice?: number;
  materialAdjustment?: number;
  colorCharge?: number;
  quantity: number;
  unitPrice: number;
  total: number;
  details: {
    size?: string;
    material?: string;
    color?: string;
  };
}

export interface Product {
  id: string;
  name: string;
  description: string;
  long_description?: string;
  price: number; // Legacy field, kept for backward compatibility
  category: string;
  images: string[];
  in_stock: boolean;
  featured: boolean;
  published: boolean;
  specifications: Record<string, any>;
  tags?: string[];

  // New pricing fields
  pricing_method: PricingMethod;
  pricing_config: PricingConfig;
  production_time_days?: number;
  min_quantity: number;
  max_quantity: number;

  created_at: string;
  updated_at: string;
}
