# Pac-Tyler Implementation Guide

## Overview
Pac-Tyler is a modern, interactive web page showcasing a gamified biking challenge where the goal is to bike every street in San Diego. The implementation integrates with external GeoJSON data from a Python backend that processes Strava API data.

## Architecture

### Frontend (This Repository)
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with retro Pac-Man theme
- **Mapping**: Leaflet.js for interactive maps
- **Data Fetching**: Client-side fetch from GitHub API

### Backend (Separate Repository)
- **Repository**: [Tyler-Schwenk/Pac-Tyler](https://github.com/Tyler-Schwenk/Pac-Tyler)
- **Language**: Python 3.x
- **Data Source**: Strava API
- **Output**: GeoJSON file with cleaned GPS tracks

## Component Structure

### 1. `app/pac-tyler/page.tsx`
Main page component containing:
- Header with Pac-Tyler logo
- Retro arcade-style title bar (1UP, PAC-TYLER, HI SCORE)
- Project description
- Pac-Tom inspiration credit
- PacTylerMap component integration
- Technical details section

**Key Features**:
- Server component (statically generated)
- Optimized images with Next.js Image component
- Responsive layout with Tailwind

### 2. `components/PacTylerMap.tsx`
Wrapper component that dynamically loads the map to avoid SSR issues.

**Why Dynamic Import?**
Leaflet requires browser APIs (`window`, `document`) which aren't available during Next.js static site generation. The dynamic import with `ssr: false` ensures the map only loads on the client side.

**Loading State**:
Shows a loading indicator with the same styling as the final map.

### 3. `components/PacTylerMapClient.tsx`
Client-side map implementation with full Leaflet integration.

**Responsibilities**:
- Initialize Leaflet map centered on San Diego
- Fetch GeoJSON data from GitHub
- Calculate statistics from activity data
- Render GPS tracks in Pac-Man gold (#E3B800)
- Display interactive popups with activity details
- Show retro-styled statistics dashboard

**Data Flow**:
```
1. Component mounts → useEffect triggers
2. Initialize Leaflet map with dark tiles
3. Fetch GeoJSON from GitHub
4. Parse and validate data
5. Calculate statistics (distance, activities, dates)
6. Render GeoJSON layer on map
7. Update state with stats
8. Display dashboard and legend
```

## Data Structure

### GeoJSON Format
```typescript
interface GeoJSONData {
  type: "FeatureCollection";
  features: ActivityFeature[];
}

interface ActivityFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // [lon, lat] pairs
  };
  properties: {
    name: string;        // Activity name
    date: string;        // ISO 8601 date
    distance: number;    // Meters
    type: string;        // "Ride", "Run", etc.
    activity_id?: number; // Strava activity ID when available
  };
}
```

### Statistics Calculated
- **Total Distance**: Sum of all activity distances (converted to miles)
- **Total Activities**: Count of features in GeoJSON
- **Longest Ride**: Maximum single activity distance
- **First Activity**: Earliest date in dataset
- **Last Activity**: Most recent date in dataset
- **Progress**: Percentage based on estimated 1000 total activities

## Styling

### Color Scheme
- **Primary Gold**: `#E3B800` - Pac-Man inspired signature color
- **Background**: `#1a1a1a` - Off-black for retro feel
- **Dark Theme**: CartoDB dark basemap tiles
- **Accents**: Gold shadows and borders for glow effect

### Retro Elements
- Monospace fonts (Courier New, font-mono)
- Emoji icons for visual interest
- Border glow effects with CSS box-shadow
- Arcade-style stat cards
- "1UP" and "HI SCORE" references

## Technical Decisions

### Why Leaflet Instead of Google Maps?
- Open source and free
- Better performance with large GeoJSON datasets
- More customizable styling
- Dark theme support out of the box
- No API key required

### Why Client-Side Data Fetching?
- GeoJSON file updates independently of website deployments
- Latest activity data loads automatically
- Reduces build time (no static generation of data)
- Simplifies Python backend workflow

### Why Separate Map Component Files?
- Better code organization
- Isolates SSR concerns to wrapper component
- Easier to test and maintain
- Clear separation of concerns

## Development Workflow

### Running Locally
```bash
npm run dev
# Visit http://localhost:3000/pac-tyler
```

The map will:
1. Show loading state
2. Fetch latest GeoJSON from GitHub
3. Render routes and statistics
4. Allow interaction with map and popups

### Building for Production
```bash
npm run build
# Outputs to ./out directory
```

The build process:
1. Statically generates page HTML
2. Bundles client-side JavaScript
3. Optimizes images
4. Creates static export for GitHub Pages

### Updating Activity Data
1. Ensure Strava credentials are available in the environment or a `.env` file (supported locations: `setup-pac-tyler/Pac-Tyler/.env` and `setup-pac-tyler/.env`) as `CLIENT_ID` and `CLIENT_SECRET`
2. Run the updater in `setup-pac-tyler/Pac-Tyler/startup.py`
3. Authorize in the browser when prompted by Strava OAuth
4. The script reads the most recent activity timestamp in `cleaned_output.geojson`, applies a small lookback window plus a time offset, and fetches newer activities from Strava
  - Optional override: set `PAC_TYLER_LOOKBACK_DAYS` to change the lookback window
5. It adds only new activities (based on `activity_id` when available), splits large pauses, normalizes fields, and writes `cleaned_output.geojson` at the Pac-Tyler repo root
6. Commit and push the updated `cleaned_output.geojson` to GitHub
7. The frontend automatically fetches new data on the next page load

No website rebuild is required.

## Error Handling

### Network Errors
If GitHub API is unreachable:
- Displays error message with details
- Maintains page layout
- Suggests user to refresh

### Empty Data
If GeoJSON is empty:
- Shows friendly message: "No activity data available yet. Start biking!"
- Map still loads and can be interacted with
- Graceful degradation

### Invalid Data
If GeoJSON structure is incorrect:
- TypeScript prevents most type errors at compile time
- Runtime validation with try/catch
- Console logs for debugging

## Performance Optimizations

### Image Optimization
- Next.js Image component with `priority` flag for logo
- Automatic WebP conversion
- Responsive sizing

### Code Splitting
- Dynamic import reduces initial bundle size
- Leaflet only loads when map is needed
- Separate client/server components

### Data Processing
- Statistics calculated once after data fetch
- Memoized in component state
- No redundant calculations on re-renders

### Data Cleaning
- Activity `type` values are normalized (e.g., `root='Run'` becomes `Run`)
- Dates are normalized to ISO 8601 format
- Coordinates are validated and can optionally be simplified by setting a minimum distance threshold

## Future Enhancements

### Potential Improvements
1. **Street Coverage Map**: Overlay street network and highlight completed vs. remaining
2. **Activity Heatmap**: Show most frequently biked areas
3. **Time Range Filter**: Filter activities by date range
4. **Activity Type Toggle**: Show/hide different activity types
5. **Pac-Man Animations**: Add animated Pac-Man following recent routes
6. **Milestone Markers**: Add ghost icons for specific achievements
7. **Progress Bar**: Visual progress indicator toward goal
8. **Social Sharing**: Generate shareable images of stats

### Technical Debt
- Add unit tests for statistics calculation
- Add E2E tests for map interaction
- Implement better error boundaries
- Add retry logic for failed fetches
- Cache GeoJSON locally to reduce API calls

## Dependencies

### Production
- `next`: ^16.0.10
- `react`: ^19.0.0
- `leaflet`: Latest version for mapping
- `@types/leaflet`: TypeScript definitions

### Development
- `typescript`: Latest version
- `tailwindcss`: Latest version
- `eslint`: Code linting
- `prettier`: Code formatting

## Deployment

### Automatic Deployment
- Push to `main` branch triggers GitHub Actions
- Builds Next.js static site
- Deploys to GitHub Pages
- Live at https://tyler-schwenk.github.io/pac-tyler

### Manual Verification
1. Test locally: `npm run dev`
2. Build: `npm run build`
3. Check output: `ls out/pac-tyler.html`
4. Preview: `npm run start`
5. Commit and push

## Troubleshooting

### Map Not Loading
**Issue**: Blank screen or loading spinner forever  
**Solution**: Check browser console for errors, verify GeoJSON URL is accessible

### Statistics Not Showing
**Issue**: Map loads but no stats dashboard  
**Solution**: Check GeoJSON has valid features array, verify data structure matches interfaces

### Build Errors
**Issue**: "window is not defined"  
**Solution**: Ensure PacTylerMapClient is dynamically imported with `ssr: false`

### Styling Issues
**Issue**: Map or components not styled correctly  
**Solution**: Check Tailwind classes are valid, verify Leaflet CSS is imported

## Maintenance

### Regular Tasks
- Monitor Strava API for changes
- Update dependencies monthly: `npm update`
- Check for Next.js breaking changes
- Verify GeoJSON structure remains consistent
- Test on different browsers/devices

### Monitoring
- Check GitHub Actions for failed deployments
- Monitor bundle size in build output
- Verify map loads on live site
- Test data fetching from GitHub API

## Contact

For questions or issues with the Pac-Tyler implementation:
- **Developer**: Tyler Schwenk
- **Email**: tylerschwenk1@yahoo.com
- **GitHub**: [@Tyler-Schwenk](https://github.com/Tyler-Schwenk)

---

*Last Updated: December 2025*
