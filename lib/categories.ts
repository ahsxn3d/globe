/** Category ("schools in Lahore", "hospitals near me") detection shared by client and server. */
export type Category = { id: string; label: string; words: string[]; tags: string[] };

// tags are Overpass filters, e.g. `["amenity"="school"]`
export const CATEGORIES: Category[] = [
  { id: "education", label: "schools & colleges", words: ["education", "educational", "educational institutes", "institutes", "institute", "academy", "academies"], tags: ['["amenity"~"^(school|college|university|kindergarten|language_school|training)$"]'] },
  { id: "school", label: "Schools", words: ["school", "schools", "high school", "primary school"], tags: ['["amenity"="school"]'] },
  { id: "university", label: "Universities", words: ["university", "universities", "uni", "campus"], tags: ['["amenity"="university"]'] },
  { id: "college", label: "Colleges", words: ["college", "colleges"], tags: ['["amenity"="college"]'] },
  { id: "kindergarten", label: "Kindergartens", words: ["kindergarten", "kindergartens", "nursery", "preschool", "montessori"], tags: ['["amenity"="kindergarten"]'] },
  { id: "library", label: "Libraries", words: ["library", "libraries"], tags: ['["amenity"="library"]'] },
  { id: "hospital", label: "Hospitals", words: ["hospital", "hospitals"], tags: ['["amenity"="hospital"]'] },
  { id: "clinic", label: "Clinics", words: ["clinic", "clinics", "doctor", "doctors"], tags: ['["amenity"~"^(clinic|doctors)$"]'] },
  { id: "pharmacy", label: "Pharmacies", words: ["pharmacy", "pharmacies", "chemist", "medical store"], tags: ['["amenity"="pharmacy"]'] },
  { id: "restaurant", label: "Restaurants", words: ["restaurant", "restaurants", "food", "dining"], tags: ['["amenity"~"^(restaurant|fast_food)$"]'] },
  { id: "cafe", label: "Cafes", words: ["cafe", "cafes", "coffee", "coffee shop"], tags: ['["amenity"="cafe"]'] },
  { id: "hotel", label: "Hotels", words: ["hotel", "hotels", "motel", "guest house", "hostel"], tags: ['["tourism"~"^(hotel|motel|guest_house|hostel)$"]'] },
  { id: "mosque", label: "Mosques", words: ["mosque", "mosques", "masjid"], tags: ['["amenity"="place_of_worship"]["religion"="muslim"]'] },
  { id: "church", label: "Churches", words: ["church", "churches"], tags: ['["amenity"="place_of_worship"]["religion"="christian"]'] },
  { id: "worship", label: "Places of worship", words: ["temple", "temples", "place of worship"], tags: ['["amenity"="place_of_worship"]'] },
  { id: "bank", label: "Banks", words: ["bank", "banks"], tags: ['["amenity"="bank"]'] },
  { id: "atm", label: "ATMs", words: ["atm", "atms", "cash machine"], tags: ['["amenity"="atm"]'] },
  { id: "fuel", label: "Fuel stations", words: ["petrol pump", "petrol", "gas station", "fuel", "petrol station"], tags: ['["amenity"="fuel"]'] },
  { id: "park", label: "Parks", words: ["park", "parks", "garden", "gardens"], tags: ['["leisure"="park"]'] },
  { id: "supermarket", label: "Supermarkets", words: ["supermarket", "supermarkets", "grocery", "groceries", "mart"], tags: ['["shop"~"^(supermarket|convenience)$"]'] },
  { id: "mall", label: "Malls", words: ["mall", "malls", "shopping mall", "shopping"], tags: ['["shop"="mall"]'] },
  { id: "police", label: "Police", words: ["police", "police station"], tags: ['["amenity"="police"]'] },
  { id: "airport", label: "Airports", words: ["airport", "airports"], tags: ['["aeroway"="aerodrome"]["iata"]'] },
  { id: "station", label: "Stations", words: ["train station", "railway station", "station", "stations", "metro"], tags: ['["railway"="station"]'] },
  { id: "gym", label: "Gyms", words: ["gym", "gyms", "fitness"], tags: ['["leisure"="fitness_centre"]'] },
  { id: "museum", label: "Museums", words: ["museum", "museums"], tags: ['["tourism"="museum"]'] },
  { id: "parking", label: "Parking", words: ["parking", "car park"], tags: ['["amenity"="parking"]'] },
];

export type ParsedCategory = { category: Category; place: string | null; nearMe: boolean };

const STOP = /\b(near me|nearby|around me|close to me|around here|best|top|good|find|show me|show|list of|all|the|me)\b/g;

/** "colleges in Lahore" -> {college, "Lahore"}; "schools" -> {school, null}; "Lahore" -> null. */
export function parseCategory(raw: string): ParsedCategory | null {
  const q = ` ${raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
  const nearMe = /\b(near me|nearby|around me|close to me|around here)\b/.test(q);
  let best: { category: Category; word: string } | null = null;
  for (const category of CATEGORIES) {
    for (const word of category.words) {
      if (q.includes(` ${word} `) && (!best || word.length > best.word.length)) best = { category, word };
    }
  }
  if (!best) return null;
  let rest = q.replace(` ${best.word} `, " ").replace(STOP, " ");
  rest = rest.replace(/\b(in|at|of|around|near|within|inside|for)\b/g, " ").replace(/\s+/g, " ").trim();
  return { category: best.category, place: rest.length > 1 ? rest : null, nearMe };
}
