export interface CustomerReview {
  id: string;
  author: string;
  timeAgo: string;
  destination: string;
  quote: string;
  rating: number;
}

export const REVIEWS: CustomerReview[] = [
  {
    id: 'ahmed-raza',
    author: 'Ahmed Raza',
    timeAgo: '2 Weeks Ago',
    destination: 'Turkey Custom Trip',
    quote: "Planned our Turkey trip through FlightOne and honestly it was so easy. Sent them our dates on WhatsApp and had the full itinerary with hotel names and pricing the next day. The Cappadocia balloon ride was booked in advance so we didn't have to worry about it selling out. Highly recommend if you don't want to deal with a generic package.",
    rating: 5
  },
  {
    id: 'sana-khalid',
    author: 'Sana Khalid',
    timeAgo: '1 Month Ago',
    destination: 'Maldives Honeymoon',
    quote: "We did our honeymoon in the Maldives with FlightOne, and it went beyond what we expected. They were very clear about pricing from the start, no hidden charges like some other agencies. Visa on arrival was smooth and our transfer was waiting right when we landed. Will book with them again for sure.",
    rating: 5
  },
  {
    id: 'bilal-ahmed',
    author: 'Bilal Ahmed',
    timeAgo: '3 Weeks Ago',
    destination: 'Dubai Family Trip',
    quote: "Good experience overall for our Dubai family trip. Visa took a couple days longer than expected but they kept us updated the whole time so it wasn't stressful. Kids loved the desert safari, hotel was exactly as described. Would use them again.",
    rating: 5
  },
  {
    id: 'fatima-malik',
    author: 'Fatima Malik',
    timeAgo: '2 Months Ago',
    destination: 'Thailand Group Trip (12 Pax)',
    quote: "Booked a group trip to Thailand for 12 of us and FlightOne handled everything, flights, hotel, visas, even the island tour. One invoice for the whole group which made splitting cost so much easier. Our coordinator was always available on WhatsApp whenever we had questions.",
    rating: 5
  },
  {
    id: 'usman-tariq',
    author: 'Usman Tariq',
    timeAgo: '1 Week Ago',
    destination: 'Malaysia First-Time Solo',
    quote: "First time travelling abroad and I was honestly a bit nervous about the visa process for Malaysia. FlightOne explained everything clearly and handled the eVisa and arrival card for us. Trip went without a single issue. Good communication throughout.",
    rating: 5
  }
];
