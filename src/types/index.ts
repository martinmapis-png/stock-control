export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockWithDetails {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  product: Product;
  warehouse: Warehouse;
}

export interface Movement {
  id: string;
  productId: string;
  warehouseId: string;
  type: "entrada" | "salida" | "ajuste";
  quantity: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  product?: Product;
  warehouse?: Warehouse;
}
