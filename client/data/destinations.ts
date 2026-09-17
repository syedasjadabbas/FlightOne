export interface Destination {
  id: string;
  name: string;
  country: string;
  startingPricePKR: number;
  formattedPrice: string;
  visaPolicy: string;
  bestFor: string;
  image: string;
  highlights: string[];
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'Maldives',
    startingPricePKR: 385000,
    formattedPrice: 'PKR 385,000',
    visaPolicy: 'Free visa on arrival',
    bestFor: 'Honeymoons, beach rest',
    image: '/images/destinations/maldives.jpg',
    highlights: ['Overwater Villas', 'Private Island Resorts', 'Coral Reef Snorkeling', 'Seaplane Transfers']
  },
  {
    id: 'sri-lanka',
    name: 'Sri Lanka',
    country: 'Sri Lanka',
    startingPricePKR: 265000,
    formattedPrice: 'PKR 265,000',
    visaPolicy: 'Free ETA (since May 2026)',
    bestFor: 'Value, scenery, tea country',
    image: '/images/destinations/sri-lanka.jpg',
    highlights: ['Ella Scenic Train', 'Sigiriya Rock Fortress', 'Tea Plantations in Nuwara Eliya', 'Galle Coastal Fort']
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    startingPricePKR: 245000,
    formattedPrice: 'PKR 245,000',
    visaPolicy: 'Pre-approved e-visa',
    bestFor: 'First international trip',
    image: '/images/destinations/dubai.jpg',
    highlights: ['Burj Khalifa & Downtown', 'Desert 4x4 Safari with BBQ', 'Palm Jumeirah Luxury Resorts', 'Dubai Marina Cruise']
  },
  {
    id: 'malaysia',
    name: 'Malaysia',
    country: 'Malaysia',
    startingPricePKR: 295000,
    formattedPrice: 'PKR 295,000',
    visaPolicy: 'Online eVisa',
    bestFor: 'Families, budget variety',
    image: '/images/destinations/malaysia.jpg',
    highlights: ['Petronas Twin Towers', 'Genting Highlands Cable Car', 'Batu Caves Exploration', 'Langkawi Island Beaches']
  },
  {
    id: 'thailand',
    name: 'Thailand',
    country: 'Thailand',
    startingPricePKR: 325000,
    formattedPrice: 'PKR 325,000',
    visaPolicy: 'Mandatory e-Visa',
    bestFor: 'Beaches plus city life',
    image: '/images/destinations/thailand.jpg',
    highlights: ['Bangkok Wat Arun & Grand Palace', 'Phuket & Phi Phi Island Speedboat', 'Krabi Limestone Cliffs', 'Floating Markets']
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    startingPricePKR: 350000,
    formattedPrice: 'PKR 350,000',
    visaPolicy: 'Authorised-agent visa',
    bestFor: 'Families, city breaks',
    image: '/images/destinations/singapore.jpg',
    highlights: ['Marina Bay Sands SkyPark', 'Gardens by the Bay Supertrees', 'Universal Studios Singapore', 'Sentosa Island Cable Car']
  },
  {
    id: 'turkey',
    name: 'Turkey',
    country: 'Turkey',
    startingPricePKR: 450000,
    formattedPrice: 'PKR 450,000',
    visaPolicy: 'e-Visa or sticker visa',
    bestFor: 'Culture, honeymoons',
    image: '/images/destinations/turkey.jpg',
    highlights: ['Cappadocia Sunrise Hot Air Balloon', 'Hagia Sophia & Bosphorus Yacht Cruise', 'Pamukkale Thermal Terraces', 'Antalya Coastal Ruins']
  },
  {
    id: 'morocco',
    name: 'Morocco',
    country: 'Morocco',
    startingPricePKR: 385000,
    formattedPrice: 'PKR 385,000',
    visaPolicy: 'Embassy sticker visa',
    bestFor: 'Culture, desert experiences',
    image: '/images/destinations/malaysia.jpg',
    highlights: ['Sahara Desert Glamping & Camel Trek', 'Marrakech Medina & Jardin Majorelle', 'Chefchaouen Blue Pearl City', 'Fes Cultural Riads']
  },
  {
    id: 'egypt',
    name: 'Egypt (Nile Cruise)',
    country: 'Egypt',
    startingPricePKR: 350000,
    formattedPrice: 'PKR 350,000',
    visaPolicy: 'Embassy visa',
    bestFor: 'History, Nile cruising',
    image: '/images/destinations/dubai.jpg',
    highlights: ['Great Pyramids of Giza & Sphinx', '5-Star Nile Luxury River Cruise', 'Valley of the Kings in Luxor', 'Aswan Abu Simbel Temples']
  }
];
