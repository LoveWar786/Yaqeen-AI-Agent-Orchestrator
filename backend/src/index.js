require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const AntigravityOrchestrator = require('./AntigravityOrchestrator');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const port = process.env.PORT || 4000;

const geminiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.OPENAI_KEY || process.env.API_KEY;
const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_APIKEY || process.env.GOOGLE_MAPS_KEY;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const orchestrator = new AntigravityOrchestrator({ geminiKey, mapsKey });
console.log(`[AUTH] System initialized with Gemini API key: ${geminiKey ? `${geminiKey.substring(0, 8)}...` : 'MISSING'}`);
if (!geminiKey && process.env.MOCK_AI !== 'true') {
  console.warn("[AUTH] GEMINI_API_KEY is missing. Set Vercel env var GEMINI_API_KEY or OPENAI_API_KEY, or enable MOCK_AI=true for local testing.");
}
if (!mapsKey) {
  console.warn("[AUTH] GOOGLE_MAPS_API_KEY is missing. Geocoding will fallback to the offline Pakistani city address generator.");
}

app.post('/api/search', async (req, res) => {
  const { text, locationCoords, context, imageBase64, registeredProviders, bookings } = req.body;
  if (!text && !locationCoords) {
    return res.status(400).json({ error: 'Text or location is required' });
  }

  const result = await orchestrator.searchProviders(text, locationCoords, context, imageBase64, registeredProviders || [], bookings || []);
  // Always return 200 OK so client fetch successfully processes validation errors like TIME_ERROR
  res.json(result);
});

app.post('/api/book', async (req, res) => {
  const { intent, provider } = req.body;
  if (!intent || !provider) {
    return res.status(400).json({ error: 'Intent and provider are required' });
  }

  const result = await orchestrator.confirmBooking(intent, provider);
  // Always return 200 OK so client fetch successfully processes validation/booking errors
  res.json(result);
});

const pakistaniCities = [
  { name: 'Islamabad', lat: 33.6844, lng: 73.0479, address: "Street 4, Sector G-13/1, Islamabad, Pakistan", area: 'G-13/1' },
  { name: 'Rawalpindi', lat: 33.5984, lng: 73.0441, address: "House 24B, Satellite Town, Rawalpindi, Punjab, Pakistan", area: 'Satellite Town' },
  { name: 'Lahore', lat: 31.5204, lng: 74.3587, address: "Main Boulevard, Gulberg III, Lahore, Punjab, Pakistan", area: 'Gulberg III' },
  { name: 'Karachi', lat: 24.8607, lng: 67.0011, address: "Street 15, DHA Phase 6, Karachi, Sindh, Pakistan", area: 'DHA Phase 6' },
  { name: 'Peshawar', lat: 34.0151, lng: 71.5249, address: "Sector F-2, Phase 6, Hayatabad, Peshawar, KPK, Pakistan", area: 'Hayatabad' },
  { name: 'Faisalabad', lat: 31.4504, lng: 73.1350, address: "Susan Road, Kohinoor City, Faisalabad, Punjab, Pakistan", area: 'Susan Road' },
  { name: 'Multan', lat: 30.1575, lng: 71.5249, address: "Bosan Road, Gulgasht Colony, Multan, Punjab, Pakistan", area: 'Gulgasht Colony' },
  { name: 'Quetta', lat: 30.1798, lng: 66.9750, address: "Jinnah Road, Cantonment, Quetta, Balochistan, Pakistan", area: 'Cantonment' },
  { name: 'Sialkot', lat: 32.4972, lng: 74.5361, address: "Kashmir Road, Cantonment, Sialkot, Punjab, Pakistan", area: 'Cantonment' },
  { name: 'Gujranwala', lat: 32.1877, lng: 74.1945, address: "Main Boulevard, DC Colony, Gujranwala, Punjab, Pakistan", area: 'DC Colony' },
  { name: 'Hyderabad', lat: 25.3960, lng: 68.3578, address: "Saddar Bazaar, Hyderabad, Sindh, Pakistan", area: 'Saddar' }
];

const getOfflineAddress = (lat, lng) => {
  let closestCity = pakistaniCities[0];
  let minDistance = Infinity;
  for (const city of pakistaniCities) {
    const dist = Math.sqrt(Math.pow(city.lat - lat, 2) + Math.pow(city.lng - lng, 2));
    if (dist < minDistance) {
      minDistance = dist;
      closestCity = city;
    }
  }
  return closestCity;
};

app.post('/api/geocode', async (req, res) => {
  const { locationCoords } = req.body;
  if (!locationCoords) return res.status(400).json({ error: 'Coords required' });
  
  const getOfflineFallback = () => {
    const closest = getOfflineAddress(locationCoords.lat, locationCoords.lng);
    return {
      address: closest.address,
      city: closest.name,
      area: closest.area
    };
  };

  try {
    const geoRes = await orchestrator.mapsClient.reverseGeocode({
      params: {
        latlng: [locationCoords.lat, locationCoords.lng],
        key: mapsKey,
        language: 'en'
      }
    });
    
    if (geoRes.data.results && geoRes.data.results.length > 0) {
      // Find the best non-plus-code result
      let bestResult = null;
      for (const resObj of geoRes.data.results) {
        if (resObj.types.includes('plus_code')) continue;
        if (resObj.formatted_address.includes('+')) {
          const cleaned = resObj.formatted_address.replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, '');
          if (cleaned.length > 5) {
            bestResult = { ...resObj, formatted_address: cleaned };
            break;
          }
          continue;
        }
        bestResult = resObj;
        break;
      }
      
      if (!bestResult) {
        bestResult = geoRes.data.results[0];
      }

      let city = '';
      let area = '';
      let sublocality = '';
      let neighborhood = '';
      
      bestResult.address_components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('neighborhood')) neighborhood = comp.long_name;
        if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) sublocality = comp.long_name;
      });

      // Sync area
      area = neighborhood || sublocality || '';

      const finalAddress = bestResult.formatted_address.replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, '');

      res.json({ 
        address: finalAddress || 'Unknown Location',
        city: city,
        area: area
      });
    } else {
      res.json(getOfflineFallback());
    }
  } catch (err) {
    console.warn("[GEOCODE GOOGLE KEY INACTIVE / FAILED] - Activating Pakistani Cities Offline Fallback:", err.message);
    res.json(getOfflineFallback());
  }
});

app.post('/api/forward-geocode', async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  try {
    const geoRes = await orchestrator.mapsClient.geocode({
      params: {
        address: address,
        key: mapsKey,
        language: 'en'
      }
    });
    if (geoRes.data.results && geoRes.data.results.length > 0) {
      const loc = geoRes.data.results[0].geometry.location;
      res.json({ 
        lat: loc.lat, 
        lng: loc.lng, 
        formattedAddress: geoRes.data.results[0].formatted_address 
      });
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lookup-shop', async (req, res) => {
  const { query, isLink } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  const result = await orchestrator.lookupShopDetails(query, isLink);
  // Always return 200 to ensure frontend receives valid JSON, success flag will indicate state
  res.json(result);
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }
  try {
    const base64Audio = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'audio/mp4'; 
    
    const promptText = `Please carefully transcribe the following audio. It may be in Urdu, English, or Roman Urdu. Return ONLY the transcribed text, nothing else.`;
    
    const contentToGenerate = [
      { inlineData: { data: base64Audio, mimeType: mimeType } },
      { text: promptText }
    ];

    const result = await orchestrator.generateWithRetry(contentToGenerate);
    res.json({ text: result.trim() });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-push', async (req, res) => {
  const { pushToken, title, body, data } = req.body;
  if (!pushToken) {
    return res.status(400).json({ error: 'pushToken is required' });
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title: title || 'Yaqeen AI',
        body: body || '',
        data: data || {},
      }),
    });

    const responseData = await response.json();
    res.json({ success: true, response: responseData });
  } catch (err) {
    console.error("[PUSH BACKEND ERROR]:", err);
    res.status(500).json({ error: err.message });
  }
});

// Global 404 Handler - Returns JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: `Route ${req.method} ${req.url} not found on Yaqeen Backend.`,
    availableRoutes: ['/api/search', '/api/book', '/api/lookup-shop', '/api/geocode']
  });
});

// Global Error Handler - Prevents HTML error pages on crashes
app.use((err, req, res, next) => {
  console.error("[SERVER_ERROR]:", err);
  res.status(500).json({ 
    success: false, 
    error: "Internal Server Error", 
    message: err.message 
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});

module.exports = app;

