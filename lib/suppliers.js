/**
 * Supplier Configuration
 * List of all Tajalli suppliers/locations
 */

export const suppliers = [
  'Tajalli Guar city',
  'Tajalli mall of India',
  'Tajalli Logix mall',
  'Tajalli PKS mall',
  'Tajalli GIP mall',
  'Tajalli Mahagun mall',
  'Tajalli Govindpuram',
  'Tajalli Avantika',
  'Tajalli unity one mall',
  'Tajalli Vikaspuri',
  'Tajalli Najafgarh',
  'Tajalli Pacific 21',
  'Tajalli Jharsa Rd',
  'Tajalli VSR mall',
  'Tajalli M3M Urbana',
  'Tajalli 83 Avenue',
  'Tajalli Elante mall',
  'Tajalli Elante SB',
  'Tajalli sec 9',
  'Tajalli Zirakpur',
  'Tajalli MBD mall',
  'Tajalli MBD SB',
  'Tajalli Relaince mall',
  'Tajalli Kashmir Avenue',
  'Tajalli Alpha mall',
  'Tajalli Pacific Rajpur Rd',
  'Tajalli MOD',
  'Tajalli GMS RD',
  'Tajalli Jogiwala',
  'Tajalli Haldwani'
];

/**
 * Get supplier names as an array
 */
export const getSupplierNames = () => {
  return suppliers;
};

/**
 * Check if a supplier exists
 */
export const isValidSupplier = (name) => {
  return suppliers.some(supplier => supplier.toLowerCase() === name.toLowerCase());
};

