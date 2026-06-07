# ADR-001: LiveKit vs Custom WebRTC for Spatial Audio

**Status**: Accepted  
**Date**: 2026-06-05  
**Deciders**: Rasmus (2care4)

## Context

VirtualOffice needs real-time audio communication between users moving around a 2D office floor. The core requirement is **spatial audio**: users should hear each other based on proximity, with volume falloff, stereo panning, and zone-based mixing (meeting rooms, focus rooms, social zones).

Two approaches were evaluated:

1. **Custom WebRTC** — Build a homegrown SFU (Selective Forwarding Unit) or mesh network using raw WebRTC APIs (`RTCPeerConnection`, `MediaStream`, custom signaling server)
2. **LiveKit Cloud** — Use the managed LiveKit SFU with its client SDK, building spatialization on top via Web Audio API

## Decision

**We chose LiveKit Cloud** for audio transport, while implementing the spatial audio processing ourselves using the Web Audio API (`AudioContext`, `GainNode`, `StereoPannerNode`).

LiveKit handles:
- Room management (join/leave)
- Audio track publishing and subscription
- WebRTC negotiation (ICE, STUN/TURN)
- Reliable data channel for position sync

We handle:
- Proximity-based volume attenuation (inverse-square falloff)
- Stereo panning (equal-power pan law)
- Zone-gated mixing (same-room = full volume, focus rooms = silence, social = boosted)
- Conversation proximity bonus
- Maximum simultaneous voice capping (20 voices)

## Alternatives Considered

### Custom WebRTC SFU

**Pros:**
- Full control over the audio pipeline
- No vendor dependency
- No monthly costs beyond server hosting
- Could embed spatial audio processing into the media server itself

**Cons:**
- Requires building and maintaining a signaling server (WebSocket-based)
- Must implement STUN/TURN infrastructure for NAT traversal
- ICE negotiation is notoriously complex and fragile
- Need to handle reconnections, bandwidth estimation, adaptive bitrate
- Custom SFU development is a multi-month project in itself
- Operational burden: monitoring, scaling, debugging WebRTC issues
- For 15 users (2care4 pilot), this is massive overengineering

**Why rejected**: Building a custom WebRTC SFU for a 15-user pilot is disproportionate. The complexity of ICE, NAT traversal, and signaling alone would delay the MVP by months. LiveKit solves all of this out of the box.

### LiveKit's Built-in Spatial Audio

LiveKit does not provide a built-in 2D spatial audio API at the time of development. Their spatial audio features are focused on 3D game engines. Our 2D office use case with zone-based mixing (different rules for meeting rooms vs focus rooms vs open plan) required custom logic.

**Why rejected**: Not available for our use case. We use LiveKit for transport and build spatialization ourselves, which is what their documentation recommends for custom spatial scenarios.

## Consequences

**Positive:**
- MVP was built in days, not months — LiveKit handles all the hard WebRTC problems
- Free tier supports 50 concurrent sessions, sufficient for the 15-user pilot
- Automatic scaling — no ops burden for audio infrastructure
- Data channel gives us a reliable position sync mechanism (20Hz broadcast)
- Room isolation built-in — different offices are separate LiveKit rooms

**Negative:**
- Vendor dependency on LiveKit Cloud (though the client SDK is open source, and the server SDK exists for self-hosting)
- Monthly costs if the pilot scales beyond free tier
- Spatial audio is computed client-side, meaning every peer's audio is received and then attenuated — we can't save bandwidth by culling at the server level (though we do cap at 20 simultaneous voices)
- LiveKit client SDK is large (~400KB) — we mitigate with dynamic imports (`next/dynamic`)

## Technical Details

The spatial audio pipeline works as follows:

1. LiveKit delivers each remote peer's audio track as a `MediaStreamTrack`
2. For each track, we create a Web Audio graph: `source → GainNode → StereoPannerNode → destination`
3. A `requestAnimationFrame` loop runs the spatial mix:
   - `computeSpatialMix()` calculates gain and pan for each peer based on distance and zone
   - `applySpatialMix()` applies smooth transitions (exponential smoothing, τ ≈ 80ms)
4. Position data flows via LiveKit's data channel (unreliable mode, 20Hz)
5. Peer positions are interpolated (lerp, factor 0.15) for smooth movement

See `src/lib/spatial-audio-engine.ts` for the full implementation.

## References

- [LiveKit Cloud Documentation](https://docs.livekit.io/cloud/)
- [Web Audio API Specification](https://webaudio.github.io/web-audio-api/)
- `src/lib/spatial-audio-engine.ts` — Spatial audio engine implementation
- `src/lib/office-layout.ts` — Room definitions and spatial audio constants