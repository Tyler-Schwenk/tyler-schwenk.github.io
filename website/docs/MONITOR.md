# System Monitor

`/monitor` shows every house machine's storage, memory, cpu, temperature and uptime, live. The
same components run on the display kiosk as the "System monitor" slot (see `DISPLAY.md`), and so
on the console page too.

Each machine's monitor agent reports every 30 s (`pi/docs/services/monitor-agent.md`); the page
polls `GET /monitor` (`pi/docs/api/website-backend-api.md`, "Monitor") on the same interval.

The home page links here from the Raspberry Pi on the house floor (`/images/8bit/pi.png`, see
`HOME.md`). The link preview card is `public/images/og/monitor.jpg`.

## Files

| File | Purpose |
|------|---------|
| `app/monitor/page.tsx` | The page shell and its metadata |
| `app/monitor/monitorApi.ts` | Types for the endpoint's json, and `fetchMonitorState` |
| `app/monitor/monitorFormat.ts` | Units, thresholds, machine roles and order, volume names, fill levels and totals |
| `lib/useMonitor.ts` | Polls every 30 s. On a failed poll it keeps the last numbers and reports the error |
| `components/monitor/MonitorDashboard.tsx` | The page body: totals, then a card per machine |
| `components/monitor/DeviceStorage.tsx` | A machine's disks: the split bar and the volume list |
| `components/monitor/DeviceVitals.tsx` | A machine's memory, cpu, temperature, uptime and battery tiles |
| `components/monitor/MonitorParts.tsx` | `Meter`, `SeverityTag`, `DeviceHeader`, `StorageLegend` |
| `components/monitor/monitor.module.css` | The look, for the page and the display |
| `app/display/MonitorPanels.tsx` | The kiosk's two panels, built from the same components |

## What it shows

**Totals** (page only): space used of what's usable on mounted filesystems, space not in use
(unmounted partitions, unallocated and unpartitioned space), raw disk space, and machines online.

**Each machine**: its hostname, online or "offline, last report 5 min ago" (an offline machine's
numbers are its last report's, dimmed), its role and model, then:

- **Vitals**: memory in use (counting reclaimable cache as free) with a meter, and swap once any
  is in use; cpu usage over the last 30 s with the 1-minute load; cpu temperature; uptime; and
  on displaytop the battery and whether it's plugged in
- **Storage**: each physical disk named by how it's attached ("sd card", "usb drive", "nvme
  ssd"), then a bar split into its partitions to scale: used and free for mounted filesystems,
  gray for swap, hatched for space nothing's using. Under it, a row per partition with its
  mount point, a meter, and "used of usable" the way `df` counts it

**Thresholds** (`monitorFormat.ts`): storage and memory warn from 80% full and go critical from
90%; temperature warns from 70 C and goes critical from 80 C (where Pis start throttling). A
flagged meter turns yellow or red and always gets a warning icon and words with it ("getting
full", "nearly full", "running low", "running warm"), never just the color.

**Units**: disks are decimal (1 GB = 1000^3 bytes), the way drives are sold, so the 500GB SSD
reads 500 GB. Memory is binary (1 GB = 1024^3 bytes), the way RAM is sold, so the 8GB Pi reads
7.9 GB.

**Machine order and roles**: `DEVICE_ROLES` in `monitorFormat.ts`. Machines in it come first in
its order, with their role line; anything else reports fine and goes last by name, without one.

## Look

The page is light or dark with the OS setting; the display is always dark (`.dark`). Colors are
tokens at the top of `monitor.module.css`: meters are a blue fill on a lighter blue track, with
warning and critical swapping both for their own pair, and idle space is hatched gray so it never
reads as usage. Text is Inter, with IBM Plex Mono (`--font-garden-mono`) for names and mount
points.

Every size in the module is in `em`, so one font size on the root scales everything: 16px on the
page, 26px on the kiosk's storage panel (2560 px wide) and 28px on its vitals panel (2256 px,
kept clear of the laptop screen's blocked bottom). That's also why the display panels work at
native resolution inside the console page's simulated screens.

On phones, the vitals stack above the storage, and each volume's bar drops under its name.
