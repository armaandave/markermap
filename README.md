# MarkerMap - Personal Location Manager

A modern web application for managing personal location markers on an interactive map, with KML import capability, custom folders/categories, and rich marker metadata.

## Features

### ✅ Phase 1 MVP (Completed)
- **Interactive Mapbox Map**: Full-screen map with multiple style options (Dark, Light, Streets, Satellite, Outdoors)
- **KML Import**: Upload and parse KML files with folder hierarchy and custom fields
- **Marker Management**: Add markers by clicking on the map, view marker details
- **Folder System**: Create custom folders, toggle visibility, organize markers
- **Local Storage**: All data stored in IndexedDB using Dexie.js
- **Dark Theme**: Modern dark UI matching the design requirements
- **Mobile Responsive**: Touch-friendly interface with mobile-first design

### 🚧 Planned Features (Future Phases)
- **Supabase Integration**: Cloud sync and authentication
- **Image Support**: Upload and manage marker images
- **Custom Fields**: Dynamic field types (text, select, date, number)
- **PWA Features**: Offline support and installability
- **Advanced Search**: Filter markers by various criteria
- **Export Functionality**: Export to KML, GeoJSON, CSV

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Map**: Mapbox GL JS v3 with react-map-gl
- **Database**: IndexedDB with Dexie.js
- **State Management**: Zustand
- **Icons**: Lucide React
- **XML Parsing**: xml2js

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Mapbox account and access token

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd markermap
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` and add your Mapbox token:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```

4. **Get a Mapbox token**
   - Go to [Mapbox](https://www.mapbox.com/)
   - Sign up for a free account
   - Go to your account page and create a new access token
   - Copy the token and paste it in your `.env.local` file

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Adding Markers
1. Click the **+** button in the top-right corner
2. Click anywhere on the map to place a marker
3. Click on a marker to view its details

### Managing Folders
1. Open the sidebar (hamburger menu on mobile)
2. Click the **+** button next to "Folders" to create a new folder
3. Use the eye icon to toggle folder visibility on the map

### Importing KML Files
1. Open the sidebar
2. Click **"Import KML"**
3. Select a KML file from your computer
4. The app will parse and import all markers and folders

### Map Controls
- **Layer Switcher**: Change map style (top-right)
- **Add Marker**: Place new markers (top-right)
- **Current Location**: Center map on your GPS location (top-right)
- **Zoom Controls**: Zoom in/out (bottom-right)

## Project Structure

```
/app
  /page.tsx          # Main application page
  /layout.tsx        # Root layout with dark theme
/components
  /MapboxMap.tsx     # Main map component
  /Sidebar.tsx       # Sidebar with folders and import
/lib
  /db.ts            # IndexedDB schema and setup
  /kml-parser.ts    # KML file parsing utility
/store
  /mapStore.ts      # Zustand state management
```

## Database Schema

The app uses IndexedDB with the following structure:

- **Folders**: Organize markers into categories
- **Markers**: Individual location points with metadata
- **MarkerImages**: Associated images (future feature)
- **CustomFields**: Dynamic field definitions (future feature)
- **MarkerCustomValues**: Custom field values (future feature)

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Dependencies

- `react-map-gl` - React wrapper for Mapbox GL JS
- `mapbox-gl` - Mapbox GL JS library
- `dexie` - IndexedDB wrapper
- `zustand` - State management
- `xml2js` - XML/KML parsing
- `lucide-react` - Icon library

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the existing issues
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs

---

**Note**: This is Phase 1 MVP. Future phases will add cloud sync, authentication, image support, and PWA features.
