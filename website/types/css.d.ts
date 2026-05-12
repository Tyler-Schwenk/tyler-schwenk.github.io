// tells TypeScript to treat CSS imports as side-effect-only modules
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// leaflet ships its CSS as a bare module path with slashes, so the wildcard above
// doesnt cover it — need this explicit declaration too
declare module "leaflet/dist/leaflet.css";
