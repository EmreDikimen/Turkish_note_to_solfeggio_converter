/**
 * The page drawn as a staff — the web app's own engraver in a WebView (M2, option (a); owner
 * 2026-10-29). The page is `SCORE_VIEW_HTML`, built from `apps/web/src/scoreView/` by
 * `npm run -w @turkish-omr/web build:score-view`: one self-contained file, so drawing needs no
 * network. The bridge is the one `ScoreView.tsx` documents: it says `ready`, we hand it the page
 * through `__komaLoad`, and it reports a tapped bar as `{ type: "measure", index }`.
 */
import { useRef, type ComponentType, type Ref } from 'react';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import type { NoteModelDocument } from '@turkish-omr/core';
import type { ScoreStructure } from '../../../tools/render/stitch';
import { SCORE_VIEW_HTML } from './generated/scoreViewHtml';

// ⚠ A TYPES-ONLY cast (2026-10-29): react-native-webview 14.0.1's class typings resolve their props
// to `never` against React 19.3's types, so every prop "fails" to typecheck. Nothing changes at run
// time. Drop the cast when the package's types catch up.
const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

export function ScoreWebView({
  doc,
  structure,
  background,
  onMeasure,
}: {
  doc: NoteModelDocument;
  structure?: ScoreStructure;
  background: string;
  onMeasure?: (index: number) => void;
}) {
  const ref = useRef<WebView>(null);

  function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string; index?: number };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      // `true;` at the end: injectJavaScript wants the script to evaluate to something.
      ref.current?.injectJavaScript(`window.__komaLoad(${JSON.stringify({ doc, structure })}); true;`);
    } else if (msg.type === 'measure' && typeof msg.index === 'number') {
      onMeasure?.(msg.index);
    }
  }

  return (
    <Web
      ref={ref}
      // ⚠ Keyed by the document, so a new page mounts a fresh view and its `ready` loads it.
      key={doc.name + doc.events.length}
      originWhitelist={['*']}
      source={{ html: SCORE_VIEW_HTML }}
      onMessage={onMessage}
      style={{ flex: 1, backgroundColor: background }}
      setSupportMultipleWindows={false}
    />
  );
}
