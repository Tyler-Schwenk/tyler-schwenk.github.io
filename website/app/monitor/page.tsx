import Navigation from "@/components/Navigation";
import MonitorDashboard from "@/components/monitor/MonitorDashboard";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "System Monitor",
  description: "Storage, memory, cpu and temperature for every machine that runs the house and this site, live.",
  path: "/monitor",
  image: ogCard("monitor", "pixel art raspberry pi"),
});

/**
 * the system monitor. everything's live from the backend, so the page itself
 * is just the shell.
 *
 * @returns {JSX.Element} the page.
 */
export default function MonitorPage() {
  return (
    <>
      <Navigation />
      <MonitorDashboard />
    </>
  );
}
