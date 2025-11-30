// === 상수 설정 ===
const ICON_URL = "https://openweathermap.org/img/wn/";
const STORAGE_KEY = "recentCities";
const LAST_LOCATION_KEY = "lastLocation";

// lastLocation = { mode: 'city' | 'coords', city?: string, coords?: {lat, lon} }
let lastLocation = null;
let currentUnit = "metric"; // "metric" or "imperial"
let currentLang = "kr"; // "kr" or "en"

let hourlyChart = null;
let lastAqiLevel = null;

let inputDebounceTimer = null;
let lastAutoSearchValue = "";

// === DOM 참조 ===
const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const geoBtn = document.querySelector("#geoBtn");
const currentWeatherEl = document.querySelector("#currentWeather");
const currentPlaceholderEl = document.querySelector("#currentPlaceholder");
const outfitEl = document.querySelector("#outfitSuggestion");
const outfitTitleEl = document.querySelector("#outfitTitle");
const outfitPlaceholderEl = document.querySelector("#outfitPlaceholder");
const forecastListEl = document.querySelector("#forecastList");
const forecastTitleEl = document.querySelector("#forecastTitle");
const recentSearchesEl = document.querySelector("#recentSearches");
const recentTitleEl = document.querySelector("#recentTitle");
const airQualityEl = document.querySelector("#airQuality");
const airTitleEl = document.querySelector("#airTitle");
const airPlaceholderEl = document.querySelector("#airPlaceholder");
const hourlyChartCanvas = document.querySelector("#hourlyChart");
const hourlyTitleEl = document.querySelector("#hourlyTitle");
const hourlyPlaceholderEl = document.querySelector("#hourlyPlaceholder");
const unitToggleBtn = document.querySelector("#unitToggle");
const langToggleBtn = document.querySelector("#langToggle");
const loadingIndicator = document.querySelector("#loadingIndicator");
const errorMessageEl = document.querySelector("#errorMessage");
const lastUpdatedEl = document.querySelector("#lastUpdated");
const logoTitleEl = document.querySelector(".logo-text h1");
const logoSubtitleEl = document.querySelector(".logo-text p");

// === Weather API 모듈 ===
const WeatherAPI = {
  getLangParam() {
    return currentLang === "kr" ? "kr" : "en";
  },

  async getCurrent(city) {
    const lang = this.getLangParam();
    const url = `/api/weather?city=${encodeURIComponent(
      city
    )}&units=${currentUnit}&lang=${lang}&type=current`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const msg =
        data?.message === "city not found"
          ? (currentLang === "kr"
              ? "도시를 찾을 수 없습니다."
              : "City not found.")
          : (currentLang === "kr"
              ? "현재 날씨 정보를 가져오지 못했습니다."
              : "Failed to fetch current weather.");
      const error = new Error(msg);
      error.code = res.status;
      throw error;
    }

    return data;
  },

  async getForecast(city) {
    const lang = this.getLangParam();
    const url = `/api/weather?city=${encodeURIComponent(
      city
    )}&units=${currentUnit}&lang=${lang}&type=forecast`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const msg =
        currentLang === "kr"
          ? "예보 정보를 가져오지 못했습니다."
          : "Failed to fetch forecast data.";
      const error = new Error(msg);
      error.code = res.status;
      throw error;
    }

    return data;
  },

  async getCurrentByCoords(lat, lon) {
    const lang = this.getLangParam();
    const url = `/api/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&lang=${lang}&type=current`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const msg =
        currentLang === "kr"
          ? "현재 위치의 날씨 정보를 가져오지 못했습니다."
          : "Failed to fetch weather for current location.";
      const error = new Error(msg);
      error.code = res.status;
      throw error;
    }

    return data;
  },

  async getForecastByCoords(lat, lon) {
    const lang = this.getLangParam();
    const url = `/api/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&lang=${lang}&type=forecast`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const msg =
        currentLang === "kr"
          ? "현재 위치의 예보 정보를 가져오지 못했습니다."
          : "Failed to fetch forecast for current location.";
      const error = new Error(msg);
      error.code = res.status;
      throw error;
    }

    return data;
  },

  async getAirByCoords(lat, lon) {
    const url = `/api/weather?lat=${lat}&lon=${lon}&type=air`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const msg =
        currentLang === "kr"
          ? "공기질 정보를 가져오지 못했습니다."
          : "Failed to fetch air quality.";
      const error = new Error(msg);
      error.code = res.status;
      throw error;
    }

    return data;
  },
};

// === Storage 모듈 ===
const Storage = {
  getRecent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  },
  saveRecent(city) {
    const stored = this.getRecent();
    const filtered = stored.filter(
      (c) => c.toLowerCase() !== city.toLowerCase()
    );
    filtered.unshift(city);
    const sliced = filtered.slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
  },
  saveLastLocation(location) {
    try {
      localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
    } catch {
      // 무시
    }
  },
  getLastLocation() {
    try {
      const raw = localStorage.getItem(LAST_LOCATION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};

// AQI 레벨 매핑 (1~5)
function mapAqiLevel(aqi) {
  if (currentLang === "kr") {
    switch (aqi) {
      case 1:
        return {
          label: "매우 좋음",
          desc: "공기가 매우 깨끗한 상태입니다.",
          levelClass: "aqi-level-1",
        };
      case 2:
        return {
          label: "좋음",
          desc: "대체로 공기가 좋은 편입니다.",
          levelClass: "aqi-level-2",
        };
      case 3:
        return {
          label: "보통",
          desc: "민감군이 아니라면 대부분 활동에 무리가 없습니다.",
          levelClass: "aqi-level-3",
        };
      case 4:
        return {
          label: "나쁨",
          desc: "호흡기/심장 질환자는 실외 활동을 줄이는 것이 좋습니다.",
          levelClass: "aqi-level-4",
        };
      case 5:
      default:
        return {
          label: "매우 나쁨",
          desc: "가능하면 실내에 머무르고, 실외 활동을 피하세요.",
          levelClass: "aqi-level-5",
        };
    }
  } else {
    switch (aqi) {
      case 1:
        return {
          label: "Excellent",
          desc: "Air quality is very good.",
          levelClass: "aqi-level-1",
        };
      case 2:
        return {
          label: "Good",
          desc: "Air quality is generally acceptable.",
          levelClass: "aqi-level-2",
        };
      case 3:
        return {
          label: "Moderate",
          desc: "Unhealthy for very sensitive people.",
          levelClass: "aqi-level-3",
        };
      case 4:
        return {
          label: "Poor",
          desc: "Sensitive groups should reduce outdoor activities.",
          levelClass: "aqi-level-4",
        };
      case 5:
      default:
        return {
          label: "Very Poor",
          desc: "Try to stay indoors and avoid outdoor activities.",
          levelClass: "aqi-level-5",
        };
    }
  }
}

// === UI 모듈 ===
const UI = {
  setLoading(isLoading) {
    const main = document.querySelector("main");
    if (isLoading) {
      loadingIndicator.classList.remove("hidden");
      searchBtn.disabled = true;
      unitToggleBtn.disabled = true;
      if (geoBtn) geoBtn.disabled = true;
      this.clearError();
      if (main) main.setAttribute("aria-busy", "true");
    } else {
      loadingIndicator.classList.add("hidden");
      searchBtn.disabled = false;
      unitToggleBtn.disabled = false;
      if (geoBtn) geoBtn.disabled = false;
      if (main) main.removeAttribute("aria-busy");
    }
  },

  showError(message) {
    errorMessageEl.textContent = message;
    errorMessageEl.classList.remove("hidden");
  },

  clearError() {
    errorMessageEl.textContent = "";
    errorMessageEl.classList.add("hidden");
  },

  updateLastUpdated() {
    const now = new Date();
    const text =
      currentLang === "kr"
        ? `마지막 업데이트: ${now.toLocaleString("ko-KR")}`
        : `Last updated: ${now.toLocaleString("en-US")}`;
    lastUpdatedEl.textContent = text;
  },

  updateCurrentWeather(data) {
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
            <span>${
              currentLang === "kr" ? "습도" : "Humidity"
            }: ${humidity}%</span>
            <span>${
              currentLang === "kr" ? "풍속" : "Wind"
            }: ${speed} ${windUnit}</span>
          </div>
        </div>
        <div>
          <img class="weather-icon"
               src="${ICON_URL}${iconCode}@2x.png"
               alt="${desc}" />
        </div>
      </div>
    `;
  },

  updateForecast(data) {
    const list = data.list || [];
    if (!list.length) {
      forecastListEl.innerHTML = `
        <p class="placeholder">${
          currentLang === "kr"
            ? "예보 데이터가 없습니다."
            : "No forecast data."
        }</p>`;
      return;
    }

    const dailyMap = {};

    list.forEach((item) => {
      const [dateStr, timeStr] = item.dt_txt.split(" ");
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = item;
      } else if (timeStr === "12:00:00") {
        dailyMap[dateStr] = item;
      }
    });

    const dailyList = Object.entries(dailyMap).slice(0, 3);

    forecastListEl.innerHTML = "";

    const unitSymbol = currentUnit === "metric" ? "℃" : "℉";

    dailyList.forEach(([dateStr, item]) => {
      const temp = Math.round(item.main.temp);
      const desc = item.weather[0].description;
      const icon = item.weather[0].icon;

      const dateObj = new Date(dateStr);
      const dayLabel =
        currentLang === "kr"
          ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
          : `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

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
  },

  updateOutfitSuggestion(currentData) {
    const temp = currentData.main.temp;
    const weatherMain = currentData.weather[0].main;
    const unit = currentUnit === "metric" ? "℃" : "℉";

    let tempC = temp;
    if (currentUnit === "imperial") {
      tempC = ((temp - 32) * 5) / 9;
    }

    let message = "";
    let icon = "";

    if (currentLang === "kr") {
      if (tempC <= 0) {
        message = "두꺼운 패딩, 목도리, 장갑 필수! 가능한 한 많이 껴입으세요.";
        icon = "🧣🧤";
      } else if (tempC <= 8) {
        message =
          "코트나 두꺼운 점퍼 + 니트 조합 추천. 바람 불면 더 춥게 느껴져요.";
        icon = "🧥";
      } else if (tempC <= 16) {
        message = "가벼운 코트, 자켓, 맨투맨 정도면 적당해요.";
        icon = "🧥👕";
      } else if (tempC <= 23) {
        message = "셔츠나 얇은 긴팔, 가벼운 후드티 정도면 좋아요.";
        icon = "👕";
      } else if (tempC <= 28) {
        message =
          "반팔 + 얇은 바지/치마 추천. 햇빛 강하면 모자도 챙기세요.";
        icon = "👕🧢";
      } else {
        message = "매우 덥습니다! 최대한 시원하게 입고, 물 자주 드세요.";
        icon = "🩳☀️";
      }

      if (weatherMain === "Rain" || weatherMain === "Drizzle") {
        message += " 비가 오니 우산이나 방수 외투를 챙기세요.";
        icon += " ☔";
      } else if (weatherMain === "Snow") {
        message += " 눈길이 미끄러우니 미끄럼 방지 신발을 추천합니다.";
        icon += " ❄️";
      } else if (weatherMain === "Thunderstorm") {
        message += " 뇌우가 있으니 외출 시 각별히 주의하세요.";
        icon += " ⛈️";
      }

      if (lastAqiLevel >= 4) {
        message += " 공기질이 좋지 않으므로 마스크 착용을 권장합니다.";
        icon += " 😷";
      } else if (lastAqiLevel === 3) {
        message += " 공기질이 보통 수준이니 민감군은 마스크를 고려하세요.";
      }
    } else {
      if (tempC <= 0) {
        message =
          "Very cold! Wear a thick padded jacket, scarf and gloves.";
        icon = "🧣🧤";
      } else if (tempC <= 8) {
        message =
          "Cold weather. A coat or thick jacket with knitwear is recommended.";
        icon = "🧥";
      } else if (tempC <= 16) {
        message =
          "Mildly chilly. A light coat, jacket or sweatshirt should be fine.";
        icon = "🧥👕";
      } else if (tempC <= 23) {
        message = "Comfortable. Long sleeves or a light hoodie are good.";
        icon = "👕";
      } else if (tempC <= 28) {
        message =
          "Warm. T-shirt with light pants or skirt is recommended. Consider a cap.";
        icon = "👕🧢";
      } else {
        message =
          "Very hot! Wear the coolest clothes you have and stay hydrated.";
        icon = "🩳☀️";
      }

      if (weatherMain === "Rain" || weatherMain === "Drizzle") {
        message += " Since it's raining, don't forget an umbrella or raincoat.";
        icon += " ☔";
      } else if (weatherMain === "Snow") {
        message +=
          " It's snowing, so non-slip shoes are recommended.";
        icon += " ❄️";
      } else if (weatherMain === "Thunderstorm") {
        message +=
          " There is a thunderstorm, so be extra careful when going outside.";
        icon += " ⛈️";
      }

      if (lastAqiLevel >= 4) {
        message +=
          " Air quality is poor, so wearing a mask is recommended.";
        icon += " 😷";
      } else if (lastAqiLevel === 3) {
        message +=
          " Air quality is moderate; sensitive groups may consider wearing a mask.";
      }
    }

    const titleBase =
      currentLang === "kr" ? "오늘 뭐 입지?" : "What should I wear today?";

    outfitEl.innerHTML = `
      <h2>${titleBase} (${Math.round(temp)}${unit})</h2>
      <p>${icon} ${message}</p>
    `;
  },

  updateBackgroundTheme(data) {
    const weatherMain = data.weather[0].main;
    const icon = data.weather[0].icon;

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
      }
    }

    document.body.className = theme;
  },

  renderRecentSearches() {
    const stored = Storage.getRecent();
    recentSearchesEl.innerHTML = "";

    stored.forEach((city) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = city;
      btn.addEventListener("click", () => {
        cityInput.value = city;
        getWeatherFullByCity(city);
      });
      recentSearchesEl.appendChild(btn);
    });
  },

  updateAirQuality(aqiData) {
    if (!aqiData || !aqiData.list || !aqiData.list.length) {
      airQualityEl.innerHTML = `
        <h2 id="airTitle">${
          currentLang === "kr" ? "공기질 / 미세먼지" : "Air Quality"
        }</h2>
        <p class="placeholder">${
          currentLang === "kr"
            ? "공기질 데이터를 가져오지 못했습니다."
            : "Failed to load air quality data."
        }</p>
      `;
      lastAqiLevel = null;
      return;
    }

    const entry = aqiData.list[0];
    const aqi = entry.main.aqi; // 1~5
    lastAqiLevel = aqi;
    const c = entry.components || {};

    const { label, desc, levelClass } = mapAqiLevel(aqi);

    const pm25 = c.pm2_5 ?? "-";
    const pm10 = c.pm10 ?? "-";
    const o3 = c.o3 ?? "-";
    const no2 = c.no2 ?? "-";
    const so2 = c.so2 ?? "-";
    const co = c.co ?? "-";

    airQualityEl.innerHTML = `
      <h2 id="airTitle">${
        currentLang === "kr" ? "공기질 / 미세먼지" : "Air Quality"
      }</h2>
      <div class="aqi-badge ${levelClass}">
        <span>AQI ${aqi} – ${label}</span>
      </div>
      <p style="margin-top:0.3rem; font-size:0.85rem;">${desc}</p>
      <div class="air-details">
        <span><strong>PM2.5</strong> ${
          typeof pm25 === "number" ? pm25.toFixed(1) : pm25
        } µg/m³</span>
        <span><strong>PM10</strong> ${
          typeof pm10 === "number" ? pm10.toFixed(1) : pm10
        } µg/m³</span>
        <span><strong>O₃</strong> ${
          typeof o3 === "number" ? o3.toFixed(1) : o3
        } µg/m³</span>
        <span><strong>NO₂</strong> ${
          typeof no2 === "number" ? no2.toFixed(1) : no2
        } µg/m³</span>
        <span><strong>SO₂</strong> ${
          typeof so2 === "number" ? so2.toFixed(1) : so2
        } µg/m³</span>
        <span><strong>CO</strong> ${
          typeof co === "number" ? co.toFixed(1) : co
        } µg/m³</span>
      </div>
    `;
  },

  updateHourlyChart(forecastData) {
    if (!hourlyChartCanvas || !forecastData || !forecastData.list) return;

    const list = forecastData.list.slice(0, 8);
    if (!list.length) return;

    const labels = list.map((item) => {
      const date = new Date(item.dt * 1000);
      const hour = date.getHours();
      return currentLang === "kr" ? `${hour}시` : `${hour}:00`;
    });

    const temps = list.map((item) => item.main.temp);
    const unitSymbol = currentUnit === "metric" ? "℃" : "℉";
    const titleText =
      currentLang === "kr"
        ? `향후 24시간 기온 (${unitSymbol})`
        : `Next 24 hours temperature (${unitSymbol})`;

    if (hourlyPlaceholderEl) {
      hourlyPlaceholderEl.style.display = "none";
    }

    const ctx = hourlyChartCanvas.getContext("2d");

    if (hourlyChart) {
      hourlyChart.data.labels = labels;
      hourlyChart.data.datasets[0].data = temps;
      hourlyChart.data.datasets[0].label =
        currentLang === "kr" ? `기온 (${unitSymbol})` : `Temperature (${unitSymbol})`;
      hourlyChart.options.plugins.title.text = titleText;
      hourlyChart.update();
    } else {
      hourlyChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label:
                currentLang === "kr"
                  ? `기온 (${unitSymbol})`
                  : `Temperature (${unitSymbol})`,
              data: temps,
              tension: 0.3,
              pointRadius: 3,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: titleText,
            },
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 0,
              },
            },
          },
        },
      });
    }
  },
};

// === 언어 관련 UI 업데이트 ===
function updateUnitToggleLabel() {
  const unitText =
    currentUnit === "metric"
      ? currentLang === "kr"
        ? "지금: ℃ (클릭 시 ℉)"
        : "Now: ℃ (click for ℉)"
      : currentLang === "kr"
      ? "지금: ℉ (클릭 시 ℃)"
      : "Now: ℉ (click for ℃)";
  unitToggleBtn.textContent = unitText;
}

function updateLangToggleLabel() {
  // 버튼에는 "바꿀 언어"를 표시
  langToggleBtn.textContent = currentLang === "kr" ? "🌐 EN" : "🌐 한국어";
}

function applyLanguageStaticText() {
  document.documentElement.lang = currentLang === "kr" ? "ko" : "en";

  if (currentLang === "kr") {
    document.title = "Outfit Weather | 오늘 뭐 입지?";
    logoTitleEl.textContent = "Outfit Weather";
    logoSubtitleEl.textContent = "오늘 날씨 + 옷차림 추천";
    cityInput.placeholder = "도시를 입력하세요 (예: Seoul)";
    searchBtn.textContent = "검색";
    geoBtn.textContent = "📍 내 위치";
    if (currentPlaceholderEl)
      currentPlaceholderEl.textContent =
        "도시를 검색하거나 내 위치를 사용하면 현재 날씨가 표시됩니다.";
    if (outfitTitleEl) outfitTitleEl.textContent = "오늘 뭐 입지?";
    if (outfitPlaceholderEl)
      outfitPlaceholderEl.textContent =
        "현재 날씨를 불러온 뒤 옷차림을 추천해 드릴게요.";
    if (forecastTitleEl) forecastTitleEl.textContent = "3일 예보";
    if (recentTitleEl) recentTitleEl.textContent = "최근 검색";
    if (airTitleEl) airTitleEl.textContent = "공기질 / 미세먼지";
    if (airPlaceholderEl)
      airPlaceholderEl.textContent =
        "위치 기반으로 공기질 정보를 표시합니다. (PM2.5, PM10 등)";
    if (hourlyTitleEl) hourlyTitleEl.textContent = "시간별 기온 변화";
    if (hourlyPlaceholderEl)
      hourlyPlaceholderEl.textContent =
        "예보 데이터를 불러오면 24시간 이내 기온 변화를 그래프로 표시합니다.";
  } else {
    document.title = "Outfit Weather | What should I wear today?";
    logoTitleEl.textContent = "Outfit Weather";
    logoSubtitleEl.textContent = "Today's weather & outfit recommendation";
    cityInput.placeholder = "Enter city (e.g. Seoul)";
    searchBtn.textContent = "Search";
    geoBtn.textContent = "📍 My location";
    if (currentPlaceholderEl)
      currentPlaceholderEl.textContent =
        "Search a city or use your location to see the current weather.";
    if (outfitTitleEl) outfitTitleEl.textContent = "What should I wear today?";
    if (outfitPlaceholderEl)
      outfitPlaceholderEl.textContent =
        "We will recommend an outfit after loading the current weather.";
    if (forecastTitleEl) forecastTitleEl.textContent = "3-day forecast";
    if (recentTitleEl) recentTitleEl.textContent = "Recent searches";
    if (airTitleEl) airTitleEl.textContent = "Air quality";
    if (airPlaceholderEl)
      airPlaceholderEl.textContent =
        "Air quality information (PM2.5, PM10, etc.) based on your location.";
    if (hourlyTitleEl) hourlyTitleEl.textContent = "Hourly temperature";
    if (hourlyPlaceholderEl)
      hourlyPlaceholderEl.textContent =
        "Once forecast is loaded, a 24-hour temperature chart will appear here.";
  }

  updateUnitToggleLabel();
  updateLangToggleLabel();
}

// === 메인 로직 ===

function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) {
    UI.showError(
      currentLang === "kr"
        ? "도시 이름을 입력해주세요."
        : "Please enter a city name."
    );
    return;
  }
  getWeatherFullByCity(city);
}

function handleGeoSearch() {
  UI.clearError();

  if (!("geolocation" in navigator)) {
    UI.showError(
      currentLang === "kr"
        ? "이 브라우저에서는 위치 정보를 사용할 수 없습니다."
        : "Geolocation is not supported in this browser."
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      getWeatherFullByCoords(latitude, longitude);
    },
    (error) => {
      let msg =
        currentLang === "kr"
          ? "위치 정보를 가져오지 못했습니다."
          : "Failed to get location.";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg =
            currentLang === "kr"
              ? "위치 권한이 거부되었습니다. 브라우저 설정을 확인해주세요."
              : "Location permission was denied. Please check browser settings.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg =
            currentLang === "kr"
              ? "위치 정보를 사용할 수 없습니다."
              : "Location information is unavailable.";
          break;
        case error.TIMEOUT:
          msg =
            currentLang === "kr"
              ? "위치 정보를 가져오는 데 시간이 너무 오래 걸립니다."
              : "Timed out while retrieving location.";
          break;
      }
      UI.showError(msg);
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000,
    }
  );
}

/**
 * 도시 이름 기반: 현재 + 예보 + 공기질 + 차트
 */
async function getWeatherFullByCity(city) {
  if (!navigator.onLine) {
    UI.showError(
      currentLang === "kr"
        ? "오프라인 상태입니다. 인터넷 연결을 확인해주세요."
        : "You are offline. Please check your internet connection."
    );
    return;
  }

  UI.setLoading(true);

  try {
    lastLocation = { mode: "city", city };

    const current = await WeatherAPI.getCurrent(city);

    const [forecast, air] = await Promise.all([
      WeatherAPI.getForecast(city),
      WeatherAPI.getAirByCoords(current.coord.lat, current.coord.lon),
    ]);

    UI.updateCurrentWeather(current);
    UI.updateForecast(forecast);
    UI.updateAirQuality(air);
    UI.updateOutfitSuggestion(current);
    UI.updateBackgroundTheme(current);
    UI.updateLastUpdated();
    UI.updateHourlyChart(forecast);

    Storage.saveRecent(city);
    UI.renderRecentSearches();
    Storage.saveLastLocation(lastLocation);
  } catch (error) {
    handleError(error);
  } finally {
    UI.setLoading(false);
  }
}

/**
 * 좌표 기반: 현재 + 예보 + 공기질 + 차트
 */
async function getWeatherFullByCoords(lat, lon) {
  if (!navigator.onLine) {
    UI.showError(
      currentLang === "kr"
        ? "오프라인 상태입니다. 인터넷 연결을 확인해주세요."
        : "You are offline. Please check your internet connection."
    );
    return;
  }

  UI.setLoading(true);

  try {
    lastLocation = { mode: "coords", coords: { lat, lon } };

    const [current, forecast, air] = await Promise.all([
      WeatherAPI.getCurrentByCoords(lat, lon),
      WeatherAPI.getForecastByCoords(lat, lon),
      WeatherAPI.getAirByCoords(lat, lon),
    ]);

    UI.updateCurrentWeather(current);
    UI.updateForecast(forecast);
    UI.updateAirQuality(air);
    UI.updateOutfitSuggestion(current);
    UI.updateBackgroundTheme(current);
    UI.updateLastUpdated();
    UI.updateHourlyChart(forecast);

    if (current?.name) {
      Storage.saveRecent(current.name);
      UI.renderRecentSearches();
    }
    Storage.saveLastLocation(lastLocation);
  } catch (error) {
    handleError(error);
  } finally {
    UI.setLoading(false);
  }
}

// === 오류 처리 ===
function handleError(err) {
  console.error(err);
  if (err.code === 404) {
    UI.showError(
      currentLang === "kr"
        ? "해당 도시를 찾을 수 없습니다. 철자를 다시 확인해주세요."
        : "City not found. Please check the spelling."
    );
  } else if (err.message) {
    UI.showError(err.message);
  } else {
    UI.showError(
      currentLang === "kr"
        ? "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        : "An unknown error occurred. Please try again later."
    );
  }
}

// === 단위 전환 ===
function handleUnitToggle() {
  currentUnit = currentUnit === "metric" ? "imperial" : "metric";
  updateUnitToggleLabel();

  if (!lastLocation) return;

  if (lastLocation.mode === "city" && lastLocation.city) {
    getWeatherFullByCity(lastLocation.city);
  } else if (lastLocation.mode === "coords" && lastLocation.coords) {
    const { lat, lon } = lastLocation.coords;
    getWeatherFullByCoords(lat, lon);
  }
}

// === 언어 토글 ===
function handleLangToggle() {
  currentLang = currentLang === "kr" ? "en" : "kr";
  applyLanguageStaticText();

  if (lastLocation) {
    if (lastLocation.mode === "city" && lastLocation.city) {
      getWeatherFullByCity(lastLocation.city);
    } else if (lastLocation.mode === "coords" && lastLocation.coords) {
      const { lat, lon } = lastLocation.coords;
      getWeatherFullByCoords(lat, lon);
    }
  }
}

// === 입력 디바운스 ===
function handleCityInputChange() {
  const value = cityInput.value.trim();

  if (inputDebounceTimer) {
    clearTimeout(inputDebounceTimer);
  }

  if (value.length < 2) return;

  inputDebounceTimer = setTimeout(() => {
    if (value === lastAutoSearchValue) return;
    lastAutoSearchValue = value;
    getWeatherFullByCity(value);
  }, 800);
}

// === 초기화 ===
function init() {
  applyLanguageStaticText();

  searchBtn.addEventListener("click", handleSearch);
  unitToggleBtn.addEventListener("click", handleUnitToggle);
  langToggleBtn.addEventListener("click", handleLangToggle);

  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  cityInput.addEventListener("input", handleCityInputChange);

  if (geoBtn && "geolocation" in navigator) {
    geoBtn.addEventListener("click", handleGeoSearch);
  } else if (geoBtn) {
    geoBtn.style.display = "none";
  }

  UI.renderRecentSearches();

  // 마지막 위치 자동 로딩
  const savedLocation = Storage.getLastLocation();
  if (savedLocation) {
    lastLocation = savedLocation;
    if (savedLocation.mode === "city" && savedLocation.city) {
      getWeatherFullByCity(savedLocation.city);
    } else if (savedLocation.mode === "coords" && savedLocation.coords) {
      const { lat, lon } = savedLocation.coords;
      getWeatherFullByCoords(lat, lon);
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
