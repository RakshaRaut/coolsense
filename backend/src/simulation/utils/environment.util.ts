import { InsulationLevel } from '../dto/simulation.dto.js';

// Multiplier on the device's thermalConductanceKwPerC (taken as an average envelope): the UI model's U-values 4.2/2.6/1.5/0.9 W/m²K relative to average.
export const INSULATION_CONDUCTANCE_FACTOR: Record<InsulationLevel, number> = {
  [InsulationLevel.POOR]: 1.6,
  [InsulationLevel.AVERAGE]: 1,
  [InsulationLevel.GOOD]: 0.6,
  [InsulationLevel.EXCELLENT]: 0.35,
};

// Sensible heat given off by one seated occupant, in kW.
export const OCCUPANT_HEAT_KW = 0.1;

// Solar gain through glazing at windowExposure = 1, in kW (the UI model's 380 W).
export const FULL_WINDOW_SOLAR_GAIN_KW = 0.38;
