// ORS API Key (User's actual key)
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjMzMzA1MjBkZWNmMDQ5MWI5Yzk1MGIzNTQ1NDI0NTYwIiwiaCI6Im11cm11cjY0In0='; // Placeholder to avoid exposing real key in logs if pasted, but will update if needed

// State variables
let map;
let restaurantMarker;
let dropoffMarker;
let routeLine;
let dropoffCoords = null;
let distanceKm = 0;

// Initialize Map
function initMap() {
    // Default center (Mumbai)
    map = L.map('map', {
        zoomControl: false
    }).setView([19.0760, 72.8777], 12);

    // Add OpenStreetMap base layer (completely free, no API key, no watermarks)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19
    }).addTo(map);

    // Move zoom control to top right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Custom Icons (Neon styling)
    const createIcon = (color) => L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #18181b; box-shadow: 0 0 15px ${color};"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const restaurantIcon = createIcon('#06b6d4'); // Cyan
    const dropoffIcon = createIcon('#8b5cf6');   // Purple

    // Initial Restaurant Marker
    updateRestaurantMarker(document.getElementById('restaurant-select').value, restaurantIcon);

    // Map Click Event (Set Dropoff)
    map.on('click', function (e) {
        setDropoffLocation(e.latlng, dropoffIcon);
    });

    // Handle Restaurant Change
    document.getElementById('restaurant-select').addEventListener('change', (e) => {
        updateRestaurantMarker(e.target.value, restaurantIcon);
    });

    // Handle Clear Dropoff
    document.getElementById('clear-location').addEventListener('click', () => {
        if (dropoffMarker) map.removeLayer(dropoffMarker);
        if (routeLine) map.removeLayer(routeLine);
        dropoffCoords = null;
        document.getElementById('dropoff-location').value = '';
        document.getElementById('display-distance').innerText = '-- km';
        resetPredictions();
    });

    // Handle Predict Button
    document.getElementById('predict-btn').addEventListener('click', runPrediction);
}

function updateRestaurantMarker(coordsStr, icon) {
    const coords = coordsStr.split(',').map(Number);
    if (restaurantMarker) map.removeLayer(restaurantMarker);

    restaurantMarker = L.marker(coords, { icon: icon }).addTo(map);
    map.setView(coords, 13);

    // Recalculate route if dropoff exists
    if (dropoffCoords) {
        calculateRoute(coords, dropoffCoords);
    }
}

function setDropoffLocation(latlng, icon) {
    if (dropoffMarker) map.removeLayer(dropoffMarker);

    dropoffCoords = [latlng.lat, latlng.lng];
    dropoffMarker = L.marker(dropoffCoords, { icon: icon }).addTo(map);

    document.getElementById('dropoff-location').value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;

    // Get restaurant coords and calculate route
    const restCoords = document.getElementById('restaurant-select').value.split(',').map(Number);
    calculateRoute(restCoords, dropoffCoords);
}

async function calculateRoute(start, end) {
    // ORS takes coordinates as [longitude, latitude]
    const startLngLat = [start[1], start[0]];
    const endLngLat = [end[1], end[0]];

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${startLngLat[0]},${startLngLat[1]}&end=${endLngLat[0]},${endLngLat[1]}`);

        if (!response.ok) {
            throw new Error(`ORS API error: ${response.status}`);
        }

        const data = await response.json();

        // Remove old route
        if (routeLine) map.removeLayer(routeLine);

        // Get coordinates from ORS response
        const coords = data.features[0].geometry.coordinates;
        // ORS returns [lng, lat], Leaflet needs [lat, lng]
        const latLngs = coords.map(c => [c[1], c[0]]);

        // Draw the real road route
        routeLine = L.polyline(latLngs, {
            color: '#06b6d4',
            weight: 4,
            opacity: 0.8,
            shadowColor: '#06b6d4',
            shadowBlur: 10
        }).addTo(map);

        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

        // Get real driving distance in km
        const distanceMeters = data.features[0].properties.segments[0].distance;
        distanceKm = (distanceMeters / 1000).toFixed(2);
        document.getElementById('display-distance').innerText = `${distanceKm} km`;

    } catch (e) {
        console.error("Routing error, falling back to straight line:", e);
        drawStraightLine(start, end);
    }
}

function drawStraightLine(start, end) {
    if (routeLine) map.removeLayer(routeLine);

    routeLine = L.polyline([start, end], {
        color: '#06b6d4',
        weight: 4,
        dashArray: '10, 10',
        opacity: 0.8
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

    // Calculate Haversine distance
    distanceKm = (map.distance(start, end) / 1000).toFixed(2);
    document.getElementById('display-distance').innerText = `${distanceKm} km`;
}

function resetPredictions() {
    document.getElementById('predicted-time').innerText = '--';
    document.querySelector('.confidence-fill').style.width = '0%';
    document.querySelector('.confidence-text').innerText = 'Waiting for parameters...';

    document.getElementById('impact-distance').innerText = '--';
    document.getElementById('impact-traffic').innerText = '--';
    document.getElementById('impact-weather').innerText = '--';
}

async function runPrediction() {
    if (!dropoffCoords) {
        alert("Please click on the map to set a dropoff location first.");
        return;
    }

    const btn = document.getElementById('predict-btn');
    btn.innerText = "Analyzing Telemetry...";
    btn.style.opacity = "0.7";

    const trafficLevel = document.getElementById('traffic-slider').value;
    const weather = document.getElementById('weather-select').value;
    const dist = parseFloat(distanceKm);

    if (dist > 100) {
        showCustomAlert("Route Error: Destination exceeds our 100km delivery radius. Please select a closer location.");
        btn.innerText = "Initialize Prediction Sequence";
        btn.style.opacity = "1";
        return;
    }

    // Map traffic slider (1-4) to dataset labels
    const trafficMap = {
        '1': 'Low',
        '2': 'Medium',
        '3': 'High',
        '4': 'Jam'
    };

    try {
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                weather: weather,
                traffic: trafficMap[trafficLevel],
                distance: dist
            })
        });

        if (!response.ok) throw new Error("API Connection Failed");

        const data = await response.json();

        // Update UI with real ML data
        document.getElementById('predicted-time').innerText = data.predicted_time;

        // Confidence simulation based on distance and weather
        const confidence = 95 - (data.weather_penalty * 0.5) - (data.traffic_penalty * 0.5);
        const fill = document.querySelector('.confidence-fill');
        fill.style.width = `${confidence}%`;
        fill.style.backgroundColor = confidence > 80 ? 'var(--success)' : (confidence > 60 ? '#f59e0b' : 'var(--danger)');

        document.querySelector('.confidence-text').innerText = `Confidence Level: ${confidence.toFixed(1)}%`;

        // Impact Analysis from ML
        document.getElementById('impact-distance').innerText = `${data.base_time} mins`;
        document.getElementById('impact-traffic').innerText = `+${data.traffic_penalty} mins`;
        document.getElementById('impact-weather').innerText = `+${data.weather_penalty} mins`;

    } catch (e) {
        console.error(e);
        alert("Make sure the Python backend is running!");
    } finally {
        btn.innerText = "Initialize Prediction Sequence";
        btn.style.opacity = "1";
    }
}

// Initialize on load
window.onload = initMap;


function showCustomAlert(message) {
    const alertEl = document.getElementById('custom-alert');
    const msgEl = document.getElementById('alert-message');
    msgEl.innerText = message;
    alertEl.classList.remove('hidden');
    setTimeout(() => {
        alertEl.classList.add('hidden');
    }, 4000);
}
