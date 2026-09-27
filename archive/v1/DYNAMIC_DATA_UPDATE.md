# Dynamic Systems & Brands Update

## Overview
Updated the coffee shop frontend to dynamically fetch systems and brands from the backend API instead of using hardcoded data.

## Changes Made

### 1. Type Definitions (`src/types/index.ts`)
- Added `System` interface for API system data
- Added `SystemsResponse` interface for `/api/systems` response
- Added `Brand` interface for API brand data
- Added `BrandsResponse` interface for `/api/brands` response
- Updated `SystemCategory.type` to accept dynamic string values

### 2. API Service (`src/services/api.ts`)
- Updated `getSystems()` to fetch from `/api/systems` endpoint
  - Returns array of System objects with id, name, slug, description, product_count, brand_count
- Updated `getBrands(system?)` to fetch from `/api/brands` endpoint
  - Optional system parameter to filter brands by system
  - Returns array of Brand objects with id, name, slug, product_count, systems

### 3. Custom Hook (`src/hooks/useBrands.ts`) **NEW**
- Created `useBrands(system?)` hook for fetching brands
- Automatically refetches when system filter changes
- Provides loading and error states
- Used in FilterBar component

### 4. FilterBar Component (`src/components/FilterBar.tsx`)
- Now accepts `activeBrand` and `onBrandChange` props
- Uses `useBrands()` hook to fetch brands dynamically
- Shows brand filter section when brands are available
- Brands update automatically when system changes
- Added loading state for brand buttons

### 5. FilterBar Styles (`src/components/FilterBar.scss`)
- Added `.filter-bar__brands` section styling
- Horizontal scrollable brand buttons
- Smaller buttons compared to system filters
- Filter label with uppercase styling
- Disabled state styling for loading

### 6. App Component (`src/App.tsx`)
- Fetches systems dynamically on mount from `/api/systems`
- Converts API System objects to SystemCategory format
- Added `activeBrand` state management
- Updated `fetchProducts()` to include brand parameter
- Added `handleBrandChange()` for brand filtering
- Brand resets when system changes
- FilterBar now receives brand props

## API Endpoints Used

```typescript
// Get all systems
GET https://kafeshop-api.netlify.app/api/systems
Response: {
  data: System[],
  total: number
}

// Get all brands
GET https://kafeshop-api.netlify.app/api/brands
Response: {
  data: Brand[],
  total: number,
  filters: { system: string }
}

// Get brands filtered by system
GET https://kafeshop-api.netlify.app/api/brands?system=dolce-gusto
Response: {
  data: Brand[],
  total: number,
  filters: { system: "dolce-gusto" }
}
```

## Features

### Dynamic Systems
- ✅ Systems load from backend on app mount
- ✅ No hardcoded system data
- ✅ Shows actual product and brand counts
- ✅ Automatically updates if backend data changes

### Dynamic Brands
- ✅ Brands load based on selected system
- ✅ Shows all brands when no system selected
- ✅ Shows system-specific brands when system is active
- ✅ Brand count displayed in tooltips
- ✅ Brand filter resets when changing systems
- ✅ Horizontal scrollable on mobile

### Product Filtering
- ✅ Products filter by system + brand combination
- ✅ Products filter by system + search
- ✅ Products filter by brand + search
- ✅ All filters work together

## User Experience

1. **Initial Load**: Systems populate from API
2. **Select System**: Brands for that system load automatically
3. **Select Brand**: Products filter to system + brand
4. **Change System**: Brand filter resets, new brands load
5. **Search**: Works across all filters

## Future Enhancements

- Add brand logos/images
- Show product count in system/brand buttons
- Add "Popular Brands" section
- Filter by multiple brands
- Save filter preferences to localStorage
- Add brand descriptions in tooltips
