import React from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Flame,
  Skull,
  X,
} from 'lucide-react';
import {
  CHANNELS,
  ChannelId,
  SoilControls,
  TelemetryState,
} from '../types/telemetry';

interface TelemetryHudProps {
  open: boolean;
  onClose: () => void;
  telemetry: TelemetryState;
  soil: SoilControls;
  selectedChannel: ChannelId | null;
  onSelectChannel: (id: ChannelId) => void;
  onChangeSoil: (patch: Partial<SoilControls>) => void;
  onToggleDrought: () => void;
  onApplyHealthyReset: () => void;
}

export const TelemetryHud: React.FC<TelemetryHudProps> = ({
  open,
  onClose,
  telemetry,
  soil,
  selectedChannel,
  onSelectChannel,
  onChangeSoil,
  onToggleDrought,
  onApplyHealthyReset,
}) => {
  if (!open) return null;

  const stressPct = Math.min(100, (telemetry.stressHours / 72) * 100);

  const statusMeta =
    telemetry.treeState === 'DOBRY'
      ? {
          label: 'DOBRY',
          badgeBg: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300',
          barColor: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
        }
      : telemetry.treeState === 'ZŁY'
        ? {
            label: 'ZŁY',
            badgeBg: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
            barColor: 'bg-amber-500',
            icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          }
        : {
            label: 'FATALNY · ŚMIERĆ DRZEWA',
            badgeBg: 'bg-rose-600/20 border-rose-500/50 text-rose-300',
            barColor: 'bg-rose-500',
            icon: <Skull className="w-5 h-5 text-rose-400 shrink-0" />,
          };

  return (
    <aside
      aria-label="Panel Telemetria i sterowanie"
      className="fixed z-20 right-3 top-14 bottom-20 w-[410px] max-w-[calc(100vw-24px)] rounded-xl border border-white/12 bg-[#0b110f]/92 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Nagłówek panelu */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Telemetria i sterowanie stanem drzewa
          </h2>
          <p className="text-[11px] text-slate-400">
            ESP32S3R8N16 · 9 kanałów · Suwaki gleby i susza
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Zwiń panel Telemetria"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pasek statusu + TRYB: SUSZA */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-white/10 space-y-2.5 shrink-0">
        <div className={`rounded-lg border p-2.5 ${statusMeta.badgeBg}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {statusMeta.icon}
              <div className="min-w-0">
                <div className="text-[10px] text-slate-300/85">
                  Stan zdrowia świerka
                </div>
                <div className="text-sm font-bold tracking-tight truncate">
                  {statusMeta.label}
                </div>
              </div>
            </div>
            <div className="font-mono-tabular text-lg font-bold shrink-0">
              {telemetry.health.toFixed(0)}%
            </div>
          </div>

          <div className="w-full h-1.5 bg-black/35 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-200 ${statusMeta.barColor}`}
              style={{ width: `${telemetry.health}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] mt-1.5">
            <span className="text-slate-300">Ciągły stres (kornik ≥ 72 h):</span>
            <span className="font-mono-tabular font-semibold text-slate-100">
              {telemetry.stressHours.toFixed(1)} / 72.0 h
            </span>
          </div>
          <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-200 ${
                telemetry.beetleInfestation
                  ? 'bg-rose-500'
                  : stressPct > 65
                    ? 'bg-amber-400'
                    : 'bg-sky-400'
              }`}
              style={{ width: `${stressPct}%` }}
            />
          </div>

          {telemetry.beetleInfestation && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-200 font-medium">
              <Bug className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Inwazja kornika drukarza na pniu!</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleDrought}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              telemetry.droughtMode
                ? 'bg-gradient-to-r from-red-600 to-orange-500 border-orange-300 text-white shadow-lg shadow-orange-950/50'
                : 'bg-gradient-to-r from-red-600/20 to-orange-500/20 border-orange-500/50 text-orange-200 hover:from-red-600/35 hover:to-orange-500/35'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>
              TRYB: SUSZA {telemetry.droughtMode ? '(WŁĄCZONY)' : '(WYŁĄCZONY)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onApplyHealthyReset}
            className="px-2.5 py-2 rounded-lg border border-emerald-400/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            title="Przywróć optymalne warunki glebowe"
          >
            Optimum
          </button>
        </div>
      </div>

      {/* Przewijana zawartość: Suwaki gleby + wszystkie 9 kanałów */}
      <div className="flex-1 overflow-y-auto hud-scroll p-3.5 space-y-3.5">
        <section className="rounded-lg border border-white/10 bg-[#070c0a]/85 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200">
              Suwaki warunków glebowych (10 cm / 60 cm)
            </h3>
            <span className="text-[10px] text-slate-400">
              Reakcja natychmiastowa
            </span>
          </div>

          <SoilSlidersBlock
            soil={soil}
            onChangeSoil={onChangeSoil}
            onSelectChannel={onSelectChannel}
          />
        </section>

        <section className="rounded-lg border border-white/10 bg-[#070c0a]/85 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-slate-200">
            9 kanałów pomiarowych (kliknij, aby podświetlić w 3D)
          </h3>

          <ChannelRow
            id="dendrometr"
            value={`${telemetry.dendroValueUm >= 0 ? '+' : ''}${telemetry.dendroValueUm.toFixed(1)} µm`}
            sub={`Amplituda: ±${telemetry.dendroAmplitudeUm.toFixed(1)} µm · Prognoza AI: ${telemetry.predictedDendroUm >= 0 ? '+' : ''}${telemetry.predictedDendroUm.toFixed(1)} µm`}
            active={selectedChannel === 'dendrometr'}
            onClick={() => onSelectChannel('dendrometr')}
          />
          <ChannelRow
            id="wilgotnosc10"
            value={`${soil.soilMoisture10.toFixed(0)} %`}
            sub="Czujnik wilgotności gleby nr 1 (10 cm)"
            active={selectedChannel === 'wilgotnosc10'}
            onClick={() => onSelectChannel('wilgotnosc10')}
          />
          <ChannelRow
            id="wilgotnosc60"
            value={`${soil.soilMoisture60.toFixed(0)} %`}
            sub="Czujnik wilgotności gleby nr 2 (60 cm)"
            active={selectedChannel === 'wilgotnosc60'}
            onClick={() => onSelectChannel('wilgotnosc60')}
          />
          <ChannelRow
            id="tempGleby"
            value={`${soil.soilTemp10.toFixed(1)} °C / ${soil.soilTemp60.toFixed(1)} °C`}
            sub="Czujnik nr 3 (10 cm) / nr 4 (60 cm)"
            active={selectedChannel === 'tempGleby'}
            onClick={() => onSelectChannel('tempGleby')}
          />
          <ChannelRow
            id="tempKory"
            value={`${telemetry.barkTemp1Sunny.toFixed(1)} °C / ${telemetry.barkTemp2Shaded.toFixed(1)} °C`}
            sub={`Kora nr 1 (słońce) / nr 2 (cień) · ΔT +${(telemetry.barkTemp1Sunny - telemetry.barkTemp2Shaded).toFixed(1)} °C`}
            active={selectedChannel === 'tempKory'}
            onClick={() => onSelectChannel('tempKory')}
          />
          <ChannelRow
            id="tempPowietrza"
            value={`${telemetry.airTemp5m.toFixed(1)} °C`}
            sub="Skrzynka meteo 5 m od świerka"
            active={selectedChannel === 'tempPowietrza'}
            onClick={() => onSelectChannel('tempPowietrza')}
          />
          <ChannelRow
            id="wilgotnoscPowietrza"
            value={`${telemetry.airHumidity5m.toFixed(0)} %`}
            sub="Wilgotność względna · Skrzynka 5 m"
            active={selectedChannel === 'wilgotnoscPowietrza'}
            onClick={() => onSelectChannel('wilgotnoscPowietrza')}
          />
          <ChannelRow
            id="cisnienie"
            value={`${telemetry.pressure5m.toFixed(0)} hPa`}
            sub="Ciśnienie atmosferyczne · Skrzynka 5 m"
            active={selectedChannel === 'cisnienie'}
            onClick={() => onSelectChannel('cisnienie')}
          />
          <ChannelRow
            id="imgw"
            value={`${telemetry.imgwTemp.toFixed(1)} °C · ${telemetry.imgwHumidity.toFixed(0)}%`}
            sub="Regionalna stacja terenowa IMGW"
            active={selectedChannel === 'imgw'}
            onClick={() => onSelectChannel('imgw')}
          />
        </section>
      </div>
    </aside>
  );
};

const SoilSlidersBlock: React.FC<{
  soil: SoilControls;
  onChangeSoil: (patch: Partial<SoilControls>) => void;
  onSelectChannel: (id: ChannelId) => void;
}> = ({ soil, onChangeSoil, onSelectChannel }) => (
  <div className="space-y-2.5">
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <button
          type="button"
          onClick={() => onSelectChannel('tempGleby')}
          className="text-amber-400 hover:underline cursor-pointer"
        >
          Temperatura gleby nr 3 (10 cm)
        </button>
        <span className="font-mono-tabular font-semibold text-white">
          {soil.soilTemp10.toFixed(1)} °C
        </span>
      </div>
      <input
        type="range"
        min={5}
        max={45}
        step={0.5}
        value={soil.soilTemp10}
        onChange={(e) => onChangeSoil({ soilTemp10: Number(e.target.value) })}
        className="telemetry-slider"
      />
    </div>

    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <button
          type="button"
          onClick={() => onSelectChannel('tempGleby')}
          className="text-amber-400 hover:underline cursor-pointer"
        >
          Temperatura gleby nr 4 (60 cm)
        </button>
        <span className="font-mono-tabular font-semibold text-white">
          {soil.soilTemp60.toFixed(1)} °C
        </span>
      </div>
      <input
        type="range"
        min={5}
        max={40}
        step={0.5}
        value={soil.soilTemp60}
        onChange={(e) => onChangeSoil({ soilTemp60: Number(e.target.value) })}
        className="telemetry-slider"
      />
    </div>

    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <button
          type="button"
          onClick={() => onSelectChannel('wilgotnosc10')}
          className="text-cyan-300 hover:underline cursor-pointer"
        >
          Wilgotność gleby nr 1 (10 cm)
        </button>
        <span className="font-mono-tabular font-semibold text-white">
          {soil.soilMoisture10.toFixed(0)} %
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={soil.soilMoisture10}
        onChange={(e) => onChangeSoil({ soilMoisture10: Number(e.target.value) })}
        className="telemetry-slider"
      />
    </div>

    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <button
          type="button"
          onClick={() => onSelectChannel('wilgotnosc60')}
          className="text-blue-300 hover:underline cursor-pointer"
        >
          Wilgotność gleby nr 2 (60 cm)
        </button>
        <span className="font-mono-tabular font-semibold text-white">
          {soil.soilMoisture60.toFixed(0)} %
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={soil.soilMoisture60}
        onChange={(e) => onChangeSoil({ soilMoisture60: Number(e.target.value) })}
        className="telemetry-slider"
      />
    </div>
  </div>
);

const ChannelRow: React.FC<{
  id: ChannelId;
  value: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}> = ({ id, value, sub, active, onClick }) => {
  const meta = CHANNELS[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md border p-2 transition-colors cursor-pointer ${
        active
          ? 'bg-white/12 border-white/30'
          : 'bg-white/5 border-white/8 hover:bg-white/10'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-xs font-semibold text-white">{meta.label}</span>
        </div>
        <span
          className="font-mono-tabular text-xs font-bold"
          style={{ color: meta.color }}
        >
          {value}
        </span>
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 pl-4">{sub}</div>
    </button>
  );
};
