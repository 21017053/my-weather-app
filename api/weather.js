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

  // endpoint 선택
  let endpoint = "weather";
  if (type === "forecast") {
    endpoint = "forecast";
  } else if (type === "air") {
    endpoint = "air_pollution";
  }

  // 쿼리 문자열 구성: 좌표 우선, 없으면 city
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

  // 공기질 API는 units/lang이 의미 없지만, 날씨 API에서는 사용됨
  const extra =
    type === "air" ? "" : `&units=${units}&lang=${lang}`;

  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?${queryPart}${extra}&appid=${apiKey}`;

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
