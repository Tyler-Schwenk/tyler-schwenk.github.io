/**
 * Display panel: stand-in for a panel that isn't built yet. Shows the
 * intended panel's name so the rotation scaffold is complete before each
 * panel's real content lands.
 */

interface PlaceholderPanelProps {
  name: string;
}

export default function PlaceholderPanel({ name }: PlaceholderPanelProps) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-mono text-gray-500">
      <div className="text-sm uppercase tracking-widest mb-3">Coming Soon</div>
      <div className="text-4xl text-gray-300">{name}</div>
    </div>
  );
}
