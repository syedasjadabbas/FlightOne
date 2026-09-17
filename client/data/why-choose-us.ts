export interface FeaturePillar {
  id: string;
  title: string;
  description: string;
  metric?: string;
  metricLabel?: string;
}

export const VALUE_PROPOSITIONS: FeaturePillar[] = [
  {
    id: 'turnaround',
    title: 'Your itinerary in 24 hours',
    description: 'Most agencies take several days to respond with a real quote. We commit to a complete day-by-day plan with hotel names and final pricing within one day of your request.',
    metric: '24h',
    metricLabel: 'Itinerary turnaround'
  },
  {
    id: 'transparent-pricing',
    title: 'Transparent pricing, always in writing',
    description: 'Every quote lists exactly what is included and what is not. The number you approve is the number you pay, with no surprises at checkout.',
    metric: '100%',
    metricLabel: 'Price transparency'
  },
  {
    id: 'comfort-tiers',
    title: 'Three comfort tiers on every route',
    description: 'We can quote the same trip at 3-star, 4-star and 5-star levels so you can compare directly and decide where the extra cost genuinely improves the experience.',
    metric: '3',
    metricLabel: 'Hotel comfort tiers'
  },
  {
    id: 'visa-support',
    title: 'Visa support built in',
    description: 'We prepare and submit your complete visa file for every destination we serve, and we tell you honestly if your profile has a weak point before you spend money on bookings.',
    metric: '9',
    metricLabel: 'Global destinations'
  }
];

export interface ProcessStep {
  stepNumber: number;
  title: string;
  description: string;
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    stepNumber: 1,
    title: 'Step 1: Tell us about your trip',
    description: 'Send your destination, travel dates, number of travellers and preferred hotel tier through WhatsApp or our online form. This takes about two minutes.'
  },
  {
    stepNumber: 2,
    title: 'Step 2: We design your itinerary',
    description: 'A dedicated travel designer puts together your flights, hotel options, daily activities and transfers, and prices the entire trip transparently. You receive the complete plan within 24 hours.'
  },
  {
    stepNumber: 3,
    title: 'Step 3: You travel with everything handled',
    description: 'Once you approve your itinerary, we prepare your visa documentation, confirm every booking, and stay reachable on WhatsApp throughout your trip. There is one point of contact from your first inquiry to your flight home.'
  }
];
