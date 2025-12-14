/**
 * Category Configuration
 * Contains predefined categories with their associated image paths
 */

export const categories = [
  {
    name: 'almonds',
    image: '/assets/category_images/almonds_1.webp'
  },
  {
    name: 'cashew',
    image: '/assets/category_images/cashew_1.png'
  },
  {
    name: 'pista',
    image: '/assets/category_images/pista.png'
  },
  {
    name: 'raisins',
    image: '/assets/category_images/raisins.webp'
  },
  {
    name: 'berry',
    image: '/assets/category_images/berry.png'
  },
  {
    name: 'figs',
    image: '/assets/category_images/figs.png'
  },
  {
    name: 'dates',
    image: '/assets/category_images/dates_1.png'
  },
  {
    name: 'nuts',
    image: '/assets/category_images/nuts.webp'
  },
  {
    name: 'walnuts',
    image: '/assets/category_images/walnuts_1.webp'
  },
  {
    name: 'Apricot',
    image: '/assets/category_images/Apricot.png'
  },
  {
    name: 'fruit',
    image: '/assets/category_images/fruit.webp'
  },
  {
    name: 'mixtures',
    image: '/assets/category_images/mixtures.webp'
  },
  {
    name: 'seeds',
    image: '/assets/category_images/seeds.webp'
  },
  {
    name: 'special item',
    image: '/assets/category_images/special item.png'
  }
];

/**
 * Get category names as an array
 */
export const getCategoryNames = () => {
  return categories.map(cat => cat.name);
};

/**
 * Get category by name
 */
export const getCategoryByName = (name) => {
  return categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
};

/**
 * Get category image path by name
 */
export const getCategoryImage = (name) => {
  const category = getCategoryByName(name);
  return category ? category.image : '/assets/category_images/default.jpg';
};

/**
 * Check if a category exists
 */
export const isValidCategory = (name) => {
  return categories.some(cat => cat.name.toLowerCase() === name.toLowerCase());
};

