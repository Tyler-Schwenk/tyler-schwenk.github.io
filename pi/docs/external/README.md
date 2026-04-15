# External Documentation

Public-facing documentation for integrating with tyler-schwenk.com backend API.

## For Frontend Developers

This folder contains everything needed to integrate the Photo Gallery API into the tyler-schwenk.com website (or other frontends).

### Quick Links

- **[Frontend Integration Guide](frontend-integration.md)** - Complete guide for integrating with Next.js/React website
- **[Gallery API Reference](gallery-api-reference.md)** - Full API endpoint documentation
- **Interactive API Docs:** https://api.tyler-schwenk.com/docs

### Getting Started

1. Read [Frontend Integration Guide](frontend-integration.md) for setup and examples
2. Reference [Gallery API Reference](gallery-api-reference.md) for endpoint details
3. Use the interactive docs at https://api.tyler-schwenk.com/docs to test endpoints

### API Base URL

```
https://api.tyler-schwenk.com
```

### Quick Example

```typescript
// Fetch all galleries
const galleries = await fetch('https://api.tyler-schwenk.com/galleries')
  .then(r => r.json());

// Get specific gallery
const gallery = await fetch('https://api.tyler-schwenk.com/galleries/slug/jordan')
  .then(r => r.json());

// Display photo
<img src="https://api.tyler-schwenk.com/galleries/photos/123/file?thumbnail=true" />
```

### Available Galleries

- jordan (32 photos)
- durango (30 photos)
- friends (25 photos)
- italy (28 photos)
- aspen (24 photos)
- family (20 photos)
- telluride (19 photos)
- brothers (18 photos)
- college (16 photos)
- moab (12 photos)
- dad (11 photos)
- mom (8 photos)
- cats (8 photos)
- cedaredge (8 photos)
- sam (7 photos)
- dylan (5 photos)

### Support

- Health Check: https://api.tyler-schwenk.com/health
- Interactive Docs: https://api.tyler-schwenk.com/docs
