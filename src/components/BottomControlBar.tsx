import React from 'react';
import { Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react';
import { CAMERA_PRESETS } from '../three/SpruceScene';
import { CameraPresetId, ViewMode } from '../types/telemetry';

interface BottomControlBarProps {
  viewMode: ViewMode;
  paused: boolean;
  onTogglePause: () => void;
  speedMultiplier: number;
  onChangeSpeed: (speed: number) => void;
  onReset: () => void;
  day: number;
  hourOfDay: number;
  sunElevation: number;
  activePreset: CameraPresetId;
  onSelectPreset: (id: CameraPresetId) => void;
}

function formatHour(hourOfDay: number): string {
  const h = Math.floor(hourOfDay);
  const m = Math.floor((hourOfDay - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const BottomControlBar: React.FC<BottomControlBarProps> = ({
  viewMode,
  paused,
  onTogglePause,
  speedMultiplier,
  onChangeSpeed,
  onReset,
  day,
  hourOfDay,
  sunElevation,
  activePreset,
  onSelectPreset,
}) => {
  const isDaylight = sunElevation > 0;

  return (
    <div className="fixed z-20 bottom-3 left-1/2 -translate-x-1/2 max-w-[95vw] w-fit rounded-xl border border-white/12 bg-[#0b110f]/90 px-3 py-2 shadow-2xl flex flex-col lg:flex-row items-center gap-2 lg:gap-3.5">
      {/* Kontrola czasu symulacji */}
      <div className="flex items-center gap-2 whitespace-nowrap shrink-0 flex-wrap justify-center">
        <button
          type="button"
          onClick={onTogglePause}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
        >
          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{paused ? 'Wznów' : 'Pauza'}</span>
        </button>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
          {isDaylight ? (
            <Sun className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-sky-300" />
          )}
          <span className="font-mono-tabular font-semibold text-slate-100">
            Dzień {day} · {formatHour(hourOfDay)}
          </span>
        </div>

        {/* Suwak prędkości symulacji */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
          <span className="text-[11px] text-slate-400">Tempo:</span>
          <input
            type="range"
            min={1}
            max={360}
            step={1}
            value={speedMultiplier}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            aria-label="Suwak prędkości symulacji"
            className="telemetry-slider w-20 sm:w-24"
          />
          <span className="font-mono-tabular text-[11px] font-semibold text-emerald-300 w-9 text-right">
            {speedMultiplier}×
          </span>
        </div>

        <button
          type="button"
          onClick={onReset}
          title="Resetuj symulację"
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {viewMode === '3d' && (
        <>
          <div className="hidden lg:block w-px h-6 bg-white/12 shrink-0" />

          {/* Presety kamery */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[88vw] lg:max-w-none pb-0.5 md:pb-0">
            {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => onSelectPreset(pid)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activePreset === pid
                    ? 'bg-white/20 text-white border border-white/25'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                {CAMERA_PRESETS[pid].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
