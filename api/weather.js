// api/weather.js

export default async function handler(req, res) {
  const {
    city,
    type = "current",
    units = "metric",
    lang = "kr",
    lat,
    lon,
  } = req.query;

  const apiKey = process.env.OPENWEATHER_KEY;

  if (!apiKey) {
    return res.status(500).json({ message: "API key not configured" });
  }

  const endpoint = type === "forecast" ? "forecast" : "weather";

  // 쿼리 문자열 구성: 좌표 우선, 없으면 city 사용
  let queryPart = "";

  if (lat && lon) {
    queryPart = `lat=${lat}&lon=${lon}`;
  } else if (city) {
    queryPart = `q=${encodeURIComponent(city)}`;
  } else {
    return res
      .status(400)
      .json({ message: "city 또는 lat/lon 중 하나는 반드시 필요합니다." });
  }

  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?${queryPart}&units=${units}&lang=${lang}&appid=${apiKey}`;

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
