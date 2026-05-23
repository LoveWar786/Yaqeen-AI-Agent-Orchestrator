/**
 * Haversine formula — straight-line distance in meters between two lat/lng points.
 */
export const calculateStraightLineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metres
};

/**
 * Fetches a driving route from OSRM between two points.
 * Falls back to a straight-line route if the API call fails.
 */
export const fetchOSRMRoute = async (startLat, startLng, endLat, endLng) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map((coords) => ({
        latitude: coords[1],
        longitude: coords[0],
      }));
      const distanceMeters = route.distance;
      const durationSeconds = route.duration;

      const distanceStr =
        distanceMeters < 1000
          ? `${Math.round(distanceMeters)} m`
          : `${(distanceMeters / 1000).toFixed(1)} KM`;
      const durationStr = `${Math.round(durationSeconds / 60)} mins`;

      return { coordinates, distance: distanceStr, duration: durationStr, distanceMeters, durationSeconds };
    }
  } catch (err) {
    console.warn('OSRM routing failed:', err);
  }

  // Fallback: straight-line
  const fallbackDist = calculateStraightLineDistance(startLat, startLng, endLat, endLng);
  return {
    coordinates: [
      { latitude: startLat, longitude: startLng },
      { latitude: endLat, longitude: endLng },
    ],
    distance: `${(fallbackDist / 1000).toFixed(1)} KM`,
    duration: `${Math.round((fallbackDist / 1000) * 2)} mins`,
  };
};
