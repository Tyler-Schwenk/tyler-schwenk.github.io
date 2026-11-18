"""
Each house machine's latest stats, from the monitor agents' reports.

Every machine runs pi/services/monitor-agent/monitor_agent.py, which pushes its storage,
memory, cpu and temperature every 30 s. This keeps the newest report per machine, keyed
by hostname, for the monitor page and the display.

It lives in memory only: it's a live view, not a history. A backend restart forgets every
machine until its next report. A machine that stops reporting stays listed, marked
offline, until the backend restarts. This relies on uvicorn running one worker.
"""

import time

# agents report every 30 s, so a few missed reports means the machine's down or asleep
DEVICE_ONLINE_WINDOW_S = 120

MS_PER_S = 1000


def now_ms() -> int:
    """Wall-clock time in epoch ms."""
    return int(time.time() * MS_PER_S)


class MonitorStore:
    """Keeps the newest report from each machine and when it arrived."""

    def __init__(self) -> None:
        """Starts empty: no machine has reported yet."""
        self._reports: dict[str, dict] = {}
        self._reported_ms: dict[str, int] = {}

    def set_report(self, report: dict) -> None:
        """
        Takes in a machine's report, replacing its last one.

        Args:
            report: A MonitorReport as a dict. Its name is the machine's hostname.
        """
        name = report["name"]
        self._reports[name] = report
        self._reported_ms[name] = now_ms()

    def state(self) -> dict:
        """
        Every machine's newest stats, for the monitor page.

        Returns:
            dict: `{"now_ms", "devices"}`, each device its last report plus `reported_ms`
                and `online` (reported within DEVICE_ONLINE_WINDOW_S), in name order.
        """
        current_ms = now_ms()
        online_window_ms = DEVICE_ONLINE_WINDOW_S * MS_PER_S
        devices = []
        for name in sorted(self._reports):
            reported_ms = self._reported_ms[name]
            devices.append({
                **self._reports[name],
                "reported_ms": reported_ms,
                "online": current_ms - reported_ms <= online_window_ms,
            })
        return {"now_ms": current_ms, "devices": devices}


store = MonitorStore()
