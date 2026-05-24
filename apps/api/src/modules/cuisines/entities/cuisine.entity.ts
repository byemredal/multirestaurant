export interface Cuisine {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreCuisineAssignment {
  id: string;
  storeId: string;
  cuisineId: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface StoreCuisineDetail extends Cuisine {
  isPrimary: boolean;
}
