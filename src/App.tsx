import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Bug,
  Camera,
  Info,
  Lock,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { forestAudio } from './audio/soundEngine';
import { BottomControlBar } from './components/BottomControlBar';
import { InfoModal } from './components/InfoModal';
import { TelemetryHud } from './components/TelemetryHud';
import { TypewriterAuthor } from './components/TypewriterAuthor';
import {
  applySoilControlsChange,
  createInitialTelemetryState,
  createWeatherSeeds,
  DEFAULT_SOIL_CONTROLS,
  stepSimulation,
  WeatherSeeds,
} from './simulation/engine';
import { ArTrackingStatus, SpruceSceneManager } from './three/SpruceScene';
import {
  CameraPresetId,
  ChannelId,
  SoilControls,
  TelemetryState,
  ViewMode,
} from './types/telemetry';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SpruceSceneManager | null>(null);

  const [soil, setSoil] = useState<SoilControls>(DEFAULT_SOIL_CONTROLS);
  const soilRef = useRef<SoilControls>(DEFAULT_SOIL_CONTROLS);
  const seedsRef = useRef<WeatherSeeds>(createWeatherSeeds());

  const [telemetry, setTelemetry] = useState<TelemetryState>(() =>
    createInitialTelemetryState(DEFAULT_SOIL_CONTROLS, seedsRef.current)
  );
  const telemetryRef = useRef<TelemetryState>(telemetry);

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(12);
  const speedRef = useRef(12);

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [arStatus, setArStatus] = useState<{
    status: ArTrackingStatus;
    message?: string;
  }>({ status: 'idle' });
  const [arLocked, setArLocked] = useState(false);
  const [boardsVisible, setBoardsVisible] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  // Na mniejszych ekranach panel domyślnie zwinięty, na desktopie otwarty
  const [hudOpen, setHudOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 960 : true
  );
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPresetId>('overview');
  const [selectedChannel, setSelectedChannel] = useState<ChannelId | null>(null);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    soilRef.current = soil;
    sceneRef.current?.setSoilControls(soil);
  }, [soil]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  // Montaż sceny Three.js (raz przy starcie)
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    try {
      const manager = new SpruceSceneManager(el, telemetryRef.current, {
        onSelectChannel: (cid) => {
          forestAudio.playUiClick(cid ? 840 : 660);
          setSelectedChannel(cid);
        },
        onArStatusChange: (status, message) => {
          setArStatus({ status, message });
        },
      });
      sceneRef.current = manager;
      manager.setSoilControls(soilRef.current);

      return () => {
        manager.dispose();
        sceneRef.current = null;
      };
    } catch {
      setWebglError(true);
      return undefined;
    }
  }, []);

  // Pętla symulacji biologiczno-pogodowej (co 100 ms)
  useEffect(() => {
    let lastTime = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dtSec = Math.min(0.25, (now - lastTime) / 1000);
      lastTime = now;

      if (pausedRef.current) return;

      const dtSimHours = dtSec * 0.015 * speedRef.current;
      const { telemetry: next, nextSoil } = stepSimulation(
        telemetryRef.current,
        dtSimHours,
        soilRef.current,
        seedsRef.current
      );

      if (
        nextSoil.soilMoisture10 !== soilRef.current.soilMoisture10 ||
        nextSoil.soilMoisture60 !== soilRef.current.soilMoisture60 ||
        nextSoil.soilTemp10 !== soilRef.current.soilTemp10 ||
        nextSoil.soilTemp60 !== soilRef.current.soilTemp60
      ) {
        soilRef.current = nextSoil;
        setSoil(nextSoil);
        sceneRef.current?.setSoilControls(nextSoil);
      }

      telemetryRef.current = next;
      setTelemetry(next);
      sceneRef.current?.setTelemetry(next);
      forestAudio.updateEnvironment(next.beetleInfestation, next.treeState);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      forestAudio.dispose();
    };
  }, []);

  const handleChangeSoil = useCallback((patch: Partial<SoilControls>) => {
    forestAudio.playUiClick(700);
    const updatedSoil = { ...soilRef.current, ...patch };
    soilRef.current = updatedSoil;
    setSoil(updatedSoil);
    sceneRef.current?.setSoilControls(updatedSoil);

    // Natychmiastowe przeliczenie kondycji drzewa, dendrometru i koloru korony
    const nextTel = applySoilControlsChange(
      telemetryRef.current,
      updatedSoil,
      seedsRef.current
    );
    telemetryRef.current = nextTel;
    setTelemetry(nextTel);
    sceneRef.current?.setTelemetry(nextTel);
    forestAudio.updateEnvironment(nextTel.beetleInfestation, nextTel.treeState);
  }, []);

  const handleToggleDrought = useCallback(() => {
    const nextDrought = !telemetryRef.current.droughtMode;
    forestAudio.playUiClick(nextDrought ? 540 : 840);
    const patched: TelemetryState = {
      ...telemetryRef.current,
      droughtMode: nextDrought,
    };
    const nextTel = applySoilControlsChange(
      patched,
      soilRef.current,
      seedsRef.current
    );
    telemetryRef.current = nextTel;
    setTelemetry(nextTel);
    sceneRef.current?.setTelemetry(nextTel);
  }, []);

  const handleApplyHealthyReset = useCallback(() => {
    forestAudio.playUiClick(860);
    const patched: TelemetryState = {
      ...telemetryRef.current,
      droughtMode: false,
      health: Math.max(telemetryRef.current.health, 92),
      stressHours: 0,
      beetleInfestation: false,
      beetleIntensity: 0,
    };
    soilRef.current = DEFAULT_SOIL_CONTROLS;
    setSoil(DEFAULT_SOIL_CONTROLS);
    sceneRef.current?.setSoilControls(DEFAULT_SOIL_CONTROLS);

    const nextTel = applySoilControlsChange(
      patched,
      DEFAULT_SOIL_CONTROLS,
      seedsRef.current
    );
    telemetryRef.current = nextTel;
    setTelemetry(nextTel);
    sceneRef.current?.setTelemetry(nextTel);
    forestAudio.updateEnvironment(false, nextTel.treeState);
  }, []);

  const handleSelectViewMode = useCallback(
    async (nextMode: ViewMode) => {
      if (nextMode === viewMode) return;
      forestAudio.playUiClick(800);
      setViewMode(nextMode);
      setArLocked(false);
      if (nextMode === 'ar') {
        setHudOpen(false);
      }
      await sceneRef.current?.setViewMode(nextMode);
    },
    [viewMode]
  );

  const handleToggleBoards = useCallback(() => {
    setBoardsVisible((prev) => {
      const next = !prev;
      forestAudio.playUiClick(next ? 860 : 620);
      sceneRef.current?.setBoardsVisible(next);
      return next;
    });
  }, []);

  const handleToggleArLock = useCallback(() => {
    const next = !arLocked;
    const applied = sceneRef.current?.setArLocked(next);
    if (next && !applied) {
      forestAudio.playUiClick(520);
      return;
    }
    forestAudio.playUiClick(next ? 900 : 720);
    setArLocked(Boolean(applied));
  }, [arLocked]);

  const handleSelectChannel = useCallback((cid: ChannelId) => {
    forestAudio.playUiClick(840);
    setSelectedChannel((prev) => {
      const next = prev === cid ? null : cid;
      sceneRef.current?.setSelectedChannel(next);
      if (next) {
        sceneRef.current?.focusBoard(next);
      }
      return next;
    });
  }, []);

  const handleToggleSound = useCallback(async () => {
    const next = await forestAudio.setEnabled(!soundEnabled);
    setSoundEnabled(next);
    if (next) {
      forestAudio.updateEnvironment(
        telemetryRef.current.beetleInfestation,
        telemetryRef.current.treeState
      );
      forestAudio.playUiClick(880);
    }
  }, [soundEnabled]);

  const handleSelectPreset = useCallback((pid: CameraPresetId) => {
    forestAudio.playUiClick(780);
    setActivePreset(pid);
    sceneRef.current?.focusPreset(pid);
  }, []);

  const handleReset = useCallback(() => {
    forestAudio.playUiClick(620);
    seedsRef.current = createWeatherSeeds();
    soilRef.current = DEFAULT_SOIL_CONTROLS;
    setSoil(DEFAULT_SOIL_CONTROLS);
    const fresh = createInitialTelemetryState(
      DEFAULT_SOIL_CONTROLS,
      seedsRef.current
    );
    telemetryRef.current = fresh;
    setTelemetry(fresh);
    setSelectedChannel(null);
    sceneRef.current?.setSelectedChannel(null);
    sceneRef.current?.setTelemetry(fresh);
    sceneRef.current?.setSoilControls(DEFAULT_SOIL_CONTROLS);
    forestAudio.updateEnvironment(false, 'DOBRY');
  }, []);

  const headerStatusClass =
    telemetry.treeState === 'DOBRY'
      ? 'text-emerald-300 border-emerald-400/35 bg-emerald-500/15'
      : telemetry.treeState === 'ZŁY'
        ? 'text-amber-300 border-amber-400/35 bg-amber-500/15'
        : 'text-rose-300 border-rose-500/45 bg-rose-600/20';

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${
        viewMode === 'ar' ? 'bg-transparent' : 'bg-[#090e0c]'
      }`}
    >
      {/* Kontener WebGL 3D / nakładka WebAR */}
      <div
        ref={mountRef}
        className="absolute inset-0 z-10 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {webglError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090e0c] p-6 text-center">
          <div className="max-w-md rounded-xl border border-white/15 bg-[#101815] p-6">
            <h2 className="text-lg font-semibold text-white">
              Brak wsparcia WebGL w przeglądarce
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              Aby wyświetlić trójwymiarową scenę monitoringu świerka, włącz akcelerację sprzętową WebGL.
            </p>
          </div>
        </div>
      )}

      {/* Górny nagłówek z tytułem, podtytułem CYFROWY BLIŹNIAK, maszyną do pisania oraz [3D] [AR] [INFO] */}
      <header className="fixed z-20 top-0 left-0 right-0 h-14 px-3 md:px-5 border-b border-white/10 bg-[#0b110f]/90 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0 leading-tight">
            <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
              System Monitoringu Świerka
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs truncate">
              <span className="font-semibold tracking-wider text-slate-400 shrink-0">
                CYFROWY BLIŹNIAK
              </span>
              <span className="text-slate-600 shrink-0">·</span>
              <TypewriterAuthor />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Status drzewa */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap ${headerStatusClass}`}
          >
            {telemetry.beetleInfestation && <Bug className="w-3.5 h-3.5" />}
            <span>Stan: {telemetry.treeState}</span>
          </div>

          {/* Kompaktowe przyciski [3D] [AR] [INFO] */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/12">
            <button
              type="button"
              onClick={() => handleSelectViewMode('3d')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === '3d'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Swobodny podgląd 3D"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectViewMode('ar')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'ar'
                  ? 'bg-violet-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Tryb WebAR ze znacznikiem HIRO"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>AR</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              forestAudio.playUiClick(780);
              setInfoOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/12 bg-white/5 text-slate-200 hover:text-white hover:bg-white/12 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            title="Informacje o projekcie i znacznik HIRO"
          >
            <Info className="w-3.5 h-3.5 text-sky-300" />
            <span className="hidden sm:inline">INFO</span>
          </button>

          {/* Przełącznik widoczności lewitującego pierścienia tablic 3D */}
          <button
            type="button"
            onClick={handleToggleBoards}
            aria-pressed={boardsVisible}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              boardsVisible
                ? 'border-teal-400/50 bg-teal-500/20 text-teal-200 hover:bg-teal-500/30'
                : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
            title="Pokaż lub ukryj lewitujący pierścień tablic telemetrycznych 3D"
          >
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>Tablice</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSound}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              soundEnabled
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
            }`}
            title="Włącz / wyłącz dźwięk lasu i alarmy"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              forestAudio.playUiClick(760);
              setHudOpen((o) => !o);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 text-slate-100 hover:bg-white/15 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            title="Otwórz lub zwiń zakładkę Telemetria"
          >
            {hudOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Telemetria</span>
          </button>
        </div>
      </header>

      {/* Pasek statusu WebAR HIRO + przycisk blokady na stole i podgląd znacznika */}
      {viewMode === 'ar' && (
        <div className="fixed z-20 top-16 left-1/2 -translate-x-1/2 max-w-[95vw] rounded-lg border border-violet-400/40 bg-[#0b110f]/92 px-3 py-2 text-xs text-slate-100 shadow-xl flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="font-medium">
              {arStatus.message || 'Skieruj kamerę na czarny znacznik HIRO'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleArLock}
              disabled={
                !arLocked &&
                arStatus.status !== 'tracking' &&
                arStatus.status !== 'locked'
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                arLocked
                  ? 'bg-amber-500/25 border-amber-400/60 text-amber-200 hover:bg-amber-500/35 cursor-pointer'
                  : arStatus.status === 'tracking'
                    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/35 cursor-pointer'
                    : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
              }`}
              title={
                arLocked
                  ? 'Odblokuj i wróć do śledzenia znacznika HIRO'
                  : 'Zamroź pozycję i kąt drzewa na stole (ignoruje zasłonięcie HIRO)'
              }
            >
              {arLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Odblokuj (HIRO)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Zablokuj na stole</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="px-2 py-1 rounded bg-violet-500/25 border border-violet-400/40 text-violet-200 hover:bg-violet-500/40 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
            >
              Znacznik HIRO
            </button>
          </div>
        </div>
      )}

      {/* Alert krytyczny (śmierć drzewa lub kornik) */}
      {(telemetry.treeState === 'FATALNY' || telemetry.beetleInfestation) && (
        <div
          className={`fixed z-20 ${
            viewMode === 'ar' ? 'top-28' : 'top-16'
          } left-3 max-w-[360px] rounded-lg border border-rose-500/50 bg-rose-950/90 px-3 py-2 text-xs text-rose-100 shadow-lg flex items-center gap-2`}
        >
          <Bug className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            {telemetry.treeState === 'FATALNY'
              ? 'ALERT KRYTYCZNY: Śmierć świerka — korona obumarła, igły opadają.'
              : 'ALERT: Inwazja kornika drukarza po 72h ciągłego stresu!'}
          </span>
        </div>
      )}

      {/* Zakładka Telemetria (Stan zdrowia, Tryb Susza, Suwaki gleby i 9 kanałów) */}
      <TelemetryHud
        open={hudOpen}
        onClose={() => setHudOpen(false)}
        telemetry={telemetry}
        soil={soil}
        selectedChannel={selectedChannel}
        onSelectChannel={handleSelectChannel}
        onChangeSoil={handleChangeSoil}
        onToggleDrought={handleToggleDrought}
        onApplyHealthyReset={handleApplyHealthyReset}
      />

      {/* Modal [INFO] z sekcją Predykcja AI (3 kroki), architekturą 9 kanałów i znacznikiem HIRO */}
      <InfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        telemetry={telemetry}
        selectedChannel={selectedChannel}
        onSelectChannel={handleSelectChannel}
      />

      {/* Dolny pasek czasu i kamer */}
      <BottomControlBar
        viewMode={viewMode}
        paused={paused}
        onTogglePause={() => {
          forestAudio.playUiClick(paused ? 860 : 620);
          setPaused((p) => !p);
        }}
        speedMultiplier={speedMultiplier}
        onChangeSpeed={(spd) => {
          forestAudio.playUiClick(760);
          setSpeedMultiplier(spd);
        }}
        onReset={handleReset}
        day={telemetry.day}
        hourOfDay={telemetry.hourOfDay}
        sunElevation={telemetry.sunElevation}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />
    </div>
  );
}
