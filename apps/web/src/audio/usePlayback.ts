/**
 * Playback: play/pause, seeking, playing one bar, the voice and instrument choice, percussion, and
 * the options every play is built from. `onStop` stays in App because the hooks called before this
 * one need it. ⚠ Every play is built from `perf`/`timeline` (the UNFOLDED performance), never from
 * the written `doc` (CLAUDE.md, group 4). Moved out of App.tsx on 2026-11-20; statements unchanged.
 */
import { useCallback, useEffect, useMemo, type SetStateAction, type MutableRefObject } from "react";
import type { KitId } from "./strokeKits";
import { type VoiceId, findVoice } from "./instruments";
import type { PlayOptions, VoiceStatus } from "./webAudioBackend";
import {
  findUsul,
  buildMetronomeTrack,
  buildPercussionTrack,
  groupMeasures,
  type Measure,
  type Timeline,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { backend } from "./backend";
import { voiceCached } from "./loadInstrument";
import { type InstrumentId, voiceForInstrument } from "../instruments/InstrumentView";

export function usePlayback({
  beatMs,
  bpm,
  doc,
  lastEditMeasure,
  metronome,
  naturalBpm,
  percussion,
  percussionKit,
  percussionVolume,
  perf,
  playState,
  setBpm,
  setInstrument,
  setMetronome,
  setPercussion,
  setPercussionKit,
  setPercussionVolume,
  setPlayState,
  setUsulName,
  setVoice,
  setVoiceAsk,
  setVoiceStatus,
  timeline,
  usulName,
  voice,
  voicesApproved,
  writeOut,
}: {
  beatMs: number;
  bpm: number;
  doc: NoteModelDocument | null;
  lastEditMeasure: number | null;
  metronome: boolean;
  naturalBpm: number;
  percussion: boolean;
  percussionKit: "darbuka" | "bendir";
  percussionVolume: number;
  perf: { timeline: Timeline; doc: NoteModelDocument; playPlan: { evIndex: number; startMs: number; endMs: number; }[] | undefined; steps: { evIndex: number; startMs: number; endMs: number; }[]; firstStartMs: Map<number, number>; } | null;
  playState: "stopped" | "playing" | "paused";
  setBpm: (value: SetStateAction<number>) => void;
  setInstrument: (value: SetStateAction<"violin" | "kanun" | "clarinet">) => void;
  setMetronome: (value: SetStateAction<boolean>) => void;
  setPercussion: (value: SetStateAction<boolean>) => void;
  setPercussionKit: (value: SetStateAction<KitId>) => void;
  setPercussionVolume: (value: SetStateAction<number>) => void;
  setPlayState: (value: SetStateAction<"stopped" | "playing" | "paused">) => void;
  setUsulName: (value: SetStateAction<string>) => void;
  setVoice: (value: SetStateAction<VoiceId>) => void;
  setVoiceAsk: (value: SetStateAction<{ voice: VoiceId; go: () => void; no?: () => void; } | null>) => void;
  setVoiceStatus: (value: SetStateAction<VoiceStatus>) => void;
  timeline: Timeline | null;
  usulName: string;
  voice: "violin" | "kanun" | "clarinet" | "sine";
  voicesApproved: MutableRefObject<Set<VoiceId>>;
  writeOut: boolean;
}) {

  // Translate the current tempo/metronome/percussion/usul UI state into backend PlayOptions. Speed
  // is the chosen BPM over the natural BPM; the clicks are the selected usul's beat pattern and the
  // strokes are its düm/tek/ke pattern (both built in core, in musical ms, off the same whole-note
  // length), so they stay aligned to the bars at any tempo.
  //
  // ⛔ **BOTH TRACKS ARE BUILT OVER `perf.doc` — THE PERFORMANCE — AND NEVER OVER THE WRITTEN
  // SCORE** (fixed 2026-09-05, after the owner heard the usul stop: *"usul vuruşu bazen kesiliyor
  // ve geri gelmiyor"*). The same class of bug as the makam deltas above, and it arrived the same
  // way: `unfoldDoc` landed on 2026-08-30 and moved the timeline onto the performance, while these
  // two builders were left reading `doc`. A repeat makes the performance LONGER than the written
  // page, and both builders walk bars — so the strokes ran out at the written total and the rest of
  // the piece played with no usul at all. Nothing threw; the tail is simply silent, which is why
  // only an ear caught it. On a 4-bar page with `‖: 1–2 :‖` that is the last 38% of the playback.
  // ⚠ It is also an ALIGNMENT fix, not only a length one: after the first jump the written bars and
  // the sounding bars are different bars, so the strokes were landing off the barline wherever the
  // repeated block's bar lengths were not uniform. ⚠ Unfolded pages are untouched — `unfoldDoc`
  // over the identity order returns the same bars with the same start times (`groupMeasures` skips
  // `meta` on both sides), so this changes nothing for a page that plays as it is written.
  // `tools/tests/usul-test.ts` pins it.
  const buildPlayOptions = useCallback(
    (
      targetBpm: number,
      metro: boolean,
      uName: string,
      perc: boolean,
      kit: KitId = percussionKit,
      v: VoiceId = voice,
    ): PlayOptions => {
      const u = findUsul(uName);
      const played = perf?.doc ?? null;
      const clicks = metro && played && u ? buildMetronomeTrack(played, u, beatMs * 4) : undefined;
      const strokes = perc && played && u ? buildPercussionTrack(played, u, beatMs * 4) : undefined;
      return {
        speed: naturalBpm > 0 ? targetBpm / naturalBpm : 1,
        clicks,
        percussion: strokes,
        percussionVolume,
        percussionKit: kit,
        voice: v,
      };
    },
    [perf, naturalBpm, beatMs, percussionVolume, percussionKit, voice],
  );

  // The picker's handler. `ensureVoice` FIRST and outside `applyPlayback`, so choosing an instrument
  // starts its download immediately — including while stopped, which is when someone browsing the
  // list is most likely to be. `applyPlayback` then re-schedules if something is already playing.
  function applyVoice(v: VoiceId) {
    requestVoice(v, () => {
      void backend.ensureVoice(v);
      applyPlayback(bpm, metronome, usulName, percussion, percussionKit, v);
    });
  }

  /**
   * ⭐ THE ONE PLACE THAT DECIDES WHETHER A VOICE CHANGE MAY DOWNLOAD (owner, 2026-09-27: *"sesi
   * indirmeden önce bir modalla kullanıcıya emin olup olmadığını sorsun"*). Every path that can
   * start a download goes through here: the transport's picker, the instrument page's picker, and
   * opening that page. The synthesised tone downloads nothing and is never asked about; a voice the
   * reader already said yes to in this visit is not asked about twice; and (2026-10-12) neither is
   * one whose every file is already on the device from an earlier visit (`voiceCached`), because
   * loading it spends no data.
   *
   * ⚠ A "no" changes NOTHING about the sound — the controlled pickers fall back to `voice` on their
   * own, because `voice` never moved.
   */
  function requestVoice(v: VoiceId, go: () => void, no?: () => void) {
    const def = findVoice(v);
    if (!def || !def.samples.length || voicesApproved.current.has(v)) {
      go();
      return;
    }
    void voiceCached(v).then((cached) => {
      if (cached) {
        voicesApproved.current.add(v);
        go();
      } else {
        setVoiceAsk({ voice: v, go, no });
      }
    });
  }

  /**
   * The instrument page's picker: it changes the PICTURE and the SOUND together (owner,
   * 2026-08-29: *"ses de ona göre otomatik ayarlanacak"*).
   */
  function applyInstrument(id: InstrumentId) {
    setInstrument(id);
    applyVoice(voiceForInstrument(id));
  }

  // The slider's handler. Straight to the backend, deliberately not through `applyPlayback`.
  function applyPercussionVolume(v: number) {
    setPercussionVolume(v);
    backend.setPercussionVolume(v);
  }

  // Stable accessor for the live playback position (ms), read each frame by the sheet's
  // playhead. Stable identity (the backend is a module constant) keeps the rAF effect steady.
  const getPositionMs = useCallback(() => backend.getPositionMs(), []);

  // When the piece finishes on its own, reset the transport to "stopped" so the UI shows Play.
  useEffect(() => {
    backend.setOnEnded(() => setPlayState("stopped"));
    return () => backend.setOnEnded(null);
  }, []);

  // Mirror the voice's load state into React, so the picker can show "3/11" and say when a download
  // failed. Push rather than poll: the backend already knows when each sample lands.
  useEffect(() => {
    backend.setOnVoiceStatus(setVoiceStatus);
    return () => backend.setOnVoiceStatus(null);
  }, []);

  // The single Play/Pause/Resume control. From stopped it starts from the top; while playing
  // it pauses (keeping position); while paused it resumes. Audio end is handled by setOnEnded.
  function onPlayPause() {
    if (!timeline) return;
    if (playState === "playing") {
      backend.pause();
      setPlayState("paused");
    } else if (playState === "paused") {
      backend.resume();
      setPlayState("playing");
    } else {
      void backend.play(timeline, 0, buildPlayOptions(bpm, metronome, usulName, percussion));
      setPlayState("playing");
    }
  }

  /**
   * Where in the PERFORMANCE a drawn bar starts, in ms.
   *
   * On a folded score a bar inside a repeat sounds twice, so `Measure.startMs` — a running sum
   * over the written score — is not a playing time at all. `firstStartMs` gives the first time the
   * bar sounds, which is what clicking it means. Written out long, the drawn bars ARE the
   * performance, so their own start times are already right.
   */
  function playStartMs(m: { index: number; startMs: number } | null): number {
    if (!m) return 0;
    if (writeOut) return m.startMs;
    return perf?.firstStartMs.get(m.index) ?? m.startMs;
  }

  // Seek: start playback from a given position (ms). Used by clicking a measure (non-edit
  // mode) to "play from here". The click is the user gesture the AudioContext needs.
  function onSeekMs(ms: number) {
    if (!timeline) return;
    void backend.play(timeline, ms, buildPlayOptions(bpm, metronome, usulName, percussion));
    setPlayState("playing");
  }

  // Where the palette's Çal starts: the top of the last edited bar, or the top of the piece before
  // any edit. `Measure.startMs` is musical ms (a running sum of durationMs) — the same thing the
  // sheet's click-to-seek hands to onSeekMs, so tempo/metronome/makam all follow from there.
  // ⚠ The `?? 0` is a real case, not defensiveness: deleting a bar's last note removes that
  // measure, so a remembered index can outrun the score. Falling back to the top is the safe read.
  const editStartMs = useMemo(() => {
    if (!doc || lastEditMeasure == null) return 0;
    return playStartMs(groupMeasures(doc).find((m) => m.index === lastEditMeasure) ?? null);
  }, [doc, lastEditMeasure, perf, writeOut]);

  // The palette's Çal. Always (re)starts from the last edited bar — pause and resume stay in the
  // transport above, which is still on screen in edit mode (owner, 2026-08-08). Pressing it again
  // mid-playback replays the same bar, which is what checking a fix by ear actually looks like.
  function onPlayFromEdit() {
    onSeekMs(editStartMs);
  }

  /**
   * The instrument page's **Ölçüyü çal**: play ONE bar and stop at its barline (owner, 2026-09-04).
   *
   * ⭐ **It is done by CUTTING THE TIMELINE, not by watching the clock and calling stop.** The bar's
   * notes go to the backend with their PIECE times untouched and `totalMs` set to the barline, and
   * three things follow from that:
   *   * nothing past the bar is ever scheduled. A poll would always overshoot by a frame, and one
   *     frame of the next bar is an audible blip, not a rounding error.
   *   * the natural end fires by itself (`tick` → `setOnEnded` → `stopped`), including the wait for
   *     a plucked voice still ringing, so there is no second stop path to keep in step with it.
   *   * `getPositionMs()` still reports PIECE ms — which is what the instrument drawings, the
   *     measure card's cursor and the sheet's playhead all read. Playing a slice from zero would
   *     have moved every one of them to the top of the score while the seventh bar sounded.
   * ⚠ The clicks and the usul strokes are passed whole; they stop with the playback, at the same
   * `totalMs`, so nothing has to filter them either.
   */
  function onPlayMeasure(m: Measure) {
    if (!timeline) return;
    const startMs = playStartMs(m);
    const durMs = m.events.reduce((sum, ev) => sum + ev.durationMs, 0);
    if (!(durMs > 0)) return;
    const endMs = startMs + durMs;
    const EPS = 1e-6;
    const bar: Timeline = {
      notes: timeline.notes.filter((n) => n.startMs >= startMs - EPS && n.startMs < endMs - EPS),
      totalMs: endMs,
    };
    void backend.play(bar, startMs, buildPlayOptions(bpm, metronome, usulName, percussion));
    setPlayState("playing");
  }

  // Apply a tempo / metronome / percussion / usul change. If something is playing or paused,
  // re-schedule from the current position so the change is heard immediately (position is musical
  // ms, so it's tempo-independent); otherwise it just takes effect on the next Play.
  // ⚠ Every argument needs its setter here, not just the one the caller changed: the controls are
  // React-controlled, so a missing setter leaves the box un-ticked and the change silently reverts.
  function applyPlayback(
    nextBpm: number,
    nextMetro: boolean,
    nextUsul: string,
    nextPerc: boolean,
    nextKit: KitId = percussionKit,
    nextVoice: VoiceId = voice,
  ) {
    setBpm(nextBpm);
    setMetronome(nextMetro);
    setUsulName(nextUsul);
    setPercussion(nextPerc);
    setPercussionKit(nextKit);
    setVoice(nextVoice);
    if (!timeline || playState === "stopped") return;
    const pos = Math.max(0, backend.getPositionMs() ?? 0);
    const wasPaused = playState === "paused";
    void backend
      .play(timeline, pos, buildPlayOptions(nextBpm, nextMetro, nextUsul, nextPerc, nextKit, nextVoice))
      .then(() => {
        if (wasPaused) backend.pause(); // keep the paused state after re-scheduling
      });
  }

  return { applyInstrument, applyPercussionVolume, applyPlayback, applyVoice, getPositionMs, onPlayFromEdit, onPlayMeasure, onPlayPause, onSeekMs, playStartMs, requestVoice };
}
