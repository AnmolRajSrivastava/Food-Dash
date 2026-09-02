// OpenRouteService API Key
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjMzMzA1MjBkZWNmMDQ5MWI5Yzk1MGIzNTQ1NDI0NTYwIiwiaCI6Im11cm11cjY0In0=';

// Backend API URL: automatically switches between local and cloud production URL
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:')
    ? 'http://127.0.0.1:5000'
    : 'https://food-dash-backend.onrender.com'; // Set to your live Render backend URL

// Metro Hub Configuration
const METRO_HUBS = {
    mumbai: {
        name: "Mumbai",
        center: [19.0760, 72.8777],
        zoom: 12,
        kitchens: [
            { label: "Central Kitchen (Colaba)", coords: "19.0760,72.8777" },
            { label: "Andheri West Hub", coords: "19.1136,72.8697" },
            { label: "Bandra Station Outlet", coords: "19.0596,72.8295" }
        ]
    },
    delhi: {
        name: "Delhi NCR",
        center: [28.6139, 77.2090],
        zoom: 12,
        kitchens: [
            { label: "Northern Hub (Connaught Place)", coords: "28.6315,77.2167" },
            { label: "Saket Express Kitchen", coords: "28.5535,77.2588" },
            { label: "Lajpat Nagar Branch", coords: "28.6328,77.2197" }
        ]
    },
    bangalore: {
        name: "Bengaluru",
        center: [12.9716, 77.5946],
        zoom: 12,
        kitchens: [
            { label: "Tech Park Branch (MG Road)", coords: "12.9716,77.5946" },
            { label: "Koramangala Kitchen", coords: "12.9352,77.6245" },
            { label: "Hebbal Cloud Kitchen", coords: "13.0358,77.5970" }
        ]
    }
};

// Global App State
let map;
let baseTileLayer;
let refTileLayer;
let originMarker;
let dropoffMarker;
let routeLine;
let routeGlow;
let currentCity = 'mumbai';
let dropoffCoords = null;
let distanceKm = 0;
let previousPredictedTime = 0;

// Initialize Application
function initApp() {
    initMap();
    setupCitySwitcher();
    setupWeatherPills();
    setupTrafficSlider();
    setupEventListeners();
    populateKitchens(currentCity);
}

// Initialize Leaflet with Native Esri Dark Canvas
function initMap() {
    const city = METRO_HUBS[currentCity];

    map = L.map('map', {
        zoomControl: false,
        attributionControl: true
    }).setView(city.center, city.zoom);

    // 1. Esri World Dark Gray Base (Zero API Key, Native Dark Cartography)
    baseTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxNativeZoom: 16,
        maxZoom: 19
    }).addTo(map);

    // 2. Esri World Dark Gray Reference Layer (Crisp White Street Labels)
    refTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxNativeZoom: 16,
        maxZoom: 19
    }).addTo(map);

    // Place zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Set initial restaurant marker
    updateOriginMarker(METRO_HUBS[currentCity].kitchens[0].coords);

    // Map click sets destination
    map.on('click', function (e) {
        setDropoffLocation(e.latlng);
    });
}

// Marker Factory with Tactical Radar Rings
function createMarkerIcon(type) {
    const coreClass = type === 'origin' ? 'core-origin' : 'core-dropoff';
    const ringClass = type === 'origin' ? 'ring-origin' : 'ring-dropoff';

    return L.divIcon({
        className: 'node-marker-wrapper',
        html: `
            <div class="node-marker-ring ${ringClass}"></div>
            <div class="node-marker-core ${coreClass}"></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

// Setup City Tab Switcher
function setupCitySwitcher() {
    const cityTabs = document.querySelectorAll('.city-tab');
    cityTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const selectedCity = tab.dataset.city;
            if (selectedCity === currentCity) return;

            cityTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            currentCity = selectedCity;
            const city = METRO_HUBS[currentCity];

            // Smooth Fly-to camera
            map.flyTo(city.center, city.zoom, { duration: 1.2 });

            // Clear dropoff & populate new kitchens
            clearDropoffState();
            populateKitchens(currentCity);
        });
    });
}

// Populate Kitchen Dropdown
function populateKitchens(cityKey) {
    const select = document.getElementById('restaurant-select');
    select.innerHTML = '';

    METRO_HUBS[cityKey].kitchens.forEach((k, idx) => {
        const opt = document.createElement('option');
        opt.value = k.coords;
        opt.textContent = k.label;
        if (idx === 0) opt.selected = true;
        select.appendChild(opt);
    });

    updateOriginMarker(select.value);
}

// Update Origin Marker
function updateOriginMarker(coordsStr) {
    const coords = coordsStr.split(',').map(Number);
    if (originMarker) map.removeLayer(originMarker);

    originMarker = L.marker(coords, { icon: createMarkerIcon('origin') }).addTo(map);

    if (dropoffCoords) {
        calculateRoute(coords, dropoffCoords);
    }
}

// Set Dropoff Location on Map Click
function setDropoffLocation(latlng) {
    if (dropoffMarker) map.removeLayer(dropoffMarker);

    dropoffCoords = [latlng.lat, latlng.lng];
    dropoffMarker = L.marker(dropoffCoords, { icon: createMarkerIcon('dropoff') }).addTo(map);

    document.getElementById('dropoff-location').value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;

    const originCoords = document.getElementById('restaurant-select').value.split(',').map(Number);
    calculateRoute(originCoords, dropoffCoords);
}

// Route Calculation (OpenRouteService + Haversine Fallback)
async function calculateRoute(start, end) {
    const startLngLat = [start[1], start[0]];
    const endLngLat = [end[1], end[0]];

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${startLngLat[0]},${startLngLat[1]}&end=${endLngLat[0]},${endLngLat[1]}`);

        if (!response.ok) throw new Error(`Routing API status ${response.status}`);

        const data = await response.json();
        const coords = data.features[0].geometry.coordinates;
        const latLngs = coords.map(c => [c[1], c[0]]);

        drawRoute(latLngs);

        const distanceMeters = data.features[0].properties.segments[0].distance;
        distanceKm = (distanceMeters / 1000).toFixed(2);

        document.getElementById('display-distance').innerText = `${distanceKm} km`;
        document.getElementById('display-routing-type').innerText = "Driving Road Network";

    } catch (e) {
        console.warn("Falling back to geodesic line due to routing API:", e.message);
        drawFallbackRoute(start, end);
    }
}

// Draw Dual-Layer Laser Polyline
function drawRoute(latLngs) {
    clearRouteLines();

    // Outer Neon Aura
    routeGlow = L.polyline(latLngs, {
        color: '#06b6d4',
        weight: 7,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    // Inner Laser Core
    routeLine = L.polyline(latLngs, {
        color: '#22d3ee',
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [60, 60], maxZoom: 14 });
}

// Fallback Straight Geodesic Line
function drawFallbackRoute(start, end) {
    clearRouteLines();

    routeLine = L.polyline([start, end], {
        color: '#06b6d4',
        weight: 3,
        dashArray: '8, 8',
        opacity: 0.85
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });

    distanceKm = (map.distance(start, end) / 1000).toFixed(2);
    document.getElementById('display-distance').innerText = `${distanceKm} km`;
    document.getElementById('display-routing-type').innerText = "Geodesic Direct Line";
}

function clearRouteLines() {
    if (routeGlow) map.removeLayer(routeGlow);
    if (routeLine) map.removeLayer(routeLine);
}

function clearDropoffState() {
    if (dropoffMarker) map.removeLayer(dropoffMarker);
    clearRouteLines();
    dropoffCoords = null;
    distanceKm = 0;
    document.getElementById('dropoff-location').value = '';
    document.getElementById('display-distance').innerText = '-- km';
    resetTelemetryDisplay();
}

function resetTelemetryDisplay() {
    document.getElementById('predicted-time').innerText = '--';
    document.getElementById('confidence-val').innerText = 'Waiting for route...';
    document.getElementById('confidence-bar').style.width = '0%';
    document.getElementById('impact-distance').innerText = '--';
    document.getElementById('impact-traffic').innerText = '--';
    document.getElementById('impact-weather').innerText = '--';
    
    updateProportionsBar(100, 0, 0);
}

// Weather Segmented Buttons
function setupWeatherPills() {
    const pills = document.querySelectorAll('#weather-pills .pill-btn');
    const hiddenInput = document.getElementById('weather-select');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            hiddenInput.value = pill.dataset.weather;
        });
    });
}

// Traffic Slider with Dynamic Badges
function setupTrafficSlider() {
    const slider = document.getElementById('traffic-slider');
    const badge = document.getElementById('traffic-badge');

    const trafficMap = {
        '1': { label: 'Low Flow', class: 'traffic-low' },
        '2': { label: 'Moderate', class: 'traffic-med' },
        '3': { label: 'Heavy', class: 'traffic-high' },
        '4': { label: 'Gridlock', class: 'traffic-jam' }
    };

    slider.addEventListener('input', (e) => {
        const val = e.target.value;
        const config = trafficMap[val];
        badge.innerText = config.label;
        badge.className = `active-traffic-badge ${config.class}`;
    });
}

// DOM Event Listeners
function setupEventListeners() {
    document.getElementById('restaurant-select').addEventListener('change', (e) => {
        updateOriginMarker(e.target.value);
    });

    document.getElementById('clear-location').addEventListener('click', clearDropoffState);
    document.getElementById('alert-close-btn').addEventListener('click', hideCustomAlert);
    document.getElementById('predict-btn').addEventListener('click', runPrediction);
}

// Animated Number Increment Helper
function animateNumber(element, start, end, duration = 600) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuad = 1 - (1 - progress) * (1 - progress);
        const currentVal = Math.round(start + (end - start) * easeOutQuad);

        element.innerText = currentVal;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.innerText = end;
        }
    }

    requestAnimationFrame(update);
}

// Update Stacked Proportions Bar
function updateProportionsBar(base, traffic, weather) {
    const total = base + traffic + weather;
    if (total === 0) return;

    const basePct = ((base / total) * 100).toFixed(1);
    const trafficPct = ((traffic / total) * 100).toFixed(1);
    const weatherPct = ((weather / total) * 100).toFixed(1);

    document.querySelector('.prop-base').style.width = `${basePct}%`;
    document.querySelector('.prop-traffic').style.width = `${trafficPct}%`;
    document.querySelector('.prop-weather').style.width = `${weatherPct}%`;
}

// Execute ML Prediction Sequence
async function runPrediction() {
    if (!dropoffCoords) {
        showCustomAlert("Please click on the map to set a dropoff destination first.");
        return;
    }

    const dist = parseFloat(distanceKm);
    if (dist > 100) {
        showCustomAlert("Boundary Warning: Selected destination exceeds our 100km operational limit.");
        return;
    }

    const btn = document.getElementById('predict-btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="btn-icon">⏳</span><span class="btn-text">Computing Telemetry...</span>`;
    btn.style.opacity = '0.8';
    btn.disabled = true;

    const trafficMap = { '1': 'Low', '2': 'Medium', '3': 'High', '4': 'Jam' };
    const trafficLevel = document.getElementById('traffic-slider').value;
    const weather = document.getElementById('weather-select').value;

    try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weather: weather,
                traffic: trafficMap[trafficLevel],
                distance: dist
            })
        });

        if (!response.ok) throw new Error("Inference service returned an error.");

        const data = await response.json();

        // Animate ETA Number
        const timeEl = document.getElementById('predicted-time');
        animateNumber(timeEl, previousPredictedTime || data.predicted_time, data.predicted_time);
        previousPredictedTime = data.predicted_time;

        // Dynamic Confidence calculation
        const confidence = Math.max(65, Math.min(98, 96 - (data.weather_penalty * 0.6) - (data.traffic_penalty * 0.6)));
        const confBar = document.getElementById('confidence-bar');
        const confVal = document.getElementById('confidence-val');

        confBar.style.width = `${confidence.toFixed(0)}%`;
        confVal.innerText = `${confidence.toFixed(1)}% Confidence`;

        if (confidence > 85) {
            confBar.style.backgroundColor = 'var(--accent-emerald)';
        } else if (confidence > 75) {
            confBar.style.backgroundColor = 'var(--accent-amber)';
        } else {
            confBar.style.backgroundColor = 'var(--accent-rose)';
        }

        // Breakdown values
        document.getElementById('impact-distance').innerText = `${data.base_time} mins`;
        document.getElementById('impact-traffic').innerText = `+${data.traffic_penalty} mins`;
        document.getElementById('impact-weather').innerText = `+${data.weather_penalty} mins`;

        // Update proportional stacked bar
        updateProportionsBar(data.base_time, data.traffic_penalty, data.weather_penalty);

    } catch (err) {
        console.error("Prediction Error:", err);
        const errorMsg = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? "Backend Service Unreachable. Ensure Python Flask is running on port 5000."
            : "Cloud backend starting up or unreachable. Please allow ~30s for spin-up if inactive.";
        showCustomAlert(errorMsg);
    } finally {
        btn.innerHTML = originalContent;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

// Toast Alert Helpers
function showCustomAlert(message) {
    const alertEl = document.getElementById('custom-alert');
    document.getElementById('alert-message').innerText = message;
    alertEl.classList.remove('hidden');

    setTimeout(() => {
        hideCustomAlert();
    }, 4500);
}

function hideCustomAlert() {
    document.getElementById('custom-alert').classList.add('hidden');
}

// Window Load
window.addEventListener('DOMContentLoaded', initApp);
