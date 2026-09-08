const axios = require("axios");

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// =========================================================================
// --- 🚗 OSRM ACTUAL ROAD DISTANCE HELPER (Replaces Straight-Line) ---
// =========================================================================
async function getActualRoadDistance(lat1, lon1, lat2, lon2) {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    
    const response = await axios.get(url, { timeout: 3000 });
    
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const distanceMeters = response.data.routes[0].distance;
      return Number((distanceMeters / 1000).toFixed(3));
    }
  } catch (err) {
    console.warn("⚠️ OSRM API failed, falling back to Haversine with Road Factor:", err.message);
  }

  const straightDist = calculateDistance(lat1, lon1, lat2, lon2);
  return Number((straightDist * 1.35).toFixed(3));
}

// 🌟 Local Distance Calculation with 200 Meters Threshold & Road Factor
function calculateValidDistance(coordinatesList) {
  let straightDistance = 0;

  const MIN_DISTANCE_THRESHOLD = 0.03; // 30 meters
  const ROAD_FACTOR = 1.8; // compulsory road adjustment factor

  for (let i = 1; i < coordinatesList.length; i++) {
    const prev = coordinatesList[i - 1];
    const curr = coordinatesList[i];

    if (
      !Number.isFinite(Number(prev.latitude)) ||
      !Number.isFinite(Number(prev.longitude)) ||
      !Number.isFinite(Number(curr.latitude)) ||
      !Number.isFinite(Number(curr.longitude))
    ) {
      continue;
    }

    const dist = calculateDistance(
      Number(prev.latitude),
      Number(prev.longitude),
      Number(curr.latitude),
      Number(curr.longitude)
    );

    if (dist >= MIN_DISTANCE_THRESHOLD) {
      straightDistance += dist;
    }
  }

  const totalRoadwayDistance = straightDistance * ROAD_FACTOR;

  return Number(totalRoadwayDistance.toFixed(2));
}

module.exports = {
  calculateDistance,
  getActualRoadDistance,
  calculateValidDistance,
};