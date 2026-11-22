import * as THREE from 'three';
import { CHANNELS, ChannelId, ChannelSample, SoilControls, TelemetryState } from '../types/telemetry';

function applyTextureSettings(
  tex: THREE.CanvasTexture,
  anisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createBarkTexture(
  anisotropy: number,
  withBeetleGalleries = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a3528';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 8 + Math.random() * 18;
    const h = 24 + Math.random() * 52;
    const shade = Math.floor(Math.random() * 35);
    ctx.fillStyle =
      Math.random() > 0.45
        ? `rgb(${76 + shade}, ${52 + shade * 0.7}, ${38 + shade * 0.5})`
        : `rgb(${54 + shade * 0.6}, ${38 + shade * 0.5}, ${30 + shade * 0.4})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
  }

  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.strokeStyle = 'rgba(22, 14, 10, 0.52)';
    ctx.lineWidth = 1.5 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 8, y + 30 + Math.random() * 70);
    ctx.stroke();
  }

  for (let i = 0; i < 45; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = 'rgba(130, 148, 118, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  if (withBeetleGalleries) {
    for (let i = 0; i < 95; i++) {
      const cx = 20 + Math.random() * 472;
      const cy = 20 + Math.random() * 472;

      ctx.strokeStyle = 'rgba(18, 10, 6, 0.85)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (Math.random() - 0.5) * 16, cy + 28 + Math.random() * 26);
      ctx.stroke();

      for (let b = 0; b < 4; b++) {
        const by = cy + 6 + b * 6;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, by);
        ctx.lineTo(cx + (b % 2 === 0 ? 14 : -14), by + (Math.random() - 0.5) * 8);
        ctx.stroke();
      }

      ctx.fillStyle = '#0e0805';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(196, 146, 86, 0.72)';
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy + 3.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return applyTextureSettings(tex, anisotropy, true);
}

export function createForestFloorTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#293a24';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 8;
    const pick = Math.random();
    if (pick < 0.45) {
      ctx.fillStyle = 'rgba(46, 72, 36, 0.4)';
    } else if (pick < 0.8) {
      ctx.fillStyle = 'rgba(72, 56, 34, 0.35)';
    } else {
      ctx.fillStyle = 'rgba(90, 112, 58, 0.28)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return applyTextureSettings(tex, anisotropy, true);
}

export function createSoilCrossSectionTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#2c2017');
  grad.addColorStop(0.16, '#3d2b1d');
  grad.addColorStop(0.32, '#543c28');
  grad.addColorStop(0.75, '#6b4e34');
  grad.addColorStop(1.0, '#5a4432');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 4.5;
    ctx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(32, 22, 14, 0.35)'
        : 'rgba(138, 112, 84, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawDepthMarker = (yPx: number, label: string) => {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, yPx);
    ctx.lineTo(512, yPx);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(10, yPx - 24, 92, 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillText(label, 18, yPx - 9);
  };

  drawDepthMarker(74, '10 cm');
  drawDepthMarker(378, '60 cm');

  const tex = new THREE.CanvasTexture(canvas);
  return applyTextureSettings(tex, anisotropy, true);
}

export function createAuthorPlaqueTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111815';
  ctx.fillRect(0, 0, 768, 320);

  ctx.strokeStyle = '#b48a4e';
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, 736, 288);

  ctx.strokeStyle = 'rgba(180, 138, 78, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, 712, 264);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CYFROWY BLIŹNIAK · MONITORING ŚWIERKA', 384, 102);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 50px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Pomiary: Artur Wierzbicki', 384, 188);

  ctx.fillStyle = '#34d399';
  ctx.font = '500 22px "IBM Plex Mono", monospace';
  ctx.fillText('DENDROMETR · KORA · GLEBA 10/60 CM · IMGW · ESP32', 384, 248);

  const tex = new THREE.CanvasTexture(canvas);
  return applyTextureSettings(tex, anisotropy, true);
}

export function createEsp32FaceplateTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 384);

  ctx.fillStyle = '#0c3b2e';
  ctx.fillRect(28, 28, 456, 328);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 456, 328);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(62, 74, 150, 118);
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 18px "IBM Plex Mono", monospace';
  ctx.fillText('ESP32-S3', 84, 124);
  ctx.font = '600 14px "IBM Plex Mono", monospace';
  ctx.fillText('R8N16', 98, 148);

  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(330, 132, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 16px "IBM Plex Mono", monospace';
  ctx.fillText('RTC', 314, 138);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(402, 82, 54, 96);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 14px "IBM Plex Mono", monospace';
  ctx.fillText('PWR', 413, 134);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px "IBM Plex Mono", monospace';
  ctx.fillText('ESP32S3R8N16 + ZASILANIE + RTC', 48, 260);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 16px "IBM Plex Mono", monospace';
  ctx.fillText('9 KANAŁÓW · TELEMETRIA NASA', 48, 298);

  const tex = new THREE.CanvasTexture(canvas);
  return applyTextureSettings(tex, anisotropy, true);
}

function drawChannelIcon(
  ctx: CanvasRenderingContext2D,
  channelId: ChannelId,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (channelId === 'dendrometr') {
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx - 7, cy);
    ctx.moveTo(cx + 7, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.stroke();
  } else if (channelId === 'wilgotnosc10' || channelId === 'wilgotnosc60' || channelId === 'wilgotnoscPowietrza') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.quadraticCurveTo(cx + 9, cy + 1, cx, cy + 10);
    ctx.quadraticCurveTo(cx - 9, cy + 1, cx, cy - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 12);
    ctx.lineTo(cx + 8, cy + 12);
    ctx.stroke();
  } else if (channelId === 'tempGleby' || channelId === 'tempKory' || channelId === 'tempPowietrza') {
    // Termometr
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - 7);
    ctx.lineTo(cx + 9, cy - 7);
    ctx.moveTo(cx + 5, cy - 2);
    ctx.lineTo(cx + 8, cy - 2);
    ctx.stroke();
  } else if (channelId === 'cisnienie') {
    // Barometr / tarcza ciśnienia
    ctx.beginPath();
    ctx.arc(cx, cy, 10, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + 1);
    ctx.lineTo(cx + 6, cy - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + 1, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // IMGW antena / dane terenowe
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 7.5, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 12, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  }

  ctx.restore();
}

function extractSeries(
  history: ChannelSample[],
  channelId: ChannelId
): number[] {
  return history.map((s) => {
    switch (channelId) {
      case 'dendrometr':
        return s.dendrometr;
      case 'wilgotnosc10':
        return s.gleba10;
      case 'wilgotnosc60':
        return s.gleba60;
      case 'tempGleby':
        return s.gleba10Temp;
      case 'tempKory':
        return s.kora;
      case 'tempPowietrza':
        return s.meteo5m;
      case 'wilgotnoscPowietrza':
        return s.meteo5mHumidity;
      case 'cisnienie':
        return s.meteo5mPressure;
      case 'imgw':
        return s.imgw;
    }
  });
}

export function drawTelemetryBoardCanvas(
  canvas: HTMLCanvasElement,
  channelId: ChannelId,
  telemetry: TelemetryState,
  soil: SoilControls,
  isSelected: boolean
): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const meta = CHANNELS[channelId];

  ctx.clearRect(0, 0, w, h);

  // Półprzezroczyste ciemne szkło tablicy 3D ("NASA dla drzewa")
  ctx.fillStyle = isSelected ? 'rgba(12, 22, 19, 0.95)' : 'rgba(8, 14, 12, 0.86)';
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 18);
  ctx.fill();

  ctx.strokeStyle = meta.color;
  ctx.lineWidth = isSelected ? 6 : 3.4;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 18);
  ctx.stroke();

  // Górny pasek: ikona kanału + nazwa + aktualny czas symulacji
  drawChannelIcon(ctx, channelId, 34, 38, meta.color);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(meta.label, 60, 45);

  const hh = Math.floor(telemetry.hourOfDay);
  const mm = Math.floor((telemetry.hourOfDay - hh) * 60);
  const timeStr = `Dz.${telemetry.day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 16px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, w - 22, 44);

  // Wartość bieżąca + opis pomocniczy
  let mainValue = '';
  let subInfo = '';
  switch (channelId) {
    case 'dendrometr':
      mainValue = `${telemetry.dendroValueUm >= 0 ? '+' : ''}${telemetry.dendroValueUm.toFixed(1)} µm`;
      subInfo = `Ampl. ±${telemetry.dendroAmplitudeUm.toFixed(1)} µm · AI ${telemetry.predictedDendroUm >= 0 ? '+' : ''}${telemetry.predictedDendroUm.toFixed(1)} µm`;
      break;
    case 'wilgotnosc10':
      mainValue = `${soil.soilMoisture10.toFixed(0)} %`;
      subInfo = 'Czujnik wilgotności nr 1 · 10 cm';
      break;
    case 'wilgotnosc60':
      mainValue = `${soil.soilMoisture60.toFixed(0)} %`;
      subInfo = 'Czujnik wilgotności nr 2 · 60 cm';
      break;
    case 'tempGleby':
      mainValue = `${soil.soilTemp10.toFixed(1)} °C`;
      subInfo = `10 cm (nr 3) · 60 cm (nr 4): ${soil.soilTemp60.toFixed(1)} °C`;
      break;
    case 'tempKory':
      mainValue = `${telemetry.barkTemp1Sunny.toFixed(1)} °C`;
      subInfo = `Słońce nr 1 · Cień nr 2: ${telemetry.barkTemp2Shaded.toFixed(1)} °C`;
      break;
    case 'tempPowietrza':
      mainValue = `${telemetry.airTemp5m.toFixed(1)} °C`;
      subInfo = 'Stacja pomiarowa 5 m od świerka';
      break;
    case 'wilgotnoscPowietrza':
      mainValue = `${telemetry.airHumidity5m.toFixed(0)} %`;
      subInfo = 'Wilgotność względna · Stacja 5 m';
      break;
    case 'cisnienie':
      mainValue = `${telemetry.pressure5m.toFixed(0)} hPa`;
      subInfo = 'Ciśnienie baryczne · Stacja 5 m';
      break;
    case 'imgw':
      mainValue = `${telemetry.imgwTemp.toFixed(1)} °C`;
      subInfo = `Wilg. w terenie: ${telemetry.imgwHumidity.toFixed(0)} % (IMGW)`;
      break;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = meta.color;
  ctx.font = '700 44px "IBM Plex Mono", monospace';
  ctx.fillText(mainValue, 24, 110);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subInfo, 24, 140);

  // MIN i MAX z ostatnich 24 godzin
  const series = extractSeries(telemetry.history, channelId);
  const minVal = series.length ? Math.min(...series) : 0;
  const maxVal = series.length ? Math.max(...series) : 0;
  const isIntUnit =
    channelId === 'wilgotnosc10' ||
    channelId === 'wilgotnosc60' ||
    channelId === 'wilgotnoscPowietrza' ||
    channelId === 'cisnienie';
  const fmt = (v: number) =>
    isIntUnit ? `${v.toFixed(0)}${meta.unit}` : `${v.toFixed(1)}${meta.unit}`;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillText(`MIN 24h: ${fmt(minVal)}`, w - 22, 94);
  ctx.fillText(`MAX 24h: ${fmt(maxVal)}`, w - 22, 120);

  // Mini-wykres przebiegu z ostatnich 24 godzin
  const gx = 24;
  const gy = 162;
  const gw = w - 48;
  const gh = h - 186;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.roundRect(gx, gy, gw, gh, 10);
  ctx.fill();

  if (series.length > 1) {
    const span = Math.max(1e-3, maxVal - minVal);
    const padMin = minVal - span * 0.14;
    const padSpan = span * 1.28;

    ctx.beginPath();
    series.forEach((val, idx) => {
      const px = gx + 8 + (idx / (series.length - 1)) * (gw - 16);
      const py = gy + gh - 10 - ((val - padMin) / padSpan) * (gh - 20);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });

    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    const lastVal = series[series.length - 1];
    const lx = gx + gw - 8;
    const ly = gy + gh - 10 - ((lastVal - padMin) / padSpan) * (gh - 20);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStatusBoardCanvas(
  canvas: HTMLCanvasElement,
  telemetry: TelemetryState
): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Półprzezroczyste ciemne szkło z szmaragdowo-złotą ramką (10. tablica statusowa)
  ctx.fillStyle = 'rgba(7, 16, 13, 0.92)';
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 18);
  ctx.fill();

  const frameGrad = ctx.createLinearGradient(0, 0, w, h);
  frameGrad.addColorStop(0, '#10b981');
  frameGrad.addColorStop(0.5, '#f59e0b');
  frameGrad.addColorStop(1, '#10b981');
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 18);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(14, 14, w - 28, h - 28, 12);
  ctx.stroke();

  // Górny pasek: Tytuł + Dzień i Godzina
  const hh = Math.floor(telemetry.hourOfDay);
  const mm = Math.floor((telemetry.hourOfDay - hh) * 60);
  const dayTimeStr = `Dzień ${telemetry.day} • ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  ctx.fillStyle = '#fde68a';
  ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DIAGNOSTYKA ŚWIERKU', 26, 42);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(dayTimeStr, w - 26, 42);

  // Główny status zdrowia drzewa
  let statusText = 'STAN DRZEWA: DOBRY';
  let statusColor = '#34d399';
  let statusBg = 'rgba(16, 185, 129, 0.16)';
  let statusStroke = 'rgba(52, 211, 153, 0.55)';

  if (telemetry.beetleInfestation || telemetry.treeState === 'FATALNY') {
    statusText = 'ZAGROŻENIE';
    statusColor = '#f87171';
    statusBg = 'rgba(239, 68, 68, 0.18)';
    statusStroke = 'rgba(248, 113, 113, 0.65)';
  } else if (telemetry.treeState === 'ZŁY' || telemetry.stressIndex >= 0.42) {
    statusText = 'STRES WODNY';
    statusColor = '#fb923c';
    statusBg = 'rgba(249, 115, 22, 0.18)';
    statusStroke = 'rgba(251, 146, 60, 0.65)';
  }

  ctx.fillStyle = statusBg;
  ctx.beginPath();
  ctx.roundRect(24, 62, w - 48, 74, 12);
  ctx.fill();
  ctx.strokeStyle = statusStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = statusColor;
  ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statusText, w / 2, 108);

  // Pasek kondycji oraz stres skumulowany
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 16px "IBM Plex Mono", monospace';
  ctx.fillText(
    `Kondycja: ${Math.round(telemetry.health)}%   Stres: ${telemetry.stressHours.toFixed(1)}h / 72h`,
    26,
    166
  );

  // Sekcja odliczania do ataku kornika
  const boxX = 24;
  const boxY = 186;
  const boxW = w - 48;
  const boxH = 122;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.42)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const remainingHours = Math.max(0, 72 - telemetry.stressHours);
  let beetleLine = '';
  let beetleSub = '';
  let beetleColor = '#34d399';

  if (telemetry.beetleInfestation || remainingHours <= 0.05) {
    beetleLine = 'Atak kornika: AKTYWNY!';
    beetleSub = 'Przekroczono próg 72h skumulowanego stresu';
    beetleColor = '#f87171';
  } else if (telemetry.stressHours <= 0.05) {
    beetleLine = 'Atak kornika za: > 30 dni (Brak zagrożenia)';
    beetleSub = 'Skumulowany stres: 0.0h · Pełna odporność żywiczna';
    beetleColor = '#34d399';
  } else {
    const daysLeft = remainingHours / 24;
    const daysLabel = daysLeft >= 1 ? `${daysLeft.toFixed(1)} dni` : `${daysLeft.toFixed(2)} dni`;
    beetleLine = `Atak kornika za: ${daysLabel}`;
    beetleSub = `Pozostało ${remainingHours.toFixed(1)}h ciągłego stresu do progu 72h`;
    beetleColor = remainingHours <= 24 ? '#f87171' : '#fbbf24';
  }

  ctx.fillStyle = beetleColor;
  ctx.font = beetleLine.length > 32
    ? '700 19px "Plus Jakarta Sans", sans-serif'
    : '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(beetleLine, w / 2, boxY + 42);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(beetleSub, w / 2, boxY + 69);

  // Pasek postępu stresu 0..72h
  const barX = boxX + 20;
  const barY = boxY + 88;
  const barW = boxW - 40;
  const barH = 14;
  const progress = Math.max(0, Math.min(1, telemetry.stressHours / 72));

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 7);
  ctx.fill();

  if (progress > 0.005) {
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, '#10b981');
    barGrad.addColorStop(0.55, '#f59e0b');
    barGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(12, barW * progress), barH, 7);
    ctx.fill();
  }
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
