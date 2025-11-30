// api/weather.js

export default async function handler(req, res) {
  const { city, type = "current", units = "metric", lang = "kr" } = req.query;
  const apiKey = process.env.OPENWEATHER_KEY;

  if (!apiKey) {
    return res.status(500).json({ message: "API key not configured" });
  }

  if (!city) {
    return res.status(400).json({ message: "city is required" });
  }

  const endpoint = type === "forecast" ? "forecast" : "weather";

  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?q=${encodeURIComponent(
    city
  )}&units=${units}&lang=${lang}&appid=${apiKey}`;

  try {
    const upstreamRes = await fetch(url);
    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ message: "Failed to fetch weather data from OpenWeather" });
  }
}
