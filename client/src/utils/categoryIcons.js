const CATEGORY_ICON_NAMES = {
  Grocery: 'shopping-cart',
  Food: 'utensils',
  'Non-Primary Expenses': 'shopping-bag',
  'Other Expenses': 'box',
  Entertainment: 'gamepad',
  Education: 'book',
  Subscription: 'refresh',
  Transport: 'car',
  Rent: 'home',
  Utilities: 'lightbulb',
  'Health/Medical': 'health',
  Phone: 'wallet',
  Insurance: 'shield',
  Medicine: 'stethoscope',
  'Savings/Investment': 'piggy-bank',
  Others: 'pin',
};

export function getCategoryIconName(category) {
  return CATEGORY_ICON_NAMES[category] || 'folder';
}
