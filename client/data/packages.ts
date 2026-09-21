export interface TravelStyle {
  id: string;
  category: string;
  badge: string;
  title: string;
  description: string;
  ctaText: string;
  link: string;
}

export const TRAVEL_STYLES: TravelStyle[] = [
  {
    id: 'honeymoon',
    category: 'Romantic',
    badge: 'Romantic',
    title: 'Honeymoon Packages',
    description: 'Overwater villas in the Maldives, cave suites in Cappadocia, and private dinners arranged around your dates, not a group schedule.',
    ctaText: 'See honeymoon packages globally',
    link: '/honeymoon-packages'
  },
  {
    id: 'family',
    category: 'Family',
    badge: 'Family',
    title: 'Family Holidays',
    description: 'Connecting rooms, kid-friendly resorts, and flight times that actually work for children.',
    ctaText: 'See family holiday packages',
    link: '/family-holidays'
  },
  {
    id: 'groups',
    category: 'Groups',
    badge: 'Groups',
    title: 'Group And Corporate Trips',
    description: 'Retreats, incentive travel, and friend-group getaways with group airfare and one consolidated invoice (10+ travellers).',
    ctaText: 'See group tour packages',
    link: '/group-tours'
  },
  {
    id: 'e-sim',
    category: 'Add-On',
    badge: 'Add-On',
    title: 'E-SIM Add-Ons',
    description: 'Every trip can include a ready-to-activate e-SIM, so you land connected instead of queuing at the airport counter.',
    ctaText: 'See travel e-SIMs',
    link: '/e-sim'
  },
  {
    id: 'visa',
    category: 'Service',
    badge: 'Service',
    title: 'Visa Assistance Services',
    description: 'Complete visa file preparation, embassy appointment scheduling, and transparent profile evaluation for guaranteed peace of mind.',
    ctaText: 'See visa assistance services',
    link: '/visa-assistance'
  }
];
