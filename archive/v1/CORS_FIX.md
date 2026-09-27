# CORS Configuration Required

## Issue
The frontend is getting CORS errors when trying to fetch from the backend API.

## ⚠️ IMPORTANT: Netlify Functions CORS

**`netlify.toml` headers DON'T work for Netlify Functions!**

They only work for static files. For Functions, you MUST add CORS headers in the function code itself.

## Solution for Backend

### ✅ REQUIRED: Add CORS in Function Code

In your backend's Netlify Function (e.g., `netlify/functions/products.ts` or `.js`), add headers:

```typescript
// netlify/functions/products.ts (or products.js)

export const handler = async (event, context) => {
  // CORS Headers - MUST be in every response
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Your actual handler code...
    const data = await getProducts(); // Your logic here

    return {
      statusCode: 200,
      headers, // MUST include headers!
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers, // MUST include headers even for errors!
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### Full Example with Firebase

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  // your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: products,
        pagination: {
          page: 1,
          limit: products.length,
          total: products.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

## Quick Fix Checklist

1. ✅ Open your backend function file (e.g., `netlify/functions/products.ts`)
2. ✅ Add `headers` object with CORS headers (see example above)
3. ✅ Add `if (event.httpMethod === 'OPTIONS')` handler
4. ✅ Include `headers` in ALL return statements
5. ✅ Deploy backend: `netlify deploy --prod`
6. ✅ Wait 1-2 minutes for deployment
7. ✅ Test frontend

## Debugging

Check in browser console (F12) what the actual error says:
- If it says "No 'Access-Control-Allow-Origin' header" → Headers not in function response
- If it says "preflight" or "OPTIONS" → Missing OPTIONS handler
- If it says 404 → Function endpoint wrong

## Testing the Endpoint Directly

Try in browser or Postman:
```
GET https://kafeshop-api.netlify.app/.netlify/functions/products?page=1&currency=rsd
```

Or with curl:
```bash
curl -v https://kafeshop-api.netlify.app/.netlify/functions/products?page=1
```

Look for `Access-Control-Allow-Origin` in response headers.
