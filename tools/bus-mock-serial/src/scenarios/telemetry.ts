// tools/bus-mock-serial/src/scenarios/telemetry.ts

import type { ScenarioConfig } from './types.js'

export const telemetryScenario: ScenarioConfig = {
  name: 'telemetry',
  description: '火箭遥测模拟',
  interval: 100,
  format: 'json',
  fields: [
    { key: 'altitude', base: 0, range: [0, 10000], noise: 1.0, drift: 0.5 },
    { key: 'velocity', base: 0, range: [0, 500], noise: 2.0 },
    { key: 'temperature', base: 25, range: [-40, 80], noise: 0.1 },
    { key: 'pressure', base: 101325, range: [0, 101325], noise: 10 },
    { key: 'gps_lat', base: 39.9, noise: 0.0001 },
    { key: 'gps_lon', base: 116.4, noise: 0.0001 },
    { key: 'battery', base: 100, range: [0, 100], drift: -0.01 },
  ]
}