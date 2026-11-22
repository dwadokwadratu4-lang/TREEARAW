export type TreeHealthState = 'DOBRY' | 'ZŁY' | 'FATALNY';

export type ViewMode = '3d' | 'ar';

export type CameraPresetId =
  | 'overview'
  | 'crown'
  | 'trunk'
  | 'roots'
  | 'esp32'
  | 'meteo5m';

export type ChannelId =
  | 'dendrometr'
  | 'wilgotnosc10'
  | 'wilgotnosc60'
  | 'tempGleby'
  | 'tempKory'
  | 'tempPowietrza'
  | 'wilgotnoscPowietrza'
  | 'cisnienie'
  | 'imgw';

export interface ChannelMeta {
  id: ChannelId;
  label: string;
  shortLabel: string;
  color: string;
  unit: string;
  description: string;
}

export const CHANNELS: Record<ChannelId, ChannelMeta> = {
  dendrometr: {
    id: 'dendrometr',
    label: 'Dendrometr',
    shortLabel: 'Dendrometr',
    color: '#f59e0b', // Złoty
    unit: 'µm',
    description: 'Dobowe pęcznienie i kurczenie pnia świerka',
  },
  wilgotnosc10: {
    id: 'wilgotnosc10',
    label: 'Wilgotność gleby 10 cm',
    shortLabel: 'Wilg. gleby 10 cm',
    color: '#06b6d4', // Cyjan
    unit: '%',
    description: 'Czujnik wilgotności gleby nr 1 na głębokości 10 cm',
  },
  wilgotnosc60: {
    id: 'wilgotnosc60',
    label: 'Wilgotność gleby 60 cm',
    shortLabel: 'Wilg. gleby 60 cm',
    color: '#3b82f6', // Niebieski
    unit: '%',
    description: 'Czujnik wilgotności gleby nr 2 na głębokości 60 cm',
  },
  tempGleby: {
    id: 'tempGleby',
    label: 'Temperatura gleby',
    shortLabel: 'Temp. gleby',
    color: '#d97706', // Bursztynowy
    unit: '°C',
    description: 'Czujnik nr 3 (10 cm) i nr 4 (60 cm) w przekroju gruntu',
  },
  tempKory: {
    id: 'tempKory',
    label: 'Temperatura kory',
    shortLabel: 'Temp. kory',
    color: '#f97316', // Pomarańczowy
    unit: '°C',
    description: 'Czujnik nr 1 (nasłoneczniona) i nr 2 (zacieniona)',
  },
  tempPowietrza: {
    id: 'tempPowietrza',
    label: 'Temperatura powietrza',
    shortLabel: 'Temp. powietrza',
    color: '#ef4444', // Czerwony
    unit: '°C',
    description: 'Pomiar temperatury powietrza w skrzynce meteo (5 m)',
  },
  wilgotnoscPowietrza: {
    id: 'wilgotnoscPowietrza',
    label: 'Wilgotność powietrza',
    shortLabel: 'Wilg. powietrza',
    color: '#10b981', // Szmaragdowy
    unit: '%',
    description: 'Pomiar wilgotności względnej w skrzynce meteo (5 m)',
  },
  cisnienie: {
    id: 'cisnienie',
    label: 'Ciśnienie atmosferyczne',
    shortLabel: 'Ciśnienie atm.',
    color: '#6366f1', // Indygo
    unit: 'hPa',
    description: 'Barometr ciśnienia atmosferycznego w skrzynce meteo (5 m)',
  },
  imgw: {
    id: 'imgw',
    label: 'Dane IMGW (Teren)',
    shortLabel: 'Dane IMGW',
    color: '#a855f7', // Fioletowy
    unit: '°C',
    description: 'Regionalne dane telemetryczne z bazy IMGW',
  },
};

export const CHANNEL_ORDER: ChannelId[] = [
  'dendrometr',
  'wilgotnosc10',
  'wilgotnosc60',
  'tempGleby',
  'tempKory',
  'tempPowietrza',
  'wilgotnoscPowietrza',
  'cisnienie',
  'imgw',
];

export interface SoilControls {
  soilTemp10: number; // °C (5..45) - Czujnik temperatury gleby nr 3 (10 cm)
  soilMoisture10: number; // % (0..100) - Czujnik wilgotności gleby nr 1 (10 cm)
  soilTemp60: number; // °C (5..40) - Czujnik temperatury gleby nr 4 (60 cm)
  soilMoisture60: number; // % (0..100) - Czujnik wilgotności gleby nr 2 (60 cm)
}

export interface ChannelSample {
  totalHours: number;
  day: number;
  hourOfDay: number;
  dendrometr: number; // µm
  gleba10: number; // % wilgotności (lub złożony odczyt)
  gleba10Temp: number; // °C
  gleba60: number; // % wilgotności
  gleba60Temp: number; // °C
  kora: number; // °C (strona nasłoneczniona nr 1)
  koraShaded: number; // °C (strona zacieniona nr 2)
  meteo5m: number; // °C temp powietrza
  meteo5mHumidity: number; // %
  meteo5mPressure: number; // hPa
  imgw: number; // °C
  imgwHumidity: number; // %
}

export interface TelemetryState {
  // Czas symulacji
  totalHours: number;
  day: number;
  hourOfDay: number; // 0..24

  // Tryb suszy
  droughtMode: boolean;

  // Warunki słoneczne
  sunElevation: number; // -1..1
  sunAzimuthRad: number;
  solarIntensity: number; // 0..1

  // Skrzynka 5m (lokalne warunki powietrza)
  airTemp5m: number; // °C
  airHumidity5m: number; // %
  pressure5m: number; // hPa

  // Dane z bazy IMGW (regionalne)
  imgwTemp: number; // °C
  imgwHumidity: number; // %

  // Czujniki na pniu świerka
  barkTemp1Sunny: number; // °C
  barkTemp2Shaded: number; // °C
  dendroValueUm: number; // µm
  dendroAmplitudeUm: number; // µm
  predictedDendroUm: number; // µm (prognoza AI +1.5h)
  trunkScaleDelta: number;

  // Warunki biologiczne i stan drzewa
  health: number; // 0..100
  stressIndex: number; // 0..1
  stressHours: number; // 0..72+
  beetleInfestation: boolean;
  beetleIntensity: number; // 0..1
  treeState: TreeHealthState;
  statusReason: string;

  // Ostatnie 24 godziny wielokanałowych próbek (wspólne dla tablic 3D i wykresów AI)
  history: ChannelSample[];
}
