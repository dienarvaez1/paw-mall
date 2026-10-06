// DENUE bulk files per state, shared by the places importer and the search areas builder.

/**
 * The states of docs/PLAN.md, by INEGI code: the original six plus Guerrero, Michoacán and
 * Querétaro, which the 100-mile radius reaches (owner's decision, 2026-10-05). Large states come
 * split into several files.
 */
export const STATE_FILES: Record<string, string[]> = {
  '09': ['denue_09_csv.zip'], // Ciudad de México
  '12': ['denue_12_csv.zip'], // Guerrero
  '13': ['denue_13_csv.zip'], // Hidalgo
  '15': ['denue_15_1_csv.zip', 'denue_15_2_csv.zip'], // Estado de México
  '16': ['denue_16_csv.zip'], // Michoacán
  '17': ['denue_17_csv.zip'], // Morelos
  '21': ['denue_21_csv.zip'], // Puebla
  '22': ['denue_22_csv.zip'], // Querétaro
  '29': ['denue_29_csv.zip'], // Tlaxcala
};
