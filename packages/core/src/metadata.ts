/**
 * Display-name formatting for score metadata (makam / form / usul / composer / title).
 *
 * SymbTr stores these as lowercase ASCII slugs ("ussak", "sarki", "tatyos efendi"); engraved
 * sheets print proper Turkish ("Uşşak", "Şarkı", "Tatyos Efendi"). These maps recover the common
 * cases; anything unknown falls back to a Turkish-aware title-case of the slug. Pure formatting —
 * no musical behavior here (the makam→pitch table is a separate, later concern).
 */

import type { NoteModelDocument } from "./types";
import { findUsul } from "./usul";

/** Title-case a slug ("gamzedeyim deva" / "tatyos_efendi" → "Gamzedeyim Deva" / "Tatyos Efendi"). */
export function titleCase(s: string): string {
  return (s || "")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}

// Common makam display names (extend as needed; unknown slugs fall back to title-case).
const MAKAM_NAMES: Record<string, string> = {
  acem: "Acem",
  acemasiran: "Acemaşîran",
  acemkurdi: "Acemkürdî",
  bayati: "Bayâti",
  beyati: "Beyâti",
  buselik: "Bûselik",
  hicaz: "Hicaz",
  hicazkar: "Hicazkâr",
  huseyni: "Hüseynî",
  huzzam: "Hüzzam",
  karcigar: "Karcığar",
  kurdi: "Kürdî",
  kurdilihicazkar: "Kürdîlihicazkâr",
  mahur: "Mâhur",
  muhayyer: "Muhayyer",
  neva: "Nevâ",
  nihavend: "Nihâvend",
  nikriz: "Nikrîz",
  rast: "Rast",
  saba: "Sabâ",
  segah: "Segâh",
  suzinak: "Sûznâk",
  sehnaz: "Şehnâz",
  tahir: "Tâhir",
  ussak: "Uşşak",
  zavil: "Zâvil",
};

// Common form display names.
const FORM_NAMES: Record<string, string> = {
  agirsemai: "Ağır Semâi",
  beste: "Beste",
  durak: "Durak",
  gazel: "Gazel",
  ilahi: "İlâhi",
  kosma: "Koşma",
  mars: "Marş",
  nakis: "Nakış",
  pesrev: "Peşrev",
  sarki: "Şarkı",
  sazsemai: "Saz Semâisi",
  sazsemaisi: "Saz Semâisi",
  turku: "Türkü",
  yuruksemai: "Yürük Semâi",
};

export function makamDisplay(slug: string): string {
  return MAKAM_NAMES[(slug || "").toLowerCase()] ?? titleCase(slug);
}

export function formDisplay(slug: string): string {
  return FORM_NAMES[(slug || "").toLowerCase()] ?? titleCase(slug);
}

export interface ScoreHeader {
  /** "Uşşak Şarkı" — makam + form, the centered heading. */
  makamForm: string;
  /** The piece title, title-cased. */
  title: string;
  /** Usul display name (e.g. "Sofyan"), from the usul table. */
  usul: string;
  /** Composer, title-cased (empty if unknown). */
  composer: string;
}

/** Assemble the printed header strings for a score from its metadata. */
export function scoreHeader(doc: NoteModelDocument): ScoreHeader {
  return {
    makamForm: `${makamDisplay(doc.makam)} ${formDisplay(doc.form)}`.trim(),
    title: titleCase(doc.title),
    usul: findUsul(doc.usul)?.label ?? titleCase(doc.usul),
    composer: doc.composer ? titleCase(doc.composer) : "",
  };
}
