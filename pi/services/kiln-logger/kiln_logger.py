#!/usr/bin/env python3
"""
Kiln logger: reads a MAX31856 thermocouple amp over SPI and sends readings to fart-pi.

Runs on castpi as kiln-logger.service. It only samples, buffers and sends. Storing and
any processing happen on fart-pi (see pi/docs/services/kiln-logger.md).

Stdlib only, apart from python3-spidev.
"""

import collections
import json
import logging
import threading
import time
import urllib.request
from pathlib import Path

import spidev

# lan address, not api.tyler-schwenk.com: logging shouldn't depend on the internet, and
# tls needs a correct clock, which this pi doesn't have right after boot
API_URL = "http://192.168.1.116:8000/kiln/readings"
TOKEN_PATH = Path("/etc/kiln-logger/token")
BOOT_ID_PATH = Path("/proc/sys/kernel/random/boot_id")
REQUEST_TIMEOUT_S = 10

SAMPLE_INTERVAL_S = 5
SEND_INTERVAL_S = 5
SEND_RETRY_DELAY_S = 10
HEARTBEAT_INTERVAL_S = 300
# matches MAX_KILN_BATCH_SIZE in the backend's schemas.py
MAX_BATCH_SIZE = 500
# a week of readings at 5 s, tens of MB at most. outlasts any outage during a firing
MAX_BUFFERED_READINGS = 120960

SPI_BUS = 0
SPI_DEVICE = 0
SPI_SPEED_HZ = 500000
# the max31856 only talks spi mode 1 or 3
SPI_MODE = 1

REG_CR0 = 0x00
REG_CR1 = 0x01
REG_CJTH = 0x0A
REG_LTCBH = 0x0C
REG_SR = 0x0F
REG_WRITE_BIT = 0x80
# continuous conversion, open-circuit detection on, 60 hz mains filter
CR0_CONFIG = 0x90
# 1 sample per reading, type k thermocouple
CR1_CONFIG = 0x03
CONVERSION_SETTLE_S = 1

COLD_JUNCTION_BITS = 14
COLD_JUNCTION_C_PER_LSB = 0.015625
THERMOCOUPLE_BITS = 19
THERMOCOUPLE_C_PER_LSB = 0.0078125

logger = logging.getLogger("kiln-logger")


def to_signed(value: int, bits: int) -> int:
    """
    converts a raw two's complement register value to a signed int.

    Args:
        value: the unsigned value.
        bits: how many bits wide it is.

    Returns:
        the signed value.
    """
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


class Max31856:
    """the thermocouple amp, reached over spi."""

    def __init__(self) -> None:
        """opens the spi device. the amp itself gets configured on the first read."""
        self.spi = spidev.SpiDev()
        self.spi.open(SPI_BUS, SPI_DEVICE)
        self.spi.max_speed_hz = SPI_SPEED_HZ
        self.spi.mode = SPI_MODE

    def _read(self, register: int, length: int = 1) -> list[int]:
        """reads `length` bytes starting at a register."""
        return self.spi.xfer2([register] + [0] * length)[1:]

    def _configure(self) -> None:
        """writes our settings to the amp and gives it time to finish a conversion."""
        self.spi.xfer2([REG_WRITE_BIT | REG_CR0, CR0_CONFIG])
        self.spi.xfer2([REG_WRITE_BIT | REG_CR1, CR1_CONFIG])
        time.sleep(CONVERSION_SETTLE_S)

    def read(self) -> dict:
        """
        takes one reading, configuring the amp first if it lost its settings.

        a power blip resets the amp without resetting the pi, so the settings get checked
        every time. that check also catches an unplugged or miswired amp.

        Returns:
            thermocouple_c (None when there's a fault, since the value's junk then, e.g.
            1372 c with no probe), cold_junction_c and fault_status (the raw fault register).

        Raises:
            OSError: the amp isn't answering, or spi itself failed.
        """
        if self._read(REG_CR0)[0] != CR0_CONFIG:
            self._configure()
            actual = self._read(REG_CR0)[0]
            if actual != CR0_CONFIG:
                raise OSError(
                    f"max31856 didn't keep its config (wrote 0x{CR0_CONFIG:02x}, read "
                    f"0x{actual:02x}). check the amp's wiring to the pi's spi pins"
                )
        cj_high, cj_low = self._read(REG_CJTH, 2)
        tc_high, tc_mid, tc_low = self._read(REG_LTCBH, 3)
        fault_status = self._read(REG_SR)[0]
        cold_junction = to_signed((cj_high << 8 | cj_low) >> 2, COLD_JUNCTION_BITS)
        thermocouple = to_signed((tc_high << 16 | tc_mid << 8 | tc_low) >> 5, THERMOCOUPLE_BITS)
        return {
            "thermocouple_c": None if fault_status else round(thermocouple * THERMOCOUPLE_C_PER_LSB, 2),
            "cold_junction_c": round(cold_junction * COLD_JUNCTION_C_PER_LSB, 2),
            "fault_status": fault_status,
        }


class ReadingBuffer:
    """thread-safe queue of readings waiting to reach fart-pi, oldest dropped when full."""

    def __init__(self) -> None:
        """starts empty."""
        self.lock = threading.Lock()
        self.readings = collections.deque(maxlen=MAX_BUFFERED_READINGS)

    def add(self, reading: dict) -> None:
        """adds a reading to the end, warning if that pushes out the oldest one."""
        with self.lock:
            if len(self.readings) == MAX_BUFFERED_READINGS:
                logger.warning("buffer full, dropping the oldest reading. is fart-pi reachable?")
            self.readings.append(reading)

    def oldest(self, count: int) -> list[dict]:
        """returns up to `count` of the oldest readings without removing them."""
        with self.lock:
            return [self.readings[i] for i in range(min(count, len(self.readings)))]

    def remove_through(self, seq: int) -> None:
        """removes readings up to and including `seq`, once fart-pi has confirmed them."""
        with self.lock:
            while self.readings and self.readings[0]["seq"] <= seq:
                self.readings.popleft()

    def __len__(self) -> int:
        """how many readings are waiting."""
        with self.lock:
            return len(self.readings)


def post_batch(batch: list[dict], boot_id: str, token: str) -> None:
    """
    sends readings to fart-pi.

    each reading goes with its age rather than a timestamp. this pi has no real-time clock
    and boots with the wrong date, while its monotonic clock is always right for working
    out how old something is. fart-pi turns the age into a timestamp when it arrives.

    Args:
        batch: readings to send, oldest first.
        boot_id: this boot's id. with seq it makes a retry of the same reading harmless.
        token: the shared secret.

    Raises:
        OSError: couldn't reach fart-pi, or it refused the batch (urllib's errors are OSErrors).
    """
    now_s = time.monotonic()
    readings = [
        {
            "seq": r["seq"],
            "age_s": round(now_s - r["monotonic_s"], 3),
            "thermocouple_c": r["thermocouple_c"],
            "cold_junction_c": r["cold_junction_c"],
            "fault_status": r["fault_status"],
        }
        for r in batch
    ]
    request = urllib.request.Request(
        API_URL,
        data=json.dumps({"boot_id": boot_id, "readings": readings}).encode(),
        headers={"Content-Type": "application/json", "X-Kiln-Token": token},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S):
        pass


def send_forever(buffer: ReadingBuffer, boot_id: str, token: str) -> None:
    """
    keeps sending buffered readings, retrying until they get through. runs on its own thread.

    failures only get logged when the state changes, so a long outage can't fill the
    journal, which lives in ram.

    Args:
        buffer: where the sampler leaves readings.
        boot_id: this boot's id.
        token: the shared secret.
    """
    connected = None
    while True:
        batch = buffer.oldest(MAX_BATCH_SIZE)
        if not batch:
            time.sleep(SEND_INTERVAL_S)
            continue
        try:
            post_batch(batch, boot_id, token)
        except OSError as exc:
            if connected is not False:
                logger.warning(
                    f"can't send to {API_URL}: {exc}. keeping readings in memory and retrying "
                    f"every {SEND_RETRY_DELAY_S} s. check that fart-pi is up, and if this says "
                    f"401, that {TOKEN_PATH} matches KILN_TOKEN in the backend's .env"
                )
            connected = False
            time.sleep(SEND_RETRY_DELAY_S)
            continue
        if connected is not True:
            logger.info("reaching fart-pi, sending readings")
        connected = True
        buffer.remove_through(batch[-1]["seq"])
        if len(batch) < MAX_BATCH_SIZE:
            time.sleep(SEND_INTERVAL_S)


def sample_forever(amp: Max31856, buffer: ReadingBuffer) -> None:
    """
    takes a reading every SAMPLE_INTERVAL_S and buffers it. never returns.

    a failed read skips that sample and tries again, so a loose wire doesn't lose whatever's
    still waiting to be sent, which restarting the process would.

    Args:
        amp: the thermocouple amp.
        buffer: where readings go.
    """
    seq = 0
    amp_ok = None
    last_fault = 0
    last_heartbeat_s = time.monotonic()
    next_sample_s = time.monotonic()
    while True:
        try:
            reading = amp.read()
        except OSError as exc:
            if amp_ok is not False:
                logger.error(f"can't read the amp: {exc}. retrying every {SAMPLE_INTERVAL_S} s")
            amp_ok = False
        else:
            if amp_ok is not True:
                logger.info(f"reading the amp: {reading}")
            amp_ok = True
            if reading["fault_status"] != last_fault:
                logger.warning(f"amp fault register is now 0x{reading['fault_status']:02x} (0x01 means no probe)")
                last_fault = reading["fault_status"]
            buffer.add({"seq": seq, "monotonic_s": time.monotonic(), **reading})
            seq += 1
            if time.monotonic() - last_heartbeat_s >= HEARTBEAT_INTERVAL_S:
                logger.info(f"latest {reading}, {len(buffer)} waiting to send")
                last_heartbeat_s = time.monotonic()
        # scheduling from the last target, not from now, so it doesn't drift
        next_sample_s += SAMPLE_INTERVAL_S
        time.sleep(max(0, next_sample_s - time.monotonic()))


def main() -> None:
    """starts the sender thread, then samples forever."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    token = TOKEN_PATH.read_text().strip()
    if not token:
        raise SystemExit(f"{TOKEN_PATH} is empty. it needs KILN_TOKEN from the backend's .env")
    boot_id = BOOT_ID_PATH.read_text().strip()
    buffer = ReadingBuffer()
    threading.Thread(target=send_forever, args=(buffer, boot_id, token), daemon=True).start()
    sample_forever(Max31856(), buffer)


if __name__ == "__main__":
    main()
