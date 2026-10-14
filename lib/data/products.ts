import { Product, Category } from '@/lib/types';

/**
 * Sample product data
 * In production, this would come from a database
 */
export const products: Product[] = [
  {
    id: 'motor-mount-l298n',
    name: 'L298N Motor Driver Mount',
    description: 'Custom mounting bracket for L298N motor driver module',
    longDescription: 'Precision-designed mounting bracket for L298N H-bridge motor driver. Features secure snap-fit design, mounting holes for M3 screws, and wire management channels.',
    price: 150,
    category: 'robotics',
    images: ['/products/motor-mount-placeholder.jpg'],
    inStock: true,
    featured: true,
    specifications: {
      'Material': 'PLA',
      'Dimensions': '65mm x 45mm x 12mm',
      'Color': 'Black',
      'Layer Height': '0.2mm',
      'Infill': '20%',
    },
    tags: ['robotics', 'motor', 'electronics', 'arduino'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'servo-bracket-sg90',
    name: 'SG90 Servo Bracket',
    description: 'Universal mounting bracket for SG90 micro servo motors',
    longDescription: 'Robust mounting solution for SG90 servo motors. Compatible with standard robotics frames. Includes reinforced mounting points.',
    price: 100,
    category: 'robotics',
    images: ['/products/servo-bracket-placeholder.jpg'],
    inStock: true,
    featured: true,
    specifications: {
      'Material': 'PETG',
      'Dimensions': '40mm x 25mm x 15mm',
      'Color': 'Blue',
      'Compatible With': 'SG90, MG90S',
    },
    tags: ['robotics', 'servo', 'mounting'],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'arduino-case-uno',
    name: 'Arduino Uno Enclosure',
    description: 'Protective case for Arduino Uno with ventilation',
    longDescription: 'Professional enclosure for Arduino Uno R3. Features snap-fit design, ventilation slots, and cutouts for all ports and pins.',
    price: 200,
    category: 'electronics',
    images: ['/products/arduino-case-placeholder.jpg'],
    inStock: true,
    featured: false,
    specifications: {
      'Material': 'ABS',
      'Dimensions': '75mm x 60mm x 25mm',
      'Color': 'Black/Transparent',
      'Mounting': 'Wall mount ready',
    },
    tags: ['electronics', 'arduino', 'enclosure', 'protection'],
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-05T10:00:00Z',
  },
  {
    id: 'cable-organizer',
    name: 'Desktop Cable Organizer',
    description: 'Multi-slot cable management solution',
    longDescription: 'Keep your workspace tidy with this elegant cable organizer. Features 5 slots for different cable sizes and adhesive base.',
    price: 120,
    category: 'organization',
    images: ['/products/cable-organizer-placeholder.jpg'],
    inStock: true,
    featured: false,
    specifications: {
      'Material': 'PLA',
      'Dimensions': '100mm x 50mm x 30mm',
      'Slots': '5',
      'Base': 'Adhesive or screw mount',
    },
    tags: ['organization', 'cable management', 'desk'],
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'sensor-mount-hcsr04',
    name: 'HC-SR04 Ultrasonic Sensor Mount',
    description: 'Adjustable mount for HC-SR04 ultrasonic distance sensor',
    longDescription: 'Versatile mounting solution with adjustable angle. Perfect for robotics projects requiring distance sensing.',
    price: 80,
    category: 'robotics',
    images: ['/products/sensor-mount-placeholder.jpg'],
    inStock: true,
    featured: false,
    specifications: {
      'Material': 'PETG',
      'Angle Range': '0-90 degrees',
      'Mounting': 'M3 screws',
      'Compatible Sensors': 'HC-SR04, US-100',
    },
    tags: ['robotics', 'sensor', 'ultrasonic', 'mounting'],
    createdAt: '2024-01-12T10:00:00Z',
    updatedAt: '2024-01-12T10:00:00Z',
  },
  {
    id: 'raspi-case',
    name: 'Raspberry Pi 4 Case',
    description: 'Ventilated case for Raspberry Pi 4 Model B',
    longDescription: 'Premium case designed for optimal cooling. Features easy access to all ports, GPIO header access, and professional finish.',
    price: 250,
    category: 'electronics',
    images: ['/products/raspi-case-placeholder.jpg'],
    inStock: true,
    featured: true,
    specifications: {
      'Material': 'ABS',
      'Dimensions': '95mm x 70mm x 30mm',
      'Cooling': 'Passive ventilation',
      'Colors Available': 'Black, White, Red',
    },
    tags: ['electronics', 'raspberry pi', 'enclosure', 'cooling'],
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2024-01-08T10:00:00Z',
  },
];

export const categories: Category[] = [
  {
    id: 'robotics',
    name: 'Robotics',
    slug: 'robotics',
    description: 'Motor mounts, servo brackets, and robotics components',
    productCount: products.filter(p => p.category === 'robotics').length,
  },
  {
    id: 'electronics',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Arduino cases, sensor mounts, and electronic enclosures',
    productCount: products.filter(p => p.category === 'electronics').length,
  },
  {
    id: 'organization',
    name: 'Organization',
    slug: 'organization',
    description: 'Cable management and desktop organizers',
    productCount: products.filter(p => p.category === 'organization').length,
  },
  {
    id: 'prototyping',
    name: 'Prototyping',
    slug: 'prototyping',
    description: 'Custom prototype parts and test fixtures',
    productCount: products.filter(p => p.category === 'prototyping').length,
  },
];

// Helper functions
export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function getFeaturedProducts(): Product[] {
  return products.filter(p => p.featured);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter(p => p.category === category);
}

export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getAllCategories(): Category[] {
  return categories;
}
