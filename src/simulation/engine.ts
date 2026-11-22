import {
  ChannelSample,
  SoilControls,
  TelemetryState,
  TreeHealthState,
} from '../types/telemetry';

export const DEFAULT_SOIL_CONTROLS: SoilControls = {
  soilTemp10: 14.5,
  soilMoisture10: 62,
  soilTemp60: 11.2,
  soilMoisture60: 68,
};

export interface WeatherSeeds {
  tempBias: number;
  humidityBias: number;
  pressureBase: number;
  phaseOffset: number;
}

export function createWeatherSeeds(): WeatherSeeds {
  return {
    tempBias: (Math.random() - 0.5) * 1.8,
    humidityBias: (Math.random() - 0.5) * 5.0,
    pressureBase: 1014 + (Math.random() - 0.5) * 6.0,
    phaseOffset: Math.random() * Math.PI * 2,
  };
}

function smoothNoise(t: number, seed: number): number {
  return (
    Math.sin(t * 0.37 + seed) * 0.5 +
    Math.sin(t * 0.83 + seed * 1.7) * 0.3 +
    Math.cos(t * 1.91 + seed * 0.6) * 0.2
  );
}

function computeEnvironmentAtHour(
  totalHours: number,
  soil: SoilControls,
  seeds: WeatherSeeds,
  healthFactor: number,
  droughtMode: boolean
) {
  const hourOfDay = ((totalHours % 24) + 24) % 24;
  const day = Math.floor(totalHours / 24) + 1;

  // Słońce: wschód ok. 5:30, górowanie 13:00, zachód ok. 20:30
  const sunAngle = ((hourOfDay - 5.5) / 15) * Math.PI;
  const rawElevation =
    hourOfDay >= 5.5 && hourOfDay <= 20.5 ? Math.sin(sunAngle) : -0.35;
  const sunElevation = Math.max(-1, Math.min(1, rawElevation));
  const solarIntensity = Math.max(0, sunElevation);

  const sunAzimuthRad = ((hourOfDay - 13) / 12) * Math.PI * 0.75;

  // Dobowy przebieg pogody
  const diurnalWave = Math.sin(((hourOfDay - 8.5) / 24) * Math.PI * 2);
  const weatherDrift = smoothNoise(totalHours * 0.14, seeds.phaseOffset);
  const microGust = smoothNoise(totalHours * 1.1, seeds.phaseOffset + 4.1);

  let airTemp5m: number;
  let airHumidity5m: number;

  if (droughtMode) {
    // Ekstremalna susza i upał: temperatura powietrza 34°C – 42°C, wilgotność 15% – 25%
    const rawHeat = 38.0 + diurnalWave * 2.4 + weatherDrift * 1.2 + microGust * 0.45;
    airTemp5m = Math.max(34.0, Math.min(42.0, rawHeat));
    const rawDry = 20.0 - diurnalWave * 3.0 - weatherDrift * 1.4 + microGust * 0.9;
    airHumidity5m = Math.max(15.0, Math.min(25.0, rawDry));
  } else {
    // Normalne, bezpieczne dla lasu warunki
    const rawTemp =
      18.2 + seeds.tempBias + diurnalWave * 5.2 + weatherDrift * 1.8 + microGust * 0.4;
    airTemp5m = Math.max(9.0, Math.min(26.5, rawTemp));

    const rawHum =
      68 + seeds.humidityBias - diurnalWave * 14 + weatherDrift * 4.5 + microGust * 1.8;
    airHumidity5m = Math.max(44, Math.min(92, rawHum));
  }

  // Ciśnienie atmosferyczne
  const pressure5m =
    seeds.pressureBase +
    (droughtMode ? 6.5 : 0) +
    Math.sin(totalHours * 0.045 + seeds.phaseOffset) * 6.5 +
    Math.cos(totalHours * 0.14 + seeds.phaseOffset * 2) * 1.6;

  // Dane z bazy IMGW (regionalna stacja terenowa)
  const imgwTemp = airTemp5m + 0.8 + Math.sin(totalHours * 0.22 + 1.1) * 0.5;
  const imgwHumidity = Math.max(
    14,
    Math.min(95, airHumidity5m - 2.8 + Math.cos(totalHours * 0.19) * 1.5)
  );

  // Analiza stresu wodno-termicznego korzeni (czuła na suwaki 10cm i 60cm)
  const moistureWeighted = soil.soilMoisture10 * 0.45 + soil.soilMoisture60 * 0.55;
  const droughtStress =
    moistureWeighted < 44
      ? Math.min(1, Math.pow((44 - moistureWeighted) / 36, 1.25))
      : moistureWeighted > 95
        ? (moistureWeighted - 95) / 22
        : 0;

  const heat10Stress = soil.soilTemp10 > 22 ? Math.min(1, (soil.soilTemp10 - 22) / 16) : 0;
  const heat60Stress = soil.soilTemp60 > 18 ? Math.min(1, (soil.soilTemp60 - 18) / 14) : 0;
  const airHeatStress =
    airTemp5m > 29 && airHumidity5m < 38
      ? Math.min(0.45, ((airTemp5m - 29) / 13) * 0.45)
      : 0;

  const stressIndex = Math.max(
    0,
    Math.min(
      1,
      droughtStress * 0.54 +
        heat10Stress * 0.22 +
        heat60Stress * 0.24 +
        airHeatStress
    )
  );

  const transpirationEfficiency = Math.max(
    0.04,
    (1 - droughtStress * 0.88) *
      (1 - heat60Stress * 0.52) *
      (1 - heat10Stress * 0.25) *
      (0.25 + 0.75 * healthFactor)
  );

  // Temperatura kory nr 1 (nasłoneczniona) i nr 2 (zacieniona)
  const solarBarkBoost = solarIntensity * (6.8 + (1 - transpirationEfficiency) * 8.2);
  const coolingShade = transpirationEfficiency * 1.4;
  const barkTemp1Sunny = airTemp5m + solarBarkBoost + microGust * 0.25;
  const barkTemp2Shaded =
    airTemp5m + solarIntensity * 1.1 - coolingShade + microGust * 0.15;

  // Praca dendrometru (µm): zdrowe drzewo pęcznieje nocą i kurczy w dzień; stres tłumi amplitudę
  const diurnalDendroPhase = Math.cos(((hourOfDay - 4.5) / 24) * Math.PI * 2);
  const maxHealthyAmp = 64;
  const dendroAmplitudeUm = Math.max(
    1.2,
    maxHealthyAmp * transpirationEfficiency * (0.18 + 0.82 * healthFactor)
  );
  const baselineShrinkUm = -(1 - healthFactor) * 145 - droughtStress * 46;
  const dendroValueUm =
    baselineShrinkUm + diurnalDendroPhase * dendroAmplitudeUm + microGust * 1.0;

  // Prognoza AI na +1.5h na podstawie wyselekcjonowanych zmiennych objaśniających
  const futureHour = ((hourOfDay + 1.5) % 24 + 24) % 24;
  const futurePhase = Math.cos(((futureHour - 4.5) / 24) * Math.PI * 2);
  const predictedDendroUm =
    baselineShrinkUm +
    (droughtMode ? -6 : 0) +
    futurePhase * dendroAmplitudeUm;

  const trunkScaleDelta = Math.max(-0.045, Math.min(0.025, dendroValueUm * 0.00022));

  return {
    day,
    hourOfDay,
    sunElevation,
    sunAzimuthRad,
    solarIntensity,
    airTemp5m,
    airHumidity5m,
    pressure5m,
    imgwTemp,
    imgwHumidity,
    stressIndex,
    barkTemp1Sunny,
    barkTemp2Shaded,
    dendroValueUm,
    dendroAmplitudeUm,
    predictedDendroUm,
    trunkScaleDelta,
  };
}

function buildSample(
  totalHours: number,
  env: ReturnType<typeof computeEnvironmentAtHour>,
  soil: SoilControls
): ChannelSample {
  return {
    totalHours,
    day: env.day,
    hourOfDay: env.hourOfDay,
    dendrometr: Number(env.dendroValueUm.toFixed(1)),
    gleba10: Number(soil.soilMoisture10.toFixed(1)),
    gleba10Temp: Number(soil.soilTemp10.toFixed(1)),
    gleba60: Number(soil.soilMoisture60.toFixed(1)),
    gleba60Temp: Number(soil.soilTemp60.toFixed(1)),
    kora: Number(env.barkTemp1Sunny.toFixed(1)),
    koraShaded: Number(env.barkTemp2Shaded.toFixed(1)),
    meteo5m: Number(env.airTemp5m.toFixed(1)),
    meteo5mHumidity: Number(env.airHumidity5m.toFixed(1)),
    meteo5mPressure: Number(env.pressure5m.toFixed(0)),
    imgw: Number(env.imgwTemp.toFixed(1)),
    imgwHumidity: Number(env.imgwHumidity.toFixed(1)),
  };
}

function evaluateHealthState(
  health: number,
  stressIndex: number,
  beetleInfestation: boolean
): { treeState: TreeHealthState; statusReason: string } {
  if (health < 25) {
    return {
      treeState: 'FATALNY',
      statusReason: beetleInfestation
        ? 'Krytyczne zniszczenie łyka przez kornika drukarza i zamieranie korony.'
        : 'Skrajny deficyt wodny i przegrzanie systemu korzeniowego — śmierć drzewa.',
    };
  }
  if (health < 65 || beetleInfestation || stressIndex >= 0.52) {
    if (beetleInfestation) {
      return {
        treeState: 'ZŁY',
        statusReason: 'Inwazja kornika drukarza (>72h stresu)! Gwałtowne zamieranie pnia.',
      };
    }
    if (stressIndex >= 0.42) {
      return {
        treeState: 'ZŁY',
        statusReason:
          'Stres wodno-termiczny korzeni: spadek amplitudy dendrometru i żółknięcie igliwia.',
      };
    }
    return {
      treeState: 'ZŁY',
      statusReason:
        'Osłabiona kondycja igliwia po okresie stresu — trwa powolna regeneracja.',
    };
  }
  return {
    treeState: 'DOBRY',
    statusReason: 'Prawidłowa transpiracja i pełna dobowa praca dendrometru.',
  };
}

export function createInitialTelemetryState(
  soil: SoilControls,
  seeds: WeatherSeeds
): TelemetryState {
  const startTotalHours = 10.0;
  const history: ChannelSample[] = [];

  // Wstępne 24 godziny danych co 0.25h (96 próbek) dla tablic 3D i wykresów AI
  for (let i = 96; i >= 0; i--) {
    const h = startTotalHours - i * 0.25;
    const env = computeEnvironmentAtHour(h, soil, seeds, 0.96, false);
    history.push(buildSample(h, env, soil));
  }

  const current = computeEnvironmentAtHour(startTotalHours, soil, seeds, 0.96, false);

  return {
    totalHours: startTotalHours,
    day: current.day,
    hourOfDay: current.hourOfDay,
    droughtMode: false,
    sunElevation: current.sunElevation,
    sunAzimuthRad: current.sunAzimuthRad,
    solarIntensity: current.solarIntensity,
    airTemp5m: current.airTemp5m,
    airHumidity5m: current.airHumidity5m,
    pressure5m: current.pressure5m,
    imgwTemp: current.imgwTemp,
    imgwHumidity: current.imgwHumidity,
    barkTemp1Sunny: current.barkTemp1Sunny,
    barkTemp2Shaded: current.barkTemp2Shaded,
    dendroValueUm: current.dendroValueUm,
    dendroAmplitudeUm: current.dendroAmplitudeUm,
    predictedDendroUm: current.predictedDendroUm,
    trunkScaleDelta: current.trunkScaleDelta,
    health: 96,
    stressIndex: current.stressIndex,
    stressHours: 0,
    beetleInfestation: false,
    beetleIntensity: 0,
    treeState: 'DOBRY',
    statusReason: 'Prawidłowa transpiracja i pełna dobowa praca dendrometru.',
    history,
  };
}

/**
 * Natychmiastowa reakcja biologiczna przy ręcznym przesunięciu suwaków gleby przez użytkownika
 */
export function applySoilControlsChange(
  prev: TelemetryState,
  soil: SoilControls,
  seeds: WeatherSeeds
): TelemetryState {
  // Natychmiastowe przeliczenie bieżącej kondycji docelowej przy zmianie gleby
  const probeEnv = computeEnvironmentAtHour(
    prev.totalHours,
    soil,
    seeds,
    prev.health / 100,
    prev.droughtMode
  );

  // Jeśli użytkownik ustawia ekstremalnie złe parametry gleby, kondycja reaguje od razu wyraźnym przesunięciem
  const targetEquilibriumHealth = Math.max(15, Math.min(98, 98 - probeEnv.stressIndex * 74));
  const blendedHealth =
    probeEnv.stressIndex >= 0.45
      ? Math.min(prev.health, prev.health * 0.65 + targetEquilibriumHealth * 0.35)
      : prev.health * 0.8 + targetEquilibriumHealth * 0.2;

  const nextHealth = Math.max(0, Math.min(100, blendedHealth));
  const env = computeEnvironmentAtHour(
    prev.totalHours,
    soil,
    seeds,
    nextHealth / 100,
    prev.droughtMode
  );
  const { treeState, statusReason } = evaluateHealthState(
    nextHealth,
    env.stressIndex,
    prev.beetleInfestation
  );

  const updatedLast = buildSample(prev.totalHours, env, soil);
  const nextHistory =
    prev.history.length > 0
      ? [...prev.history.slice(0, -1), updatedLast]
      : [updatedLast];

  return {
    ...prev,
    airTemp5m: env.airTemp5m,
    airHumidity5m: env.airHumidity5m,
    pressure5m: env.pressure5m,
    imgwTemp: env.imgwTemp,
    imgwHumidity: env.imgwHumidity,
    barkTemp1Sunny: env.barkTemp1Sunny,
    barkTemp2Shaded: env.barkTemp2Shaded,
    dendroValueUm: env.dendroValueUm,
    dendroAmplitudeUm: env.dendroAmplitudeUm,
    predictedDendroUm: env.predictedDendroUm,
    trunkScaleDelta: env.trunkScaleDelta,
    health: nextHealth,
    stressIndex: env.stressIndex,
    treeState,
    statusReason,
    history: nextHistory,
  };
}

export function stepSimulation(
  prev: TelemetryState,
  dtHours: number,
  soil: SoilControls,
  seeds: WeatherSeeds
): { telemetry: TelemetryState; nextSoil: SoilControls } {
  const safeDt = Math.max(0, Math.min(2.0, dtHours));
  const nextTotalHours = prev.totalHours + safeDt;

  // W trybie SUSZA wilgotność gleby samoczynnie spada z każdą godziną symulacji
  let nextSoil = soil;
  if (prev.droughtMode && safeDt > 0) {
    nextSoil = {
      soilTemp10: Math.min(45, soil.soilTemp10 + safeDt * 0.38),
      soilTemp60: Math.min(40, soil.soilTemp60 + safeDt * 0.24),
      soilMoisture10: Math.max(0, soil.soilMoisture10 - safeDt * 1.9),
      soilMoisture60: Math.max(0, soil.soilMoisture60 - safeDt * 1.25),
    };
  }

  const healthFactor = prev.health / 100;
  const env = computeEnvironmentAtHour(
    nextTotalHours,
    nextSoil,
    seeds,
    healthFactor,
    prev.droughtMode
  );

  const isUnfavorable = env.stressIndex >= 0.42;
  let nextStressHours = prev.stressHours;

  if (isUnfavorable) {
    nextStressHours += safeDt;
  } else if (env.stressIndex < 0.28 && prev.health > 20) {
    nextStressHours = Math.max(0, nextStressHours - safeDt * 0.65);
  }

  const beetleInfestation = prev.beetleInfestation
    ? prev.health > 2 && (nextStressHours >= 36 || prev.health < 45)
    : nextStressHours >= 72.0;

  const beetleIntensity = beetleInfestation
    ? Math.min(1, prev.beetleIntensity + safeDt * 0.25)
    : Math.max(0, prev.beetleIntensity - safeDt * 0.35);

  let nextHealth = prev.health;
  if (isUnfavorable) {
    const stressDrain = (0.5 + env.stressIndex * 1.5) * safeDt;
    const beetleDrain = beetleInfestation ? 3.8 * safeDt : 0;
    nextHealth -= stressDrain + beetleDrain;
  } else if (beetleInfestation) {
    nextHealth -= 2.1 * safeDt;
  } else if (env.stressIndex < 0.25 && prev.health > 15) {
    nextHealth += 0.85 * safeDt;
  }
  nextHealth = Math.max(0, Math.min(100, nextHealth));

  const { treeState, statusReason } = evaluateHealthState(
    nextHealth,
    env.stressIndex,
    beetleInfestation
  );

  const lastSample = prev.history[prev.history.length - 1];
  let nextHistory = prev.history;
  if (!lastSample || nextTotalHours - lastSample.totalHours >= 0.25) {
    const sample = buildSample(nextTotalHours, env, nextSoil);
    nextHistory = [...prev.history.slice(-95), sample]; // ~24h @ 0.25h
  }

  return {
    nextSoil,
    telemetry: {
      totalHours: nextTotalHours,
      day: env.day,
      hourOfDay: env.hourOfDay,
      droughtMode: prev.droughtMode,
      sunElevation: env.sunElevation,
      sunAzimuthRad: env.sunAzimuthRad,
      solarIntensity: env.solarIntensity,
      airTemp5m: env.airTemp5m,
      airHumidity5m: env.airHumidity5m,
      pressure5m: env.pressure5m,
      imgwTemp: env.imgwTemp,
      imgwHumidity: env.imgwHumidity,
      barkTemp1Sunny: env.barkTemp1Sunny,
      barkTemp2Shaded: env.barkTemp2Shaded,
      dendroValueUm: env.dendroValueUm,
      dendroAmplitudeUm: env.dendroAmplitudeUm,
      predictedDendroUm: env.predictedDendroUm,
      trunkScaleDelta: env.trunkScaleDelta,
      health: nextHealth,
      stressIndex: env.stressIndex,
      stressHours: nextStressHours,
      beetleInfestation,
      beetleIntensity,
      treeState,
      statusReason,
      history: nextHistory,
    },
  };
}
