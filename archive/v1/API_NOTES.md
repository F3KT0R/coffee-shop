# API Connection Notes

## Current Setup (November 2025)

The frontend is currently connecting to the **sitemap-data** endpoint:
- Endpoint: `https://kafeshop-api.netlify.app/sitemap-data`
- Format: Legacy format (requires transformation)
- Status: ✅ Working with Firebase backend

## Data Transformation

The `api.ts` service automatically transforms the old sitemap-data format to the new Product interface:

**Old Format:**
```json
{
  "id": 1,
  "image": "https://...",
  "brand": "Nescafé",
  "price": 880,
  "system": "Dolce Gusto",
  "pods": 16,
  "notAvailable": false
}
```

**New Format:**
```typescript
{
  id: string;
  name: string;
  brand: string;
  system: string;
  image_url: string;
  price_rsd: number;
  pod_count?: number;
  in_stock: boolean;
  // ... and 20+ more fields
}
```

## Migration to New API

Once the Firebase backend deploys the full `/api/products` endpoint with v2.0 format:

1. Update the API service to use `/api/products` directly
2. Remove the transformation logic
3. Update `.env` if needed
4. Test all filters and pagination

## Troubleshooting

### "Failed to fetch" Error
- Check CORS settings on the backend
- Verify the API URL is correct
- Check browser console for detailed errors
- Ensure Firebase backend is deployed and running

### Empty Products
- Check that the `category` parameter matches the backend
- Verify the data transformation is working
- Check the backend has products in Firebase

### Images Not Loading
- Ensure image URLs are valid
- Check if CORS allows loading images
- Verify the `image_url` field is populated
