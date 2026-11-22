import React from 'react';
import {
  CHANNEL_ORDER,
  CHANNELS,
  ChannelId,
  ChannelSample,
  TelemetryState,
} from '../types/telemetry';

interface AiPredictionStagesProps {
  telemetry: TelemetryState;
  selectedChannel: ChannelId | null;
  onSelectChannel: (id: ChannelId) => void;
}

interface NormalizedSeries {
  id: ChannelId;
  color: string;
  points: Array<{ x: number; y: number }>;
  atLeft: { x: number; y: number };
  atNow: { x: number; y: number };
}

function getRawValue(sample: ChannelSample, id: ChannelId): number {
  switch (id) {
    case 'dendrometr':
      return sample.dendrometr;
    case 'wilgotnosc10':
      return sample.gleba10;
    case 'wilgotnosc60':
      return sample.gleba60;
    case 'tempGleby':
      return sample.gleba10Temp;
    case 'tempKory':
      return sample.kora;
    case 'tempPowietrza':
      return sample.meteo5m;
    case 'wilgotnoscPowietrza':
      return sample.meteo5mHumidity;
    case 'cisnienie':
      return sample.meteo5mPressure;
    case 'imgw':
      return sample.imgw;
  }
}

function buildStageGeometry(
  telemetry: TelemetryState,
  width: number,
  height: number
): {
  series: NormalizedSeries[];
  nowX: number;
  leftX: number;
  rightX: number;
  dendroNowY: number;
  dendroPredY: number;
} {
  const padX = 14;
  const padY = 14;
  const nowX = width * 0.5;
  const leftX = padX;
  const rightX = width - padX;

  // Ostatnie 3 godziny symulacji (lub min. 12 próbek z końca)
  const latestHour = telemetry.totalHours;
  const threeHoursAgo = latestHour - 3.0;
  let recent = telemetry.history.filter((s) => s.totalHours >= threeHoursAgo);
  if (recent.length < 6) {
    recent = telemetry.history.slice(-12);
  }

  const series: NormalizedSeries[] = CHANNEL_ORDER.map((id, chIdx) => {
    const rawVals = recent.map((s) => getRawValue(s, id));
    const minV = Math.min(...rawVals);
    const maxV = Math.max(...rawVals);
    const span = Math.max(0.8, maxV - minV);

    const bandShift = ((chIdx - 4) / 8) * 0.22;

    const points = recent.map((s, idx) => {
      const tNorm = recent.length > 1 ? idx / (recent.length - 1) : 1;
      const x = leftX + tNorm * (nowX - leftX);
      const val = getRawValue(s, id);
      const vNorm = (val - minV) / span;
      const microRipple =
        Math.sin(tNorm * Math.PI * 3.5 + chIdx * 1.15 + telemetry.totalHours * 0.6) *
        0.055;
      const combined = Math.max(
        0.08,
        Math.min(0.92, 0.16 + vNorm * 0.66 + bandShift + microRipple)
      );
      const y = height - padY - combined * (height - padY * 2);
      return { x, y };
    });

    const atLeft = points[0] ?? { x: leftX, y: height * 0.5 };
    const atNow = points[points.length - 1] ?? { x: nowX, y: height * 0.5 };

    return {
      id,
      color: CHANNELS[id].color,
      points,
      atLeft,
      atNow,
    };
  });

  const dendroSeries = series.find((s) => s.id === 'dendrometr');
  const dendroNowY = dendroSeries?.atNow.y ?? height * 0.5;

  const dendroRecent = recent.map((s) => s.dendrometr);
  const dMin = Math.min(...dendroRecent);
  const dMax = Math.max(...dendroRecent);
  const dSpan = Math.max(2, dMax - dMin);
  const predNorm = Math.max(
    0.1,
    Math.min(0.9, 0.16 + ((telemetry.predictedDendroUm - dMin) / dSpan) * 0.66)
  );
  const dendroPredY = height - padY - predNorm * (height - padY * 2);

  return { series, nowX, leftX, rightX, dendroNowY, dendroPredY };
}

export const AiPredictionStages: React.FC<AiPredictionStagesProps> = ({
  telemetry,
  selectedChannel,
  onSelectChannel,
}) => {
  const width = 460;
  const height = 112;
  const geom = buildStageGeometry(telemetry, width, height);

  // Wyselekcjonowane cechy objaśniające wpływające na dendrometr: Wilg. gleby 10 cm, Wilg. gleby 60 cm, Temp. kory, Temp. powietrza
  const explanatoryIds: ChannelId[] = [
    'wilgotnosc10',
    'wilgotnosc60',
    'tempKory',
    'tempPowietrza',
  ];
  const explanatorySeries = geom.series.filter((s) =>
    explanatoryIds.includes(s.id)
  );

  const renderBaseWaves = () =>
    geom.series.map((s) => {
      const pts = s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      // Prawa połowa (horyzont przyszły jako subtelna kontynuacja kontekstu fali tła w Kroku 1-3)
      const isHighlighted = selectedChannel === s.id;
      return (
        <polyline
          key={s.id}
          fill="none"
          stroke={s.color}
          strokeWidth={isHighlighted ? 2.6 : 1.7}
          strokeOpacity={selectedChannel && !isHighlighted ? 0.45 : 0.92}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts}
        />
      );
    });

  const renderCenterNowLine = () => (
    <line
      x1={geom.nowX}
      y1={6}
      x2={geom.nowX}
      y2={height - 6}
      stroke="#22c55e"
      strokeWidth="2.2"
    />
  );

  return (
    <div className="space-y-3">
      {/* Legenda kanałów spójna z kablami 3D i tablicami */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CHANNEL_ORDER.map((cid) => {
          const meta = CHANNELS[cid];
          const active = selectedChannel === cid;
          return (
            <button
              key={cid}
              type="button"
              onClick={() => onSelectChannel(cid)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-white/15 border-white/35 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: meta.color }}
              />
              <span>{meta.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* KROK 1: Fuzja pomiarów */}
      <div className="rounded-lg border border-white/10 bg-[#070c0a]/85 p-3">
        <div className="text-[11px] font-semibold text-emerald-300 mb-0.5">
          Krok 1 · Fuzja pomiarów (ostatnie 3 godziny)
        </div>
        <p className="text-xs text-slate-200 leading-snug mb-2">
          Fuzja pomiarów to proces łączenia wyników pomiarów z wielu źródeł.
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[106px] rounded bg-black/35 border border-white/8"
          aria-label="Diagram kroku 1: fuzja wielokanałowych pomiarów z ostatnich 3 godzin"
        >
          {renderBaseWaves()}
          {renderCenterNowLine()}
        </svg>
      </div>

      {/* KROK 2: Selekcja cech */}
      <div className="rounded-lg border border-white/10 bg-[#070c0a]/85 p-3">
        <div className="text-[11px] font-semibold text-amber-300 mb-0.5">
          Krok 2 · Selekcja cech zmiennych wejściowych
        </div>
        <p className="text-xs text-slate-200 leading-snug mb-2">
          Selekcja cech zmiennych wejściowych wpływających na bieżący odczyt dendrometru.
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[106px] rounded bg-black/35 border border-white/8"
          aria-label="Diagram kroku 2: selekcja zmiennych wejściowych łączących przeszłe odczyty z punktem dendrometru"
        >
          {renderBaseWaves()}
          {renderCenterNowLine()}

          {/* 4 animowane złote linie łączące punkt dendrometru (Teraz) z lewą krawędzią krzywych (ostatnie 3h) */}
          {explanatorySeries.map((s, idx) => {
            const pathD = `M ${geom.nowX.toFixed(1)} ${geom.dendroNowY.toFixed(1)} Q ${(
              geom.nowX * 0.55
            ).toFixed(1)} ${((geom.dendroNowY + s.atLeft.y) * 0.5 + (idx - 1.5) * 6).toFixed(1)} ${s.atLeft.x.toFixed(1)} ${s.atLeft.y.toFixed(1)}`;
            return (
              <g key={`sel_${s.id}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.8"
                  strokeOpacity="0.85"
                  strokeDasharray="6 4"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="20"
                    dur={`${1.1 + idx * 0.15}s`}
                    repeatCount="indefinite"
                  />
                </path>
                {/* Świetlisty impuls wędrujący po złotej linii */}
                <circle r="2.6" fill="#fef08a">
                  <animateMotion
                    dur={`${1.5 + idx * 0.2}s`}
                    repeatCount="indefinite"
                    path={pathD}
                  />
                </circle>
                <circle
                  cx={s.atLeft.x}
                  cy={s.atLeft.y}
                  r="3.2"
                  fill={s.color}
                  stroke="#fef08a"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}

          {/* Pulsujący złoty punkt na przecięciu zielonej linii (Teraz) z dendrometrem */}
          <circle cx={geom.nowX} cy={geom.dendroNowY} r="7" fill="#f59e0b" fillOpacity="0.32">
            <animate
              attributeName="r"
              values="5;10;5"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={geom.nowX}
            cy={geom.dendroNowY}
            r="4.2"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1.4"
          />
        </svg>
      </div>

      {/* KROK 3: Predykcja przyszłości */}
      <div className="rounded-lg border border-white/10 bg-[#070c0a]/85 p-3">
        <div className="text-[11px] font-semibold text-amber-300 mb-0.5">
          Krok 3 · Predykcja wskazania dendrometru
        </div>
        <p className="text-xs text-slate-200 leading-snug mb-2">
          Predykcja najbardziej prawdopodobnej wartości wskazania dendrometru na podstawie wyselekcjonowanych zmiennych objaśniających.
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[106px] rounded bg-black/35 border border-white/8"
          aria-label="Diagram kroku 3: predykcja wartości dendrometru w przyszłości"
        >
          {renderBaseWaves()}
          {renderCenterNowLine()}

          {/* Przerywana złota linia prognozy od Teraz do prawej krawędzi */}
          <line
            x1={geom.nowX}
            y1={geom.dendroNowY}
            x2={geom.rightX}
            y2={geom.dendroPredY}
            stroke="#f59e0b"
            strokeWidth="2.4"
            strokeDasharray="5 4"
          />

          {/* 4 animowane złote linie zbiegające się od zielonej linii (Teraz) do punktu prognozy przy prawej krawędzi */}
          {explanatorySeries.map((s, idx) => {
            const pathD = `M ${geom.nowX.toFixed(1)} ${s.atNow.y.toFixed(1)} Q ${(
              geom.nowX +
              (geom.rightX - geom.nowX) * 0.45
            ).toFixed(1)} ${((s.atNow.y + geom.dendroPredY) * 0.5 + (idx - 1.5) * 6).toFixed(1)} ${geom.rightX.toFixed(1)} ${geom.dendroPredY.toFixed(1)}`;
            return (
              <g key={`pred_${s.id}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.7"
                  strokeOpacity="0.85"
                  strokeDasharray="6 4"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="20"
                    to="0"
                    dur={`${1.1 + idx * 0.15}s`}
                    repeatCount="indefinite"
                  />
                </path>
                <circle r="2.6" fill="#fef08a">
                  <animateMotion
                    dur={`${1.4 + idx * 0.18}s`}
                    repeatCount="indefinite"
                    path={pathD}
                  />
                </circle>
                <circle
                  cx={geom.nowX}
                  cy={s.atNow.y}
                  r="3.2"
                  fill={s.color}
                  stroke="#fef08a"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}

          {/* Pulsujący złoty punkt prognozowanego wyniku przy prawej krawędzi */}
          <circle cx={geom.rightX} cy={geom.dendroPredY} r="7" fill="#f59e0b" fillOpacity="0.32">
            <animate
              attributeName="r"
              values="5;10;5"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={geom.rightX}
            cy={geom.dendroPredY}
            r="4.5"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
};
