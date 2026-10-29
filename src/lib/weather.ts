// Open-Meteo: free, no API key. https://open-meteo.com
export type DayWeather = { date: string; code: number; max: number; min: number };
export type Weather = { temp: number; code: number; days: DayWeather[] };

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FLondon&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather");
  const j = await res.json();
  return {
    temp: Math.round(j.current.temperature_2m),
    code: j.current.weather_code,
    days: j.daily.time.map((date: string, i: number) => ({
      date,
      code: j.daily.weather_code[i],
      max: Math.round(j.daily.temperature_2m_max[i]),
      min: Math.round(j.daily.temperature_2m_min[i]),
    })),
  };
}

export function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Cloudy", icon: "☁️" };
  if (code <= 48) return { label: "Fog", icon: "🌫️" };
  if (code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code <= 77) return { label: "Snow", icon: "❄️" };
  if (code <= 82) return { label: "Showers", icon: "🌦️" };
  if (code <= 86) return { label: "Snow showers", icon: "🌨️" };
  return { label: "Thunderstorms", icon: "⛈️" };
}
