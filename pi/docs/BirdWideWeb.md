# Bird Wide Web

A secure network of self hosted servers, connected via NetBird

## Main nodes withing Bird Wide Web

Tyler - 'House of Good things' ip, runs on 'fart-pi' (raspberry pi 5). Main programs include: Website Backend API providing forum (Public Square) and photo galleries for his personal website (https://tyler-schwenk.com/). API accessible at https://api.tyler-schwenk.com. Also running Beszel and NetBird.

John - 'JohnHOME' ip, runs JohnNAS and JohnSERV (please fill in these details, john). main programs include: hosting the NetBird Overlay Network, minecraft server, Jellyfin movie streamer.

Kyle - 'Beer Home', runs on Orin AGX, hosts ML based services including 'Mattbot'.

---

# Topology

```mermaid
flowchart TB

subgraph "House of good things"
    FartPi[FartPi]
    NetBird --> FartPi
end

subgraph "Beer home"
    Bebop[Bebop]
    NetBird --> Bebop
end

subgraph "JohnHOME"
    JohnNAS[JohnNAS]
    JohnSERV[JohnSERV]
    NetBird["NetBird Overlay Network - lives in JohnHOME"]
    NetBird -. hosted on .-> JohnSERV
    NetBird --> JohnNAS
    NetBird --> JohnSERV
end
```

---

# NetBird Access

All host-to-host connectivity in this lab is expected to run over NetBird.

1. Install NetBird on your client and sign in to the same NetBird network.
2. Verify your peer is connected in the NetBird dashboard.
3. Connect to services using each node's NetBird IP or DNS name.

Example:

```bash
ssh user@<netbird-hostname-or-ip>
```

---

# Sites

## JohnSERV

| Site | Server | URL |
| --- | --- | --- |
| Jellyfin | JohnSERV | http://100.124.56.240:8096/ |

## Beer Home

| Site | Server | URL |
| --- | --- | --- |
| MattBot (TTS API) | Bebop | http://\<bebop-netbird-ip\>:8000 |

See [docs/services/mattbot.md](services/mattbot.md) for setup and usage.

---

# Services

```mermaid
flowchart LR

WebsiteBackend[Website Backend] --> FartPi
Beszel --> FartPi
Mattbot --> Bebop
LLM --> Bebop
SpeechToText[Speech to Text] --> Bebop

TrueNAS --> JohnNAS

Jellyfin --> JohnSERV
Minecraft[Minecraft Server] --> JohnSERV
```

---

# Full View

```mermaid
flowchart TB

subgraph "House of good things"
    FartPi[FartPi]
    WebsiteBackend[Website Backend]
    Beszel
    WebsiteBackend --> FartPi
    Beszel --> FartPi
    NetBird --> FartPi
end

subgraph "Beer home"
    Bebop[Bebop]
    Mattbot
    LLM
    STT[Speech to Text]

    Mattbot --> Bebop
    LLM --> Bebop
    STT --> Bebop
    NetBird --> Bebop
end

subgraph "JohnHOME"
    JohnNAS[JohnNAS]
    TrueNAS
    JohnSERV[JohnSERV]
    NetBird[NetBird Overlay Network]
    Jellyfin
    Minecraft

    TrueNAS --> JohnNAS
    Jellyfin --> JohnSERV
    Minecraft --> JohnSERV
    NetBird -. hosted on .-> JohnSERV
    NetBird --> JohnNAS
    NetBird --> JohnSERV
end
```