// DENUE bulk files per state, shared by the places importer and the search areas builder.

/**
 * Every state of Mexico, by INEGI code (all of Mexico since Phase 10, owner's decision,
 * 2026-10-11). Estado de México comes split into two files.
 */
export const STATE_FILES: Record<string, string[]> = {
  '01': ['denue_01_csv.zip'], // Aguascalientes
  '02': ['denue_02_csv.zip'], // Baja California
  '03': ['denue_03_csv.zip'], // Baja California Sur
  '04': ['denue_04_csv.zip'], // Campeche
  '05': ['denue_05_csv.zip'], // Coahuila
  '06': ['denue_06_csv.zip'], // Colima
  '07': ['denue_07_csv.zip'], // Chiapas
  '08': ['denue_08_csv.zip'], // Chihuahua
  '09': ['denue_09_csv.zip'], // Ciudad de México
  '10': ['denue_10_csv.zip'], // Durango
  '11': ['denue_11_csv.zip'], // Guanajuato
  '12': ['denue_12_csv.zip'], // Guerrero
  '13': ['denue_13_csv.zip'], // Hidalgo
  '14': ['denue_14_csv.zip'], // Jalisco
  '15': ['denue_15_1_csv.zip', 'denue_15_2_csv.zip'], // Estado de México
  '16': ['denue_16_csv.zip'], // Michoacán
  '17': ['denue_17_csv.zip'], // Morelos
  '18': ['denue_18_csv.zip'], // Nayarit
  '19': ['denue_19_csv.zip'], // Nuevo León
  '20': ['denue_20_csv.zip'], // Oaxaca
  '21': ['denue_21_csv.zip'], // Puebla
  '22': ['denue_22_csv.zip'], // Querétaro
  '23': ['denue_23_csv.zip'], // Quintana Roo
  '24': ['denue_24_csv.zip'], // San Luis Potosí
  '25': ['denue_25_csv.zip'], // Sinaloa
  '26': ['denue_26_csv.zip'], // Sonora
  '27': ['denue_27_csv.zip'], // Tabasco
  '28': ['denue_28_csv.zip'], // Tamaulipas
  '29': ['denue_29_csv.zip'], // Tlaxcala
  '30': ['denue_30_csv.zip'], // Veracruz
  '31': ['denue_31_csv.zip'], // Yucatán
  '32': ['denue_32_csv.zip'], // Zacatecas
};
