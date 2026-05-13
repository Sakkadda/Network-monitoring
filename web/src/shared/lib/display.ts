const locationLabels: Record<string, string> = {
  'Server Room A': 'Серверная A',
  'Server Room B': 'Серверная B',
  'Server Room C': 'Серверная C',
  'Floor 2': '2 этаж',
  'Floor 3': '3 этаж',
  'Security Office': 'Пост охраны',
  'Branch Uplink': 'Канал филиала',
  'Backup Rack': 'Резервная стойка',
  'Perimeter Rack': 'Периметральная стойка',
  'Telephony Closet': 'Узел телефонии',
  'Conference Hall': 'Конференц-зал',
  'Storage Rack': 'Стойка хранения',
};

const reverseLocationLabels = Object.fromEntries(
  Object.entries(locationLabels).map(([raw, translated]) => [translated, raw]),
) as Record<string, string>;

export function translateLocation(location: string) {
  return locationLabels[location] ?? location;
}

export function normalizeLocationInput(location: string) {
  return reverseLocationLabels[location] ?? location;
}
