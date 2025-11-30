// === 상수 설정 ===
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const ICON_URL = "https://openweathermap.org/img/wn/";
const STORAGE_KEY = "recentCities";

// 마지막 검색 위치 정보
// lastLocation = { mode: 'city' | 'coords', city?: string, coords?: {lat, lon} }
let lastLocation = null;
let currentUnit = "metric"; // "metric" or "imperial"

// === DOM 참조 ===
const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const geoBtn = document.querySelector("#geoBtn");
const currentWeatherEl = document.querySelector("#currentWeather");
const forecastListEl = document.querySelector("#forecastList");
const outfitEl = document.querySelector("#outfitSuggestion");
const recentSearchesEl = document.querySelector("#recentSearches");
const unitToggleBtn = document.querySelector("#unitToggle");
const loadingIndicator = document.querySelector("#loadingIndicator");
const errorMessageEl = document.querySelector("#errorMessage");
const lastUpdatedEl = document.querySelector("#lastUpdated");

// === Weather API 모듈 ===
const WeatherAPI = {
  /**
   * 현재 날씨 - 도시 이름 기준
   */
  async getCurrent(city) {
    const url = `/api/weather?city=${encodeURIComponent(
      city
    )}&units=${currentUnit}&lang=kr&type=current`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const msg =
        data?.message === "city not found"
          ? "도시를 찾을 수 없습니다."
          : "현재 날씨 정보를 가져오지 못했습니다.";
      const error = new Error(msg);
      error.code = res.status;
      throw error;
    }

    return data;
  },

  /**
   * 5일 예보 - 도시 이름 기준
   */
  async getForecast(city) {
    const url = `/api/weather?city=${encodeURIComponent(
      city
    )}&units=${currentUnit}&lang=kr&type=forecast`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const error = new Error("예보 정보를 가져오지 못했습니다.");
      error.code = res.status;
      throw error;
    }

    return data;
  },

  /**
   * 현재 날씨 - 좌표(lat, lon) 기준
   */
  async getCurrentByCoords(lat, lon) {
    const url = `/api/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&lang=kr&type=current`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const error = new Error("현재 위치의 날씨 정보를 가져오지 못했습니다.");
      error.code = res.status;
      throw error;
    }

    return data;
  },

  /**
   * 5일 예보 - 좌표(lat, lon) 기준
   */
  async getForecastByCoords(lat, lon) {
    const url = `/api/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&lang=kr&type=forecast`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const error = new Error("현재 위치의 예보 정보를 가져오지 못했습니다.");
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
};

// === UI 모듈 ===
const UI = {
  setLoading(isLoading) {
    if (isLoading) {
      loadingIndicator.classList.remove("hidden");
      searchBtn.disabled = true;
      unitToggleBtn.disabled = true;
      if (geoBtn) geoBtn.disabled = true;
      this.clearError();
    } else {
      loadingIndicator.classList.add("hidden");
      searchBtn.disabled = false;
      unitToggleBtn.disabled = false;
      if (geoBtn) geoBtn.disabled = false;
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
    const text = `마지막 업데이트: ${now.toLocaleString("ko-KR")}`;
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
  },

  updateForecast(data) {
    const list = data.list || [];
    if (!list.length) {
      forecastListEl.innerHTML =
        "<p class='placeholder'>예보 데이터가 없습니다.</p>";
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

    if (tempC <= 0) {
      message = "두꺼운 패딩, 목도리, 장갑 필수! 가능한 한 많이 껴입으세요.";
      icon = "🧣🧤";
    } else if (tempC <= 8) {
      message = "코트나 두꺼운 점퍼 + 니트 조합 추천. 바람 불면 더 춥게 느껴져요.";
      icon = "🧥";
    } else if (tempC <= 16) {
      message = "가벼운 코트, 자켓, 맨투맨 정도면 적당해요.";
      icon = "🧥👕";
    } else if (tempC <= 23) {
      message = "셔츠나 얇은 긴팔, 가벼운 후드티 정도면 좋아요.";
      icon = "👕";
    } else if (tempC <= 28) {
      message = "반팔 + 얇은 바지/치마 추천. 햇빛 강하면 모자도 챙기세요.";
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

    outfitEl.innerHTML = `
      <h2>오늘 뭐 입지? (${Math.round(temp)}${unit})</h2>
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
};

// === 메인 로직 ===

function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) {
    UI.showError("도시 이름을 입력해주세요.");
    return;
  }
  getWeatherFullByCity(city);
}

/**
 * 현재 위치 버튼 클릭 시 처리
 */
function handleGeoSearch() {
  UI.clearError();

  if (!("geolocation" in navigator)) {
    UI.showError("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      getWeatherFullByCoords(latitude, longitude);
    },
    (error) => {
      let msg = "위치 정보를 가져오지 못했습니다.";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = "위치 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "위치 정보를 사용할 수 없습니다.";
          break;
        case error.TIMEOUT:
          msg = "위치 정보를 가져오는 데 시간이 너무 오래 걸립니다.";
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
 * 도시 이름 기반: 현재 + 예보 한번에 가져와서 화면 업데이트
 */
async function getWeatherFullByCity(city) {
  if (!navigator.onLine) {
    UI.showError("오프라인 상태입니다. 인터넷 연결을 확인해주세요.");
    return;
  }

  UI.setLoading(true);

  try {
    lastLocation = { mode: "city", city };

    const [current, forecast] = await Promise.all([
      WeatherAPI.getCurrent(city),
      WeatherAPI.getForecast(city),
    ]);

    UI.updateCurrentWeather(current);
    UI.updateForecast(forecast);
    UI.updateOutfitSuggestion(current);
    UI.updateBackgroundTheme(current);
    UI.updateLastUpdated();

    Storage.saveRecent(city);
    UI.renderRecentSearches();
  } catch (error) {
    handleError(error);
  } finally {
    UI.setLoading(false);
  }
}

/**
 * 좌표 기반: 현재 + 예보 한번에 가져와서 화면 업데이트
 */
async function getWeatherFullByCoords(lat, lon) {
  if (!navigator.onLine) {
    UI.showError("오프라인 상태입니다. 인터넷 연결을 확인해주세요.");
    return;
  }

  UI.setLoading(true);

  try {
    lastLocation = { mode: "coords", coords: { lat, lon } };

    const [current, forecast] = await Promise.all([
      WeatherAPI.getCurrentByCoords(lat, lon),
      WeatherAPI.getForecastByCoords(lat, lon),
    ]);

    UI.updateCurrentWeather(current);
    UI.updateForecast(forecast);
    UI.updateOutfitSuggestion(current);
    UI.updateBackgroundTheme(current);
    UI.updateLastUpdated();

    // 현재 위치도 name이 나오면 recent에 저장해줄 수 있음
    if (current?.name) {
      Storage.saveRecent(current.name);
      UI.renderRecentSearches();
    }
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
    UI.showError("해당 도시를 찾을 수 없습니다. 철자를 다시 확인해주세요.");
  } else if (err.message) {
    UI.showError(err.message);
  } else {
    UI.showError("알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }
}

// === 단위 전환 ===
function handleUnitToggle() {
  currentUnit = currentUnit === "metric" ? "imperial" : "metric";
  unitToggleBtn.dataset.unit = currentUnit;
  unitToggleBtn.textContent =
    currentUnit === "metric" ? "지금: ℃ (클릭 시 ℉)" : "지금: ℉ (클릭 시 ℃)";

  if (!lastLocation) return;

  if (lastLocation.mode === "city" && lastLocation.city) {
    getWeatherFullByCity(lastLocation.city);
  } else if (lastLocation.mode === "coords" && lastLocation.coords) {
    const { lat, lon } = lastLocation.coords;
    getWeatherFullByCoords(lat, lon);
  }
}

// === 초기화 ===
function init() {
  // 이벤트 바인딩
  searchBtn.addEventListener("click", handleSearch);
  unitToggleBtn.addEventListener("click", handleUnitToggle);

  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  if (geoBtn && "geolocation" in navigator) {
    geoBtn.addEventListener("click", handleGeoSearch);
  } else if (geoBtn) {
    // 지원 안 하면 버튼 숨기기
    geoBtn.style.display = "none";
  }

  // 최근 검색어 표시
  UI.renderRecentSearches();
}

document.addEventListener("DOMContentLoaded", init);
