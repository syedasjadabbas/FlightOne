export interface CompanyInfo {
  name: string;
  legalName: string;
  tagline: string;
  mission: string;
  address: {
    street: string;
    area: string;
    city: string;
    country: string;
    fullFormatted: string;
    mapsUrl: string;
  };
  contact: {
    phone: string;
    displayPhone: string;
    whatsappNumber: string;
    whatsappUrl: string;
    email: string;
    supportEmail: string;
  };
  hours: {
    weekdays: string;
    sunday: string;
  };
  social: {
    instagram: string;
  };
}

export const COMPANY_INFO: CompanyInfo = {
  name: 'FlightOne',
  legalName: 'FlightOne Travel Services',
  tagline: 'Custom Tour Packages Around the World, Designed Around You',
  mission: 'FlightOne designs custom international tour packages globally with transparent pricing, visa support and a complete itinerary within 24 hours.',
  address: {
    street: '71 C3, Facing Qarshi Park',
    area: 'Gulberg III',
    city: 'Lahore',
    country: 'Pakistan',
    fullFormatted: '71 C3, Facing Qarshi Park, Gulberg III, Lahore, Pakistan',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=71+C3+Facing+Qarshi+Park+Gulberg+III+Lahore+Pakistan'
  },
  contact: {
    phone: '+923277770170',
    displayPhone: '+92 3277770170',
    whatsappNumber: '+923277770170',
    whatsappUrl: 'https://wa.me/923277770170?text=Hi%20FlightOne%2C%20I%20would%20like%20to%20plan%20a%20custom%20tour%20package.',
    email: 'info@flightone.co',
    supportEmail: 'info@flightone.co'
  },
  hours: {
    weekdays: 'Mon – Sat: 10:00 AM – 7:00 PM (PKT)',
    sunday: 'Closed'
  },
  social: {
    instagram: 'https://www.instagram.com/flightone?igsh=Y2Q2NGthbHRsN29o'
  }
};
