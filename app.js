// === 설정값 ===
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const ICON_URL = "https://openweathermap.org/img/wn/"; // weather[0].icon 사용:contentReference[oaicite:1]{index=1}
const STORAGE_KEY = "recentCities";
let currentUnit = "metric"; // "metric" or "imperial"
let lastSearchedCity = null;

// === DOM 참조 ===
const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const currentWeatherEl = document.querySelector("#currentWeather");
const forecastListEl = document.querySelector("#forecastList");
const outfitEl = document.querySelector("#outfitSuggestion");
const recentSearchesEl = document.querySelector("#recentSearches");
const unitToggleBtn = document.querySelector("#unitToggle");

// === 이벤트 바인딩 ===
searchBtn.addEventListener("click", handleSearch);
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

unitToggleBtn.addEventListener("click", () => {
  currentUnit = currentUnit === "metric" ? "imperial" : "metric";
  unitToggleBtn.dataset.unit = currentUnit;
  unitToggleBtn.textContent =
    currentUnit === "metric" ? "지금: ℃ (클릭 시 ℉)" : "지금: ℉ (클릭 시 ℃)";

  // 단위 전환 시 마지막 검색 도시 기준으로 다시 조회
  if (lastSearchedCity) {
    getWeatherFull(lastSearchedCity).catch(handleError);
  }
});

// 페이지 로드 시 최근 검색어 로드
document.addEventListener("DOMContentLoaded", () => {
  renderRecentSearches();
});

// === 핵심 핸들러 ===
function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) {
    alert("도시 이름을 입력해주세요.");
    return;
  }
  getWeatherFull(city).catch(handleError);
}

// 현재 + 예보 한번에 처리
async function getWeatherFull(city) {
  lastSearchedCity = city;

  // API 호출
  const [currentData, forecastData] = await Promise.all([
    getWeatherByCity(city),
    getForecastByCity(city),
  ]);

  displayCurrentWeather(currentData);
  displayForecast(forecastData);
  displayOutfitSuggestion(currentData);
  updateBackgroundTheme(currentData);

  saveRecentCity(city);
  renderRecentSearches();
}

// === API 호출 함수들 ===
// (여기서는 API 키를 직접 넣도록 되어 있지만,
// 실제 제출용에서는 /api/weather 같은 Vercel 함수로 감싸서 호출하는 걸 추천.)
async function getWeatherByCity(city) {
  const url = `/api/weather?city=${encodeURIComponent(
    city
  )}&units=${currentUnit}&type=current`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("도시를 찾을 수 없습니다.");
  return res.json();
}

async function getForecastByCity(city) {
  const url = `/api/weather?city=${encodeURIComponent(
    city
  )}&units=${currentUnit}&type=forecast`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("예보 정보를 가져오지 못했습니다.");
  return res.json();
}

// === UI 표시 함수들 ===
function displayCurrentWeather(data) {
  const {
    name,
    sys: { country },
    main: { temp, humidity },
    weather,
    wind: { speed },
  } = data;

  const desc = weather[0].description;
  const iconCode = weather[0].icon;

  const unitSymbol = currentUnit === "metric" ? "℃" : "℉";
  const windUnit = currentUnit === "metric" ? "m/s" : "mph";

  currentWeatherEl.innerHTML = `
    <div class="current-weather-main">
      <div>
        <h2>${name}, ${country}</h2>
        <div class="current-temp">${Math.round(temp)}${unitSymbol}</div>
        <p class="current-meta">${desc}</p>
        <div class="current-extra">
          <span>습도: ${humidity}%</span>
          <span>풍속: ${speed} ${windUnit}</span>
        </div>
      </div>
      <div>
        <img class="weather-icon" 
             src="${ICON_URL}${iconCode}@2x.png" 
             alt="${desc}" />
      </div>
    </div>
  `;
}

function displayForecast(data) {
  // OpenWeather 5일/3시간 예보: list 배열, 3시간 간격 데이터:contentReference[oaicite:2]{index=2}
  const list = data.list;

  // 하루에 여러 개(3시간 단위) → 간단히 "매일 정오(12:00:00)"만 뽑거나, 8개 간격으로 샘플링
  const dailyMap = {};

  list.forEach((item) => {
    const dateStr = item.dt_txt.split(" ")[0]; // "YYYY-MM-DD"
    const timeStr = item.dt_txt.split(" ")[1]; // "HH:MM:SS"
    if (!dailyMap[dateStr]) {
      // 우선 "12:00:00" 우선, 없으면 첫 데이터
      dailyMap[dateStr] = item;
    } else if (timeStr === "12:00:00") {
      dailyMap[dateStr] = item;
    }
  });

  const dailyList = Object.entries(dailyMap)
    .slice(0, 3); // 3일만 보여주기

  forecastListEl.innerHTML = "";

  dailyList.forEach(([dateStr, item]) => {
    const temp = Math.round(item.main.temp);
    const desc = item.weather[0].description;
    const icon = item.weather[0].icon;
    const unitSymbol = currentUnit === "metric" ? "℃" : "℉";

    const dateObj = new Date(dateStr);
    const dayLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

    const el = document.createElement("div");
    el.className = "forecast-item";
    el.innerHTML = `
      <div class="forecast-date">${dayLabel}</div>
      <img src="${ICON_URL}${icon}.png" alt="${desc}" />
      <div class="forecast-temp">${temp}${unitSymbol}</div>
      <div class="forecast-desc">${desc}</div>
    `;
    forecastListEl.appendChild(el);
  });
}

// === 확장 기능: 옷차림 추천 ===
function displayOutfitSuggestion(currentData) {
  const temp = currentData.main.temp;
  const weatherMain = currentData.weather[0].main; // "Rain", "Snow", "Clear" 등:contentReference[oaicite:3]{index=3}
  const unit = currentUnit === "metric" ? "℃" : "℉";

  let message = "";
  let icon = "";

  // 단위를 섭씨 기준으로 맞추기 위해, imperial일 경우 대충 환산
  let tempC = temp;
  if (currentUnit === "imperial") {
    tempC = ((temp - 32) * 5) / 9;
  }

  if (tempC <= 0) {
    message = "두꺼운 패딩, 목도리, 장갑 필수! 가능한 한 많이 껴입으세요.";
    icon = "🧣🧤";
  } else if (tempC <= 8) {
    message = "코트나 두꺼운 점퍼 + 니트 조합 추천. 바람 불면 체감온도 더 내려가요.";
    icon = "🧥";
  } else if (tempC <= 16) {
    message = "가벼운 코트, 자켓, 맨투맨 정도면 적당해요.";
    icon = "🧥👕";
  } else if (tempC <= 23) {
    message = "셔츠나 얇은 긴팔, 가벼운 후드티 정도면 좋아요.";
    icon = "👕";
  } else if (tempC <= 28) {
    message = "반팔 + 얇은 바지/치마 추천. 햇빛 강하면 모자도 좋아요.";
    icon = "👕🧢";
  } else {
    message = "매우 덥습니다! 최대한 시원하게 입고, 물 자주 드세요.";
    icon = "🩳☀️";
  }

  if (weatherMain === "Rain" || weatherMain === "Drizzle") {
    message += " 비가 오니 우산이나 방수 외투를 챙기세요.";
    icon += " ☔";
  } else if (weatherMain === "Snow") {
    message += " 눈길 미끄러우니 미끄럼 방지 신발을 신는 게 좋아요.";
    icon += " ❄️";
  } else if (weatherMain === "Thunderstorm") {
    message += " 뇌우가 있으니 외출 시 각별히 주의하세요.";
    icon += " ⛈️";
  }

  outfitEl.innerHTML = `
    <h2>오늘 뭐 입지? (${Math.round(temp)}${unit})</h2>
    <p>${icon} ${message}</p>
  `;
}

// === 배경 테마 변경 ===
function updateBackgroundTheme(data) {
  const weatherMain = data.weather[0].main; // Clear, Clouds, Rain ...
  const icon = data.weather[0].icon;       // "01d", "01n" 등, d/n으로 낮/밤 구분:contentReference[oaicite:4]{index=4}

  let theme = "theme-default";

  const isNight = icon.endsWith("n");

  if (isNight) {
    theme = "theme-night";
  } else {
    switch (weatherMain) {
      case "Clear":
        theme = "theme-clear-day";
        break;
      case "Rain":
      case "Drizzle":
      case "Thunderstorm":
        theme = "theme-rain";
        break;
      case "Snow":
        theme = "theme-snow";
        break;
      default:
        theme = "theme-default";
        break;
    }
  }

  document.body.className = theme;
}

// === 최근 검색어 (localStorage) ===
function saveRecentCity(city) {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

  // 중복 제거
  const filtered = stored.filter((c) => c.toLowerCase() !== city.toLowerCase());
  filtered.unshift(city); // 앞에 추가
  const sliced = filtered.slice(0, 5); // 최대 5개

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
}

function renderRecentSearches() {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  recentSearchesEl.innerHTML = "";

  stored.forEach((city) => {
    const btn = document.createElement("button");
    btn.textContent = city;
    btn.addEventListener("click", () => {
      cityInput.value = city;
      getWeatherFull(city).catch(handleError);
    });
    recentSearchesEl.appendChild(btn);
  });
}

// === 오류 처리 ===
function handleError(err) {
  console.error(err);
  alert(err.message || "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
}
