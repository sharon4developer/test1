export interface WeatherNow {
  temperatureC: number;
  code: number;
  summary: string;
}

const SUMMARIES: Array<[number[], string]> = [
  [[0], 'Clear'],
  [[1, 2], 'Partly cloudy'],
  [[3], 'Cloudy'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Storm'],
];

export function weatherSummary(code: number): string {
  for (const [codes, label] of SUMMARIES) {
    if (codes.includes(code)) return label;
  }
  return '';
}

export function formatWeather(weather: WeatherNow | null, units: 'kmh' | 'mph'): string {
  if (!weather) return '';
  const temp =
    units === 'mph'
      ? `${Math.round((weather.temperatureC * 9) / 5 + 32)}°F`
      : `${Math.round(weather.temperatureC)}°C`;
  return weather.summary ? `${temp} ${weather.summary}` : temp;
}

export async function fetchWeather(baseUrl: string, latitude: number, longitude: number): Promise<WeatherNow | null> {
  if (!baseUrl) return null;
  const url = `${baseUrl}?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=temperature_2m,weather_code`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const json = await response.json();
  const current = json?.current;
  if (!current || typeof current.temperature_2m !== 'number') return null;
  const code = Number(current.weather_code ?? -1);
  return { temperatureC: current.temperature_2m, code, summary: weatherSummary(code) };
}
