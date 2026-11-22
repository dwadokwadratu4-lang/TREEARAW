import React from 'react';
import { Cpu, Download, Layers, Radio, Smartphone, Sparkles, TreePine, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  CHANNEL_ORDER,
  CHANNELS,
  ChannelId,
  TelemetryState,
} from '../types/telemetry';
import { AiPredictionStages } from './AiPredictionStages';

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  telemetry: TelemetryState;
  selectedChannel: ChannelId | null;
  onSelectChannel: (id: ChannelId) => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  open,
  onClose,
  telemetry,
  selectedChannel,
  onSelectChannel,
}) => {
  const { canPrompt, isIOS, isInstalled, promptInstall } = usePWAInstall();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Informacje o projekcie i predykcja AI"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-xl border border-white/15 bg-[#0b110f]/95 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">
              System Monitoringu Świerka · Cyfrowy Bliźniak
            </h2>
            <p className="text-xs text-emerald-300">
              Pomiary i opracowanie: Artur Wierzbicki
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hud-scroll p-5 space-y-4 text-xs text-slate-200 leading-relaxed">
          {/* Przeniesiona sekcja edukacyjna: Predykcja AI (3 kroki) */}
          <section className="rounded-lg border border-amber-400/25 bg-white/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-white text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Predykcja AI (3 kroki)</span>
              </div>
              <span className="text-[11px] font-mono-tabular text-amber-300">
                Prognoza dendrometru (+1.5 h):{' '}
                {telemetry.predictedDendroUm >= 0 ? '+' : ''}
                {telemetry.predictedDendroUm.toFixed(1)} µm
              </span>
            </div>

            <AiPredictionStages
              telemetry={telemetry}
              selectedChannel={selectedChannel}
              onSelectChannel={(cid) => {
                onSelectChannel(cid);
              }}
            />
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-white text-sm">
              <TreePine className="w-4 h-4 text-emerald-400" />
              <span>Cel projektu</span>
            </div>
            <p className="text-slate-300">
              Aplikacja stanowi interaktywny cyfrowy bliźniak stanowiska pomiarowego świerka pospolitego.
              Łączy fizykę stresu wodno-termicznego, dobową dynamikę pracy pnia (dendrometr), model zagrożenia
              inwazją kornika drukarza po 72 godzinach ciągłego stresu oraz 3-etapową predykcję AI wartości dendrometru.
            </p>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-white text-sm">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>Architektura IoT / ESP32S3R8N16 i 9 kanałów pomiarowych</span>
            </div>
            <p className="text-slate-300">
              Centralny kontroler <strong>ESP32S3R8N16 + ZASILANIE + RTC</strong> agreguje sygnały z 9 niezależnych kanałów pomiarowych.
              Każdy kanał zachowuje spójny kolor na czujniku, kablu telemetrycznym, lewitującej tablicy 3D oraz wykresach predykcji AI:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {CHANNEL_ORDER.map((cid) => {
                const meta = CHANNELS[cid];
                return (
                  <div
                    key={cid}
                    className="flex items-start gap-2.5 rounded border border-white/10 bg-black/30 p-2"
                  >
                    <span
                      className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div>
                      <div className="font-semibold text-white">
                        {meta.label} [{meta.unit}]
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {meta.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-3.5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-white text-sm">
                <Radio className="w-4 h-4 text-violet-400" />
                <span>Tryb WebAR ze znacznikiem HIRO</span>
              </div>
              <p className="text-slate-300">
                Przełącz widok na <strong>[AR]</strong> w górnym pasku, aby uruchomić tylną kamerę urządzenia.
                Drzewo pozostaje ukryte do momentu wykrycia czarnego znacznika <strong>HIRO</strong>, po czym stabilnie
                osadza się na stole. Przycisk <strong>„Zablokuj na stole”</strong> zamraża pozycję modelu, a przesuwanie
                palcem w lewo/prawo obraca całą scenę wokół osi pionowej.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <Layers className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  Wokół korony lewituje 10 tablic 3D: 9 kanałów pomiarowych oraz 10. tablica statusowa z odliczaniem do ataku kornika.
                </span>
              </div>
            </div>

            <div className="shrink-0 bg-white p-2 rounded-lg shadow-inner text-center">
              <svg
                viewBox="0 0 100 100"
                className="w-24 h-24 block"
                aria-label="Znacznik HIRO do trybu WebAR"
              >
                <rect x="0" y="0" width="100" height="100" fill="#000000" />
                <rect x="25" y="25" width="50" height="50" fill="#ffffff" />
                <path
                  d="M32 34 H38 V46 H46 V34 H52 V66 H46 V52 H38 V66 H32 Z"
                  fill="#000000"
                />
                <rect x="57" y="34" width="6" height="32" fill="#000000" />
                <rect x="32" y="70" width="36" height="4" fill="#000000" />
              </svg>
              <div className="text-[10px] font-bold text-slate-900 mt-1 tracking-wider">
                HIRO
              </div>
            </div>
          </section>

          {!isInstalled && (
            <section className="rounded-lg border border-emerald-500/30 bg-emerald-950/25 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-white">
                    Aplikacja pełnoekranowa PWA (Świerk AR)
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {isIOS
                      ? 'Na iPhonie/iPadzie kliknij ikonę „Udostępnij” w Safari i wybierz „Do ekranu początkowego”, aby uruchamiać bez paska przeglądarki.'
                      : 'Dodaj aplikację do ekranu głównego smartfona, aby korzystać z trybu 3D i WebAR na pełnym ekranie.'}
                  </p>
                </div>
              </div>
              {canPrompt && (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Zainstaluj PWA</span>
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
