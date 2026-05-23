const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Client } = require('@googlemaps/google-maps-services-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

class AntigravityOrchestrator {
  constructor({ geminiKey, mapsKey } = {}) {
    const resolvedGeminiKey = geminiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.OPENAI_KEY || process.env.API_KEY;
    this.geminiApiKey = resolvedGeminiKey;
    this.genAI = resolvedGeminiKey ? new GoogleGenerativeAI(resolvedGeminiKey) : null;
    this.mapsKey = mapsKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_APIKEY || process.env.GOOGLE_MAPS_KEY;
    this.mapsClient = new Client({});
    this.dbPath = path.join(__dirname, '../db.json');
    this.inMemoryDb = null;
    if (!this.geminiApiKey && process.env.MOCK_AI !== 'true') {
      console.warn("[AUTH] GEMINI_API_KEY is missing. AI generation will fail unless MOCK_AI=true is enabled.");
    }
    if (!this.mapsKey) {
      console.warn("[AUTH] GOOGLE_MAPS_API_KEY is missing. Some geocoding and place lookup features will fallback or fail.");
    }
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify({ bookings: [] }));
      }
    } catch (e) {
      console.warn("[WARN] Could not write default db.json to disk:", e.message);
      this.inMemoryDb = { bookings: [] };
    }
  }

  // Helper for logging trace
  logTrace(trace, step, data) {
    console.log(`[TRACE] ${step}:`, data);
    const logEntry = { step, timestamp: new Date().toISOString(), data };
    trace.push(logEntry);
    // Write to reasoning.log
    try {
      const logFilePath = path.join(__dirname, '../reasoning.log');
      fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (e) {
      console.warn("[WARN] Could not write to reasoning.log (read-only environment):", e.message);
    }
  }

  robustParseJSON(text, fallbackType = null, ...fallbackArgs) {
    if (!text || !text.trim()) {
      console.warn("[robustParseJSON] Empty or blank text provided. Using fallback strategy.");
      return this.buildFallbackJSON(fallbackArgs[0] || "", fallbackType, fallbackArgs);
    }
    let clean = text.trim();
    // If it starts with markdown code block, extract it
    if (clean.includes("```")) {
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        clean = match[1].trim();
      }
    }
    
    // Find the outer bounds of JSON object or array
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');
    
    let startIdx = -1;
    let endIdx = -1;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    }
    
    // Check if both braces and brackets are missing (plain conversational text)
    if (firstBrace === -1 && firstBracket === -1) {
      console.warn("[robustParseJSON] No JSON braces or brackets found in text. Using fallback strategy.");
      return this.buildFallbackJSON(fallbackArgs[0] || clean, fallbackType, fallbackArgs);
    }
    
    // Check for truncated JSON (has open brace/bracket but missing closing brace/bracket)
    if (firstBrace !== -1 && lastBrace === -1) {
      console.warn("[robustParseJSON] Truncated JSON detected. Balancing braces...");
      clean = this.balanceBraces(clean);
    } else if (firstBracket !== -1 && lastBracket === -1) {
      console.warn("[robustParseJSON] Truncated JSON array detected. Balancing brackets...");
      clean = this.balanceBraces(clean);
    } else {
      // If we found indices normally
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        clean = clean.substring(startIdx, endIdx + 1);
      }
    }
    
    try {
      return JSON.parse(clean);
    } catch (err) {
      console.warn("[robustParseJSON] Standard parse failed, attempting robust repair on string of length:", clean.length);
      try {
        const repaired = this.repairJSONString(clean);
        return JSON.parse(repaired);
      } catch (repairErr) {
        console.error("[robustParseJSON] Robust repair also failed. Using fallback strategy. Error:", repairErr.message);
        return this.buildFallbackJSON(fallbackArgs[0] || clean, fallbackType, fallbackArgs);
      }
    }
  }

  balanceBraces(str) {
    let openBraces = [];
    let inString = false;
    let quoteChar = null;
    let escaped = false;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (inString) {
        if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        inString = true;
        quoteChar = char;
        continue;
      }
      if (char === '{' || char === '[') {
        openBraces.push(char);
      } else if (char === '}') {
        if (openBraces[openBraces.length - 1] === '{') {
          openBraces.pop();
        }
      } else if (char === ']') {
        if (openBraces[openBraces.length - 1] === '[') {
          openBraces.pop();
        }
      }
    }
    
    let closed = str;
    while (openBraces.length > 0) {
      const lastOpen = openBraces.pop();
      if (lastOpen === '{') {
        closed += '}';
      } else if (lastOpen === '[') {
        closed += ']';
      }
    }
    return closed;
  }

  buildFallbackJSON(text, fallbackType, fallbackArgs) {
    const textLower = text.toLowerCase();
    
    if (fallbackType === 'intent') {
      let currentAddress = null;
      if (fallbackArgs) {
        if (Array.isArray(fallbackArgs)) {
          currentAddress = fallbackArgs[1] || null;
        } else if (typeof fallbackArgs === 'string') {
          currentAddress = fallbackArgs;
        }
      }

      let service = "UNSUPPORTED"; // Default fallback category to prevent false matches
      const categoryKeywords = {
        "AC Repair": ["ac", "air condition", "split", "compressor", "gas refill", "cool", "cooling", "heating", "ac service", "filtr", "window ac"],
        "Plumbing": ["plumb", "pipe", "leak", "tap", "flush", "washroom", "toilet", "commode", "water tank", "drain", "sewer", "basin", "sink", "faucet", "geyser", "valve", "toti", "nal", "leakage", "water leak"],
        "Electrical": ["electrician", "electrical", "power", "short circuit", "breaker", "fan", "light", "bulb", "switch", "wire", "wiring", "meter", "led", "lcd", "tv", "television", "zap", "charge"],
        "Carpentry": ["carpenter", "carpentry", "door", "wood", "table", "chair", "sofa", "furniture", "lock", "handle", "cabinet", "bed", "larkri", "darwaza", "almari"],
        "Painting": ["painter", "painting", "wall paint", "distemper", "seepage", "putty", "color", "varnish", "wall paper", "paint service", "rang"],
        "Car Wash & Detailing": ["car wash", "detailing", "gari dhona", "polish", "cleaning", "bike wash", "service station", "interior cleaning", "car service"],
        "Appliance Repair": ["fridge", "refrigerator", "oven", "microwave", "washing machine", "dispenser", "stove", "chula", "dryer", "geyser repair", "friz repair", "freezer", "appliances"],
        "Cleaning & Janitorial": ["cleaning", "janitorial", "safai", "sweeper", "maid", "housekeeper", "vacuum", "sofa cleaning", "carpet cleaning", "washroom cleaning", "home cleaning"],
        "Gardening & Landscaping": ["gardener", "gardening", "mali", "grass", "plants", "lawn", "pruning", "weeding", "tree", "flowers"],
        "Pest Control": ["pest control", "fumigation", "termite", "bugs", "cockroach", "spray", "dawa", "khatmal", "chuha", "rodent", "insect"],
        "Home Security & CCTV": ["cctv", "security camera", "camera installation", "dvr", "biometric", "alarm", "security system", "intercom"],
        "Sofa & Upholstery Repair": ["sofa repair", "upholstery", "poshish", "cushion", "curtain installation", "sofa poshish"],
        "Masonry & Construction": ["mason", "brick", "cement", "tile", "marble", "mistri", "mazdoor", "renovation", "concrete", "plaster", "floor", "int", "tahla"],
        "Beauty & Salon Services": ["beauty", "salon", "parlour", "haircut", "makeup", "bridal", "facial", "threading", "manicure", "pedicure", "mehndi", "waxing"],
        "Barber & Grooming": ["barber", "grooming", "haircut", "shave", "trim", "men salon", "hajam", "cutting"],
        "Tailoring & Stitching": ["tailor", "stitching", "darzi", "suit", "clothes", "alteration", "dressmaker", "frock", "shalwar", "kameez"],
        "Tutoring & Education": ["tutor", "tuition", "teacher", "math", "academy", "science", "english class", "ustad", "parhana", "study"],
        "IT & Computer Repair": ["computer", "laptop", "windows", "software", "hardware", "wifi", "router", "networking", "printer", "ram", "ssd", "installation"],
        "Mobile Phone Repair": ["mobile repair", "screen replacement", "iphone", "android", "battery replacement", "charging port", "lcd repair"],
        "Moving & Packers": ["loader", "moving", "shifting", "packers", "transporter", "pickup", "gari rent", "luggage", "furniture shifting"],
        "Automobile Mechanic": ["mechanic", "car repair", "engine", "brakes", "oil change", "tuning", "suspension", "gari kharab", "mobil oil", "clutch"],
        "Generator Repair": ["generator", "ups repair", "battery", "inverter", "generator service", "solar", "solar panel", "ats panel"],
        "Key Maker & Locksmith": ["locksmith", "key maker", "chabi", "lock repair", "darwaza lock", "tala", "duplicate key"],
        "Disinfection & Sanitization": ["disinfection", "sanitization", "spray", "corona spray", "antiviral", "germ protection"]
      };

      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(k => textLower.includes(k))) {
          service = cat;
          break;
        }
      }
      
      let city = "";
      let area = "";
      
      const citiesList = ["karachi", "lahore", "islamabad", "rawalpindi", "hyderabad", "peshawar", "multan", "quetta", "faisalabad", "sialkot", "gujranwala"];
      
      // 1. Scan user text for city keywords
      for (const c of citiesList) {
        if (textLower.includes(c)) {
          city = c.charAt(0).toUpperCase() + c.slice(1);
          break;
        }
      }
      
      // 2. Scan user text for known areas to infer city/area
      if (!city) {
        if (textLower.includes("qasimabad") || textLower.includes("latifabad")) {
          city = "Hyderabad";
          area = textLower.includes("qasimabad") ? "Qasimabad" : "Latifabad";
        } else if (textLower.includes("clifton") || textLower.includes("gulshan") || textLower.includes("jauhar") || textLower.includes("dha")) {
          city = "Karachi";
          area = textLower.includes("clifton") ? "Clifton" : (textLower.includes("gulshan") ? "Gulshan" : "DHA");
        } else if (textLower.includes("g-13") || textLower.includes("h-13") || textLower.includes("f-10") || textLower.includes("g-11")) {
          city = "Islamabad";
          if (textLower.includes("g-13")) area = "G-13";
          else if (textLower.includes("h-13")) area = "H-13";
          else if (textLower.includes("f-10")) area = "F-10";
          else area = "G-11";
        }
      }
      
      // 3. Try to parse from reverse-geocoded currentAddress
      if (currentAddress) {
        const parts = currentAddress.split(',').map(p => p.trim());
        
        // Find city from address if not set
        if (!city && parts.length >= 2) {
          for (let i = parts.length - 1; i >= 0; i--) {
            const partLower = parts[i].toLowerCase();
            for (const c of citiesList) {
              if (partLower.includes(c)) {
                city = c.charAt(0).toUpperCase() + c.slice(1);
                break;
              }
            }
            if (city) break;
          }
        }
        
        // Find area from address if not set
        if (!area && parts.length >= 3) {
          const cityIndex = parts.findIndex(p => p.toLowerCase().includes(city.toLowerCase()));
          if (cityIndex > 0) {
            area = parts[cityIndex - 1];
          } else {
            area = parts[parts.length - 3];
          }
        }
      }
      
      // 4. Default Fallbacks if still empty
      let location = null;
      const hasExplicitLocation = !!city || !!area;
      if (hasExplicitLocation) {
        if (!city) city = "Islamabad";
        if (!area) {
          if (currentAddress) {
            if (city === "Islamabad") area = "G-13";
            else if (city === "Hyderabad") area = "Qasimabad";
            else if (city === "Karachi") area = "Clifton";
            else if (city === "Lahore") area = "DHA";
            else area = "Cantonment";
          } else {
            area = "";
          }
        }
        
        // Ensure area doesn't contain Plus codes
        if (area && area.includes('+')) {
          const parts = area.split(' ');
          area = parts.slice(1).join(' ') || "Main Area";
        }
        
        location = area ? `${area}, ${city}, Pakistan` : `${city}, Pakistan`;
      } else if (currentAddress) {
        location = currentAddress;
      } else {
        city = null;
        area = null;
        location = null;
      }

      // Dynamic Relative Date and Clock Time Parsing in Fallback Mode (Bilingual & Rich)
      let dateStr = "today";
      let clockTime = "";
      let targetDate = new Date();
      
      try {
        const tzOffset = 5 * 60; // Pakistan UTC+5 in minutes
        const localTime = new Date(Date.now() + (new Date().getTimezoneOffset() + tzOffset) * 60 * 1000);
        targetDate = new Date(localTime);
        
        // 1. Resolve Day Offsets (Bilingual: English, Urdu & Roman Urdu)
        if (textLower.includes("day after tomorrow") || textLower.includes("parso") || textLower.includes("parson")) {
          targetDate.setDate(localTime.getDate() + 2);
        } else if (textLower.includes("tomorrow") || textLower.includes("kal") || textLower.includes("next day")) {
          targetDate.setDate(localTime.getDate() + 1);
        } else if (textLower.includes("tarso") || textLower.includes("tarson") || textLower.includes("3 days later") || textLower.includes("in 3 days")) {
          targetDate.setDate(localTime.getDate() + 3);
        } else if (textLower.includes("2 days later") || textLower.includes("in 2 days")) {
          targetDate.setDate(localTime.getDate() + 2);
        } else if (textLower.includes("4 days later") || textLower.includes("in 4 days")) {
          targetDate.setDate(localTime.getDate() + 4);
        } else if (textLower.includes("5 days later") || textLower.includes("in 5 days")) {
          targetDate.setDate(localTime.getDate() + 5);
        } else if (textLower.includes("today") || textLower.includes("aaj") || textLower.includes("now") || textLower.includes("urgent")) {
          targetDate.setDate(localTime.getDate());
        }
        
        dateStr = targetDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (dateErr) {
        console.warn("Date fallback parsing failed:", dateErr.message);
        dateStr = "today";
      }
      
      try {
        const digitalMatch = textLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
        if (digitalMatch) {
          const hours = digitalMatch[1];
          const minutes = digitalMatch[2];
          const ampm = digitalMatch[3] ? digitalMatch[3].toUpperCase() : "";
          clockTime = `${hours}:${minutes} ${ampm}`.trim();
        } else {
          const hourMatch = textLower.match(/(\d{1,2})\s*(am|pm)/);
          if (hourMatch) {
            clockTime = `${hourMatch[1]}:00 ${hourMatch[2].toUpperCase()}`;
          } else {
            // Roman Urdu / Urdu matching like "11 baje", "3 baje"
            const bajeMatch = textLower.match(/(\d{1,2})\s*(baje|baji)/);
            if (bajeMatch) {
              const hr = parseInt(bajeMatch[1], 10);
              let ampm = "AM";
              if (textLower.includes("shaam") || textLower.includes("raat") || textLower.includes("dopahar") || textLower.includes("evening") || textLower.includes("night") || textLower.includes("afternoon")) {
                ampm = "PM";
              } else if (hr < 8) {
                ampm = "PM";
              }
              clockTime = `${hr}:00 ${ampm}`;
            }
          }
        }
        
        if (!clockTime) {
          if (textLower.includes("morning") || textLower.includes("subah")) {
            // Do not assume 10:00 AM. Let the user define what morning is by prompting them.
            clockTime = "";
          } else if (textLower.includes("afternoon") || textLower.includes("dopahar")) {
            clockTime = "2:00 PM";
          } else if (textLower.includes("evening") || textLower.includes("shaam")) {
            clockTime = "6:00 PM";
          } else if (textLower.includes("night") || textLower.includes("tonight") || textLower.includes("raat")) {
            clockTime = "9:00 PM";
          } else {
            // No time keyword found — do NOT assume a default time.
            // Leave clockTime empty so it becomes NOT_SPECIFIED → triggers TIME_ERROR.
            clockTime = "";
          }
        }
      } catch (timeErr) {
        console.warn("Time fallback parsing failed:", timeErr.message);
        clockTime = "";
      }
      
      const timeVal = clockTime ? `${dateStr} at ${clockTime}` : "NOT_SPECIFIED";
      
      return {
        service,
        location,
        city,
        area,
        time: timeVal,
        clockTime: clockTime || null,
        typoSuggestion: null,
        originalTypoWord: null
      };
    }
    
    if (fallbackType === 'rank') {
      let providers = [];
      if (fallbackArgs) {
        if (Array.isArray(fallbackArgs)) {
          if (fallbackArgs.length > 0 && Array.isArray(fallbackArgs[0])) {
            providers = fallbackArgs[0];
          } else {
            providers = fallbackArgs;
          }
        }
      }
      return {
        estimatedPrice: 1500,
        negotiationLog: [],
        negotiationRequired: false,
        selectedProvider: providers[0] || null,
        reasoning: text || "Defaulting to nearest provider due to parsing error."
      };
    }
    
    if (fallbackType === 'shop') {
      let argsList = fallbackArgs;
      if (fallbackArgs && !Array.isArray(fallbackArgs)) {
        argsList = [fallbackArgs, arguments[3], arguments[4], arguments[5]];
      }
      const details = (argsList && argsList[0]) || {};
      const city = (argsList && argsList[1]) || "Islamabad";
      const area = (argsList && argsList[2]) || "G-13";
      const phone = (argsList && argsList[3]) || details.formatted_phone_number || details.international_phone_number || null;
      return {
        name: details.name || "Verified Professional",
        address: details.formatted_address || "Islamabad, Pakistan",
        city: city,
        area: area,
        landmark: null,
        phone: phone,
        shopLink: details.url || null
      };
    }
    
    if (fallbackType === 'link') {
      return {
        name: "Verified Shop",
        city: "Islamabad"
      };
    }
    
    return {
      rawResponse: text
    };
  }

  repairJSONString(str) {
    let result = '';
    let inString = false;
    let quoteChar = null;
    let escaped = false;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        result += char;
        escaped = true;
        continue;
      }
      
      if (inString) {
        if (char === quoteChar) {
          result += '"'; // Always normalize to double quotes
          inString = false;
          quoteChar = null;
        } else if (char === '"' && quoteChar === "'") {
          result += '\\"';
        } else if (char === "'" && quoteChar === '"') {
          result += "'";
        } else if (char === '\n' || char === '\r') {
          result += '\\n';
        } else {
          result += char;
        }
        continue;
      }
      
      if (char === '"' || char === "'") {
        inString = true;
        quoteChar = char;
        result += '"';
        continue;
      }
      
      if (/[a-zA-Z_$]/.test(char)) {
        let word = char;
        let j = i + 1;
        while (j < str.length && /[a-zA-Z0-9_$-]/.test(str[j])) {
          word += str[j];
          j++;
        }
        let k = j;
        while (k < str.length && /\s/.test(str[k])) {
          k++;
        }
        if (k < str.length && str[k] === ':') {
          result += '"' + word + '"';
        } else {
          result += word;
        }
        i = j - 1;
        continue;
      }
      
      if (char === ',') {
        let k = i + 1;
        while (k < str.length && /\s/.test(str[k])) {
          k++;
        }
        if (k < str.length && (str[k] === '}' || str[k] === ']')) {
          i = k - 1;
          continue;
        }
      }
      
      result += char;
    }
    
    return result;
  }

  // Wrapper to handle 503 errors and multimodal content with a delay
  async generateWithRetry(content, maxTokens = 1000) {
    // Check for Mock Mode
    const promptStr = typeof content === 'string' ? content : JSON.stringify(content);
    if (process.env.MOCK_AI === 'true') {
      console.log("[MOCK] Bypassing Gemini API and returning mock response.");
      if (promptStr.includes("Analyze the following user service request")) {
        return JSON.stringify({ service: "AC Repair", location: "G-13, Islamabad, Pakistan", time: "today at 5:00 PM", clockTime: "5:00 PM" });
      }
      return JSON.stringify({ selectedProvider: { name: "Mock Pro Services", rating: 5.0, userRatingsTotal: 100 }, reasoning: "Mock response." });
    }

    if (!this.genAI && process.env.MOCK_AI !== 'true') {
      throw new Error("GEMINI_API_KEY is missing or invalid. Set GEMINI_API_KEY or OPENAI_API_KEY in Vercel environment variables, or enable MOCK_AI=true for testing.");
    }
    const config = { 
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: maxTokens
    };
    const modelName = "gemini-flash-latest"; 
    try {
      const model = this.genAI.getGenerativeModel({ model: modelName, generationConfig: config });
      const result = await model.generateContent(content);
      return result.response.text();
    } catch (err) {
      if (err.message.includes("429")) {
        throw new Error("Gemini API Rate Limit Exceeded. Please enable MOCK_AI=true in your .env file to continue testing offline.");
      }
      if (err.message.includes("404") || err.message.includes("not found")) {
        console.warn(`Model ${modelName} not found. Falling back to gemini-1.5-flash...`);
        const fallbackModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: config });
        const result = await fallbackModel.generateContent(content);
        return result.response.text();
      }
      console.warn(`Gemini ${modelName} failed. Retrying after 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const model = this.genAI.getGenerativeModel({ model: modelName, generationConfig: config });
      const result = await model.generateContent(content);
      return result.response.text();
    }
  }

  async searchProviders(userText, locationCoords, context = null, imageBase64 = null, registeredProviders = [], bookings = []) {
    const trace = [];
    this.logTrace(trace, 'User Request Received', { text: userText, locationCoords, hasContext: !!context, hasImage: !!imageBase64 });

    try {
      let currentAddress = null;
      if (locationCoords && locationCoords.lat && locationCoords.lng && this.mapsKey) {
        try {
          const geoRes = await this.mapsClient.reverseGeocode({
            params: {
              latlng: [locationCoords.lat, locationCoords.lng],
              key: this.mapsKey,
              language: 'en'
            }
          });
          if (geoRes && geoRes.data && geoRes.data.results && geoRes.data.results.length > 0) {
            currentAddress = geoRes.data.results[0].formatted_address;
            this.logTrace(trace, 'Reverse Geocoding', { currentAddress });
          }
        } catch (e) {
          console.warn("Reverse geocoding failed (Maps API error):", e.message);
          this.logTrace(trace, 'Reverse Geocode Failed', { error: e.message });
        }
      }
      // 1. Intent Extraction
      let intent;
      try {
        intent = await this.extractIntent(userText || "Find a provider near me", currentAddress, context, imageBase64);
      } catch (err) {
        console.error("[searchProviders] extractIntent failed, using fallback:", err.message);
        intent = this.buildFallbackJSON(userText || "", 'intent', currentAddress);
      }
      
      // Normalize intent keys to be case-insensitive and robust
      if (intent && typeof intent === 'object') {
        const normalizedIntent = {};
        for (const [key, value] of Object.entries(intent)) {
          normalizedIntent[key.toLowerCase()] = value;
        }
        intent = {
          service: normalizedIntent.service,
          serviceMode: normalizedIntent.servicemode || normalizedIntent.service_mode || 'HOME',
          location: normalizedIntent.location,
          city: normalizedIntent.city,
          area: normalizedIntent.area,
          time: normalizedIntent.time,
          clockTime: normalizedIntent.clocktime || normalizedIntent.clock_time,
          typoSuggestion: normalizedIntent.typosuggestion || normalizedIntent.typo_suggestion || null,
          originalTypoWord: normalizedIntent.originaltypoword || normalizedIntent.original_typo_word || null,
          diagnosticNotes: normalizedIntent.diagnosticnotes || normalizedIntent.diagnostic_notes || null,
          landmark: normalizedIntent.landmark || null,
          customerCoords: normalizedIntent.customercoords || normalizedIntent.customer_coords || intent.customerCoords
        };
      }

      if (!intent || !intent.service || !intent.location) {
        intent = this.buildFallbackJSON(userText || "", 'intent', currentAddress);
      }
      this.logTrace(trace, 'Intent Extraction', intent);

      if (intent.typoSuggestion && intent.originalTypoWord) {
        this.logTrace(trace, 'Typo Detected', intent);
        return { 
          success: false, 
          error: 'TYPO_DETECTED', 
          typoSuggestion: intent.typoSuggestion, 
          originalTypoWord: intent.originalTypoWord, 
          trace 
        };
      }

      // --- LOCATION RECOVERY: If location is too broad or missing, try to recover from city/area/landmark ---
      if (intent.location === "LOCATION_TOO_BROAD" || !intent.location || String(intent.location).toLowerCase() === 'null') {
        const hasCity = intent.city && intent.city.length > 1;
        const hasArea = intent.area && intent.area.length > 1;
        const hasLandmark = intent.landmark && intent.landmark.length > 1;

        // If GPS is disabled (locationCoords is missing) and they provided a broad city
        // but DID NOT provide a specific area or landmark, reject the request to prevent
        // assuming default areas like "DHA Lahore".
        if (!locationCoords && hasCity && !hasArea && !hasLandmark) {
          this.logTrace(trace, 'Validation Error', 'Broad city provided but specific Area or Landmark is missing (GPS disabled).');
          return { success: false, error: 'SPECIFIC_LOCATION_MISSING', trace };
        }

        if (hasCity || hasArea || hasLandmark) {
          // Rebuild location from available fields
          const locationParts = [];
          if (hasLandmark) locationParts.push(intent.landmark);
          if (hasArea) locationParts.push(intent.area);
          if (hasCity) locationParts.push(intent.city);
          locationParts.push('Pakistan');
          intent.location = locationParts.join(', ');
          this.logTrace(trace, 'Location Recovered from City/Area/Landmark', { recoveredLocation: intent.location, city: intent.city, area: intent.area, landmark: intent.landmark });
        } else {
          // No location context at all — return error
          this.logTrace(trace, 'Validation Error', 'No location context found (no coordinates, no city, no area, no landmark).');
          return { success: false, error: 'NO_LOCATION', trace };
        }
      }

      if (intent.time === "PAST_TIME_ERROR") {
        return { success: false, error: 'PAST_TIME_ERROR', searchResult: { intent }, trace };
      }

      if (!intent.time || String(intent.time).toLowerCase() === 'null' || String(intent.time).toLowerCase() === 'unknown' || String(intent.time).toLowerCase() === 'not_specified' || String(intent.time).toLowerCase() === 'time_error') {
        return { success: false, error: 'TIME_ERROR', searchResult: { intent }, trace };
      }
      if (intent.time === "AM_PM_MISSING") {
        return { success: false, error: 'AM_PM_MISSING', searchResult: { intent }, trace };
      }

      // 2. Provider Discovery
      let providers = [];
      const normalize = (s) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      
      const stopWords = new Set(["repair", "repairing", "services", "service", "in", "at", "near", "and", "the", "a", "an", "of", "need", "find", "best", "good", "reliable", "shop", "me", "work", "job", "help", "want", "looking", "for", "my", "please", "can", "you", "get", "hai", "chahiye", "wala", "karo", "karo", "karwana", "bulao"]);
      const getQueryWords = (q) => {
        if (!q) return [];
        return q.toLowerCase().split(/[\s,./-]+/).filter(w => w.length > 1 && !stopWords.has(w));
      };

      const userQueryWords = getQueryWords(userText);
      const serviceQueryWords = getQueryWords(intent.service && intent.service !== 'UNSUPPORTED' ? intent.service : '');
      const allQueryWords = [...new Set([...userQueryWords, ...serviceQueryWords])];

      const matchedRegistered = registeredProviders.filter(rp => {
        if (rp.role !== 'provider') return false;
        
        // Match city if specified and valid
        const rpCity = normalize(rp.city);
        const intentCity = normalize(intent.city);
        if (rpCity && intentCity && rpCity !== intentCity) return false;
        
        let serviceMatch = false;

        // 1. Direct canonical service match in services object
        if (intent.service && rp.services && typeof rp.services === 'object') {
          const serviceNorm = normalize(intent.service);
          serviceMatch = Object.keys(rp.services).some(k => {
            const kNorm = normalize(k);
            return kNorm.includes(serviceNorm) || serviceNorm.includes(kNorm);
          });
        }

        // 2. Direct canonical service match in shop name / provider name
        // Use word-boundary regex on the ORIGINAL name (not normalized) to prevent
        // false matches like "Beauty Space Salon" matching "AC" due to substring "spACe"
        if (!serviceMatch && intent.service) {
          const originalName = (rp.shopName || rp.name || '').toLowerCase();
          const serviceWords = intent.service.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
          // Require ANY significant service word to appear as a whole word in the name
          if (serviceWords.length > 0) {
            const allWordsMatch = serviceWords.some(sw => {
              // Escape special regex characters in the service word
              const escaped = sw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return new RegExp(`\\b${escaped}\\b`, 'i').test(originalName);
            });
            if (allWordsMatch) {
              serviceMatch = true;
            }
          }
        }

        // 3. Significant-word overlap logic (allows "TV Repair" to match "Dirya Khan TV LCD Shop")
        if (!serviceMatch && allQueryWords.length > 0) {
          const shopNameStr = (rp.shopName || rp.name || '').toLowerCase();
          const branchStr = (rp.branch || '').toLowerCase();
          const primarySkillStr = (rp.primarySkill || '').toLowerCase();
          const servicesListStr = (rp.servicesList || '').toLowerCase();
          const servicesKeysStr = rp.services && typeof rp.services === 'object'
            ? Object.keys(rp.services).join(' ').toLowerCase()
            : '';
          const targetText = `${shopNameStr} ${branchStr} ${primarySkillStr} ${servicesListStr} ${servicesKeysStr}`;

          // Filter out location words (city names, area codes) from query — they shouldn't influence service matching
          const locationStopWords = new Set(['islamabad', 'lahore', 'karachi', 'rawalpindi', 'hyderabad', 'peshawar', 'multan', 'quetta', 'faisalabad', 'sialkot', 'gujranwala', 'dha', 'bahria', 'gulberg', 'johar', 'model', 'town', 'cantt', 'cantonment', 'saddar', 'clifton', 'gulshan', 'pakistan']);
          const serviceQueryWordsOnly = allQueryWords.filter(w => w.length >= 2 && !locationStopWords.has(w) && !/^\d+$/.test(w));
          
          if (serviceQueryWordsOnly.length > 0) {
            const hasOverlap = serviceQueryWordsOnly.some(qw => {
              const escaped = qw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return new RegExp(`\\b${escaped}\\b`, 'i').test(targetText);
            });
            if (hasOverlap) {
              serviceMatch = true;
            }
          }
        }
        
        return serviceMatch;
      });

      // --- COORDINATE RESOLUTION with multi-layer fallback ---
      // Known city center coordinates for offline fallback when API fails
      const CITY_CENTER_COORDS = {
        islamabad: { lat: 33.6844, lng: 73.0479 },
        rawalpindi: { lat: 33.5651, lng: 73.0169 },
        lahore: { lat: 31.5204, lng: 74.3587 },
        karachi: { lat: 24.8607, lng: 67.0011 },
        multan: { lat: 30.1575, lng: 71.5249 },
        peshawar: { lat: 34.0151, lng: 71.5249 },
        faisalabad: { lat: 31.4504, lng: 73.1350 },
        hyderabad: { lat: 25.3960, lng: 68.3578 },
        quetta: { lat: 30.1798, lng: 66.9750 },
        sialkot: { lat: 32.4945, lng: 74.5229 },
        gujranwala: { lat: 32.1877, lng: 74.1945 }
      };

      let userLat = locationCoords?.lat || 33.6493;
      let userLng = locationCoords?.lng || 72.9806;
      let userCoords = locationCoords;
      let geocodeSucceeded = false;

      if (!locationCoords && intent.location && intent.location !== "LOCATION_TOO_BROAD") {
        // Layer 1: Try Google Maps Geocoding API (only if key exists)
        if (this.mapsKey) {
          try {
            const geoRes = await this.mapsClient.geocode({
              params: {
                address: intent.location,
                key: this.mapsKey
              }
            });
            if (geoRes && geoRes.data && geoRes.data.results && geoRes.data.results.length > 0) {
              userLat = geoRes.data.results[0].geometry.location.lat;
              userLng = geoRes.data.results[0].geometry.location.lng;
              userCoords = { lat: userLat, lng: userLng };
              geocodeSucceeded = true;
              this.logTrace(trace, 'Geocoded Fallback Coordinates', { userLat, userLng });
            }
          } catch(e) {
            console.warn("Geocode fallback failed (Maps API error):", e.message);
            this.logTrace(trace, 'Geocode Failed', { error: e.message, hadKey: !!this.mapsKey });
          }
        } else {
          console.warn("Geocode fallback skipped: no Google Maps API key available");
        }

        // Layer 2: If geocoding API failed, use known city center coordinates
        if (!geocodeSucceeded && intent.city) {
          const cityKey = intent.city.toLowerCase().trim();
          const cityCoords = CITY_CENTER_COORDS[cityKey];
          if (cityCoords) {
            userLat = cityCoords.lat;
            userLng = cityCoords.lng;
            userCoords = { lat: userLat, lng: userLng };
            this.logTrace(trace, 'Using City Center Coordinates (API fallback)', { city: intent.city, userLat, userLng });
          } else {
            this.logTrace(trace, 'Unknown City — Using Default Islamabad Coordinates', { city: intent.city });
          }
        }
      } else if (locationCoords) {
        // User provided device coordinates — use them directly
        userLat = locationCoords.lat;
        userLng = locationCoords.lng;
      }
      
      intent.customerCoords = userCoords;

      if (matchedRegistered.length === 0) {
        this.logTrace(trace, 'No Registered Providers found', 'Stopping search.');
        return { success: false, error: 'NO_REGISTERED_PROVIDERS', trace };
      }

      providers = matchedRegistered.map(p => {
        let pLat = Number(p.latitude) || Number(p.locationCoords?.lat) || userLat;
        let pLng = Number(p.longitude) || Number(p.locationCoords?.lng) || userLng;
        
        const dLat = (pLat - userLat) * Math.PI / 180;
        const dLon = (pLng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = 6371 * c; // km
        
        // Determine if this service is explicitly added to this provider's services object
        let hasExplicitService = false;
        let customMin = null;
        let customMax = null;
        if (p.services && typeof p.services === 'object') {
          const serviceKey = Object.keys(p.services).find(k => {
            const kNorm = normalize(k);
            const serviceNorm = normalize(intent.service);
            return kNorm.includes(serviceNorm) || serviceNorm.includes(kNorm);
          });
          if (serviceKey) {
            hasExplicitService = true;
            customMin = Number(p.services[serviceKey].minPrice);
            customMax = Number(p.services[serviceKey].maxPrice);
          }
        }

        return {
          name: p.shopName || p.name || "Verified Professional",
          address: p.shopAddress || p.address || "Islamabad, Pakistan",
          rating: Number(p.rating) || 4.8,
          userRatingsTotal: Number(p.userRatingsTotal) || 82,
          openNow: true,
          placeId: `reg_${p.uid}`,
          lat: pLat,
          lng: pLng,
          distanceText: `${dist.toFixed(1)} km`,
          distanceValue: dist * 1000,
          isRegistered: true,
          uid: p.uid,
          globalMinPrice: Number(p.minPrice) || 1000,
          globalMaxPrice: Number(p.maxPrice) || 5000,
          visitingCharges: Number(p.visitingCharges) || 0,
          branch: p.branch || '',
          minPrice: hasExplicitService ? (customMin || Number(p.minPrice) || 1000) : 0,
          maxPrice: hasExplicitService ? (customMax || Number(p.maxPrice) || 5000) : 0,
          hasExplicitService: hasExplicitService
        };
      });
      
      providers.sort((a, b) => a.distanceValue - b.distanceValue);
      this.logTrace(trace, 'Local Registered Provider Discovery', { providersFound: providers.length });

      // 3. Matching & Ranking
      let decision;
      try {
        decision = await this.matchAndRank(intent, providers);
      } catch (err) {
        console.error("[searchProviders] matchAndRank failed, using fallback:", err.message);
        decision = this.buildFallbackJSON("", 'rank', providers);
      }
      
      if (!decision) {
        decision = this.buildFallbackJSON("", 'rank', providers);
      }

      // Normalize decision keys to lowercase to be case-insensitive and robust
      if (decision && typeof decision === 'object') {
        const normalizedDecision = {};
        for (const [key, value] of Object.entries(decision)) {
          normalizedDecision[key.toLowerCase()] = value;
        }
        decision = {
          estimatedPrice: Number(normalizedDecision.estimatedprice || normalizedDecision.estimated_price) || 0,
          negotiationLog: normalizedDecision.negotiationlog || normalizedDecision.negotiation_log || [],
          negotiationRequired: normalizedDecision.negotiationrequired !== undefined ? !!(normalizedDecision.negotiationrequired || normalizedDecision.negotiation_required) : false,
          proposedTime: normalizedDecision.proposedtime || normalizedDecision.proposed_time,
          selectedProvider: normalizedDecision.selectedprovider || normalizedDecision.selected_provider,
          reasoning: normalizedDecision.reasoning
        };
      }

      // Map/Match selectedProvider back to the original full provider object from providers array
      if (decision && decision.selectedProvider) {
        const aiProvider = decision.selectedProvider;
        let originalProvider;
        
        if (typeof aiProvider === 'string') {
          originalProvider = providers.find(p => 
            (p.uid && String(p.uid) === aiProvider) ||
            (p.placeId && String(p.placeId) === aiProvider) ||
            (p.name && p.name.toLowerCase() === aiProvider.toLowerCase())
          );
        } else if (typeof aiProvider === 'object') {
          originalProvider = providers.find(p => 
            (p.uid && aiProvider.uid && String(p.uid) === String(aiProvider.uid)) ||
            (p.placeId && aiProvider.placeId && String(p.placeId) === String(aiProvider.placeId)) ||
            (p.name && aiProvider.name && p.name.toLowerCase() === aiProvider.name.toLowerCase())
          );
        }
        
        if (originalProvider) {
          // Merge enriched properties but keep all core database values of the original object
          decision.selectedProvider = {
            ...originalProvider,
            estimatedPrice: decision.estimatedPrice || originalProvider.estimatedPrice,
            proposedTime: decision.proposedTime || originalProvider.proposedTime
          };
        } else if (providers.length > 0) {
          decision.selectedProvider = providers[0];
        }
      } else if (providers.length > 0) {
        decision.selectedProvider = providers[0];
      }

      this.logTrace(trace, 'Matching and Ranking', decision);

      if (decision.selectedProvider) {
        const conflictCheck = this.checkProviderAvailabilityAndConflicts(
          decision.selectedProvider, 
          intent.time || decision.proposedTime, 
          bookings
        );
        if (!conflictCheck.success) {
          return {
            success: false,
            error: 'PROVIDER_UNAVAILABLE',
            providerName: decision.selectedProvider.name || decision.selectedProvider.shopName,
            providerUid: decision.selectedProvider.uid,
            trace
          };
        }
      }

      return {
        success: true,
        trace,
        searchResult: {
          intent,
          provider: decision.selectedProvider,
          reasoning: decision.reasoning,
          estimatedPrice: decision.estimatedPrice,
          negotiationLog: decision.negotiationLog,
          negotiationRequired: decision.negotiationRequired,
          proposedTime: decision.proposedTime,
          allProviders: providers
        }
      };

    } catch (error) {
      this.logTrace(trace, 'Error', { message: error.message });
      return { success: false, trace, error: error.message };
    }
  }

  checkProviderAvailabilityAndConflicts(provider, bookingTimeStr, bookings) {
    if (!bookingTimeStr) return { success: true }; // No specific time requested
    if (!provider || !provider.availability) return { success: true }; // No availability configured

    try {
      // 1. Parse booking time
      // Assume time like "05:00 PM" or "Tomorrow at 10 AM"
      // We will do a basic extraction of hour and AM/PM for checking.
      // Also check day of week if specified (e.g. "Monday", "Today")
      // To keep it robust, we'll convert both to a unified Date object or string comparison.
      
      const requestedTime = this.parseRequestedTime(bookingTimeStr);
      if (!requestedTime) return { success: true }; // Couldn't parse, allow it

      // 2. Check Working Days
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const reqDay = dayNames[requestedTime.getDay()];
      if (provider.availability.workingDays && provider.availability.workingDays.length > 0) {
        if (!provider.availability.workingDays.includes(reqDay)) {
          return { success: false, reason: 'day_off' };
        }
      }

      // 3. Check Working Hours
      if (provider.availability.startTime && provider.availability.endTime) {
        const parseProviderTime = (timeStr) => {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return null;
          let hr = parseInt(match[1]);
          const min = parseInt(match[2]);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hr < 12) hr += 12;
          if (ampm === 'AM' && hr === 12) hr = 0;
          return hr * 60 + min;
        };
        const startMins = parseProviderTime(provider.availability.startTime);
        const endMins = parseProviderTime(provider.availability.endTime);
        const reqMins = requestedTime.getHours() * 60 + requestedTime.getMinutes();
        if (startMins !== null && endMins !== null) {
          if (reqMins < startMins || reqMins > endMins) {
            return { success: false, reason: 'outside_hours' };
          }
        }
      }

      // 4. Check Overlaps (Within 1 hour)
      const providerBookings = bookings.filter(b => b.providerId === provider.uid && ['CONFIRMED', 'NEGOTIATING', 'DISPATCHED'].includes(b.status));
      for (const b of providerBookings) {
        if (!b.time) continue;
        const bTime = this.parseRequestedTime(b.time);
        if (bTime) {
          const diffHours = Math.abs(bTime.getTime() - requestedTime.getTime()) / (1000 * 60 * 60);
          if (diffHours < 1) {
            return { success: false, reason: 'overlap' };
          }
        }
      }

      return { success: true };
    } catch (err) {
      console.warn("Conflict check failed:", err.message);
      return { success: true }; // Fail open
    }
  }

  parseRequestedTime(timeStr) {
    if (!timeStr) return null;
    
    // 1. Clean up day of week (e.g. "Thursday, May 21, 2026")
    let cleanStr = timeStr.replace(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday),?\s+/i, '');
    
    // 2. Replace "at" with space
    cleanStr = cleanStr.replace(/\s+at\s+/i, ' ');
    
    // 3. Pre-format hours without minutes: e.g. "8 AM" -> "8:00 AM"
    cleanStr = cleanStr.replace(/(^|[^:])\b(\d{1,2})\s*(am|pm)\b/gi, (match, prefix, num, ampm) => {
      return prefix + num + ":00 " + ampm;
    });
    
    // 4. Try native Date.parse
    const nativeParsed = Date.parse(cleanStr);
    if (!isNaN(nativeParsed)) {
      return new Date(nativeParsed);
    }
    
    // Custom regex fallback for "Month Day, Year Hour:Min AM/PM"
    const regex = /([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?/i;
    const match = cleanStr.match(regex);
    if (match) {
      const monthStr = match[1].toLowerCase();
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      let hr = parseInt(match[4], 10);
      const min = match[5] ? parseInt(match[5], 10) : 0;
      const sec = match[6] ? parseInt(match[6], 10) : 0;
      const ampm = match[7] ? match[7].toLowerCase() : '';
      
      const months = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
        oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
      };
      
      if (months[monthStr] !== undefined) {
        const month = months[monthStr];
        if (ampm === 'pm' && hr < 12) hr += 12;
        if (ampm === 'am' && hr === 12) hr = 0;
        
        const d = new Date(year, month, day, hr, min, sec, 0);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    }

    // 5. Fallback to original parsing if not an absolute date string
    const now = new Date();
    const simpleMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!simpleMatch) return null;
    
    let hr = parseInt(simpleMatch[1]);
    const min = parseInt(simpleMatch[2] || "0");
    const ampm = simpleMatch[3].toUpperCase();
    
    if (ampm === 'PM' && hr < 12) hr += 12;
    if (ampm === 'AM' && hr === 12) hr = 0;

    const d = new Date(now);
    if (timeStr.toLowerCase().includes('tomorrow') || timeStr.toLowerCase().includes('kal')) {
      d.setDate(d.getDate() + 1);
    }
    
    d.setHours(hr, min, 0, 0);
    return d;
  }

  async confirmBooking(intent, provider) {
    const trace = [];
    this.logTrace(trace, 'Booking Confirmation Started', { intent, provider });

    try {
      // 4. Action Simulation (Booking)
      const booking = await this.simulateBooking(intent, provider);
      this.logTrace(trace, 'Action Simulation', booking);

      // 5. Follow-Up Automation
      const followUp = this.scheduleFollowUp(booking);
      this.logTrace(trace, 'Follow-Up Automation', followUp);

      return {
        success: true,
        trace,
        bookingResult: {
          booking,
          followUp
        }
      };
    } catch (error) {
      this.logTrace(trace, 'Error', { message: error.message });
      return { success: false, trace, error: error.message };
    }
  }

  async extractIntent(text, currentAddress, context = null, imageBase64 = null) {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentTimeStr = today.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let contextStr = currentAddress ? `The user's current GPS location is: ${currentAddress}. ` : 'No GPS location provided. ';
    if (context) {
      contextStr += `Previous partial context (use these if new text is missing them): Service: ${context.service || 'None'}, Location: ${context.location || 'None'}, Time: ${context.time || 'None'}. `;
    }
    
    const promptText = `
      Today's date context: Today is ${todayStr}. The current time right now is ${currentTimeStr} (Pakistan Standard Time).
      User Location & App Context: ${contextStr}
      
      Analyze the following user service request in English, Urdu, or Roman Urdu.
      If an image is provided, act as a diagnostician. Deduce the exact service needed based on the image (e.g. leaking AC = AC Repair, broken pipe = Plumbing) and combine it with the text.
      
      Extraction Guidelines:
      1. 'service': Extract the exact natural language service the user requested (e.g. 'Beauty Parlour', 'Car Wash', 'AC Repair'). DO NOT use "UNSUPPORTED". DO NOT include dates, times, relative terms, typos, or business/person names.
      2. 'time': Extract the time ONLY from what the user explicitly stated. NEVER invent, assume, or default a time that the user did not mention. Convert relative time expressions (such as "today", "tomorrow", "day after tomorrow", "2 days later", including expressions with typos like "tomorrow a 6pm") into a standardized absolute date and time string using ${todayStr} as the anchor date. 
         - Handle Urdu/Roman Urdu time expressions: "kal"=tomorrow, "aaj"=today, "parso"=day after tomorrow, "dopahar"=afternoon (2:00 PM), "shaam"=evening (6:00 PM), "raat"=night (9:00 PM), "baje"=o'clock (e.g. "3 baje"=3 o'clock).
         - Handle numeric times with AM/PM: "10 AM", "11 AM", "5 PM", "2:30 PM", etc.
         - PRIORITY RULE: If BOTH a relative time AND an explicit numeric time are mentioned (e.g., "tomorrow morning 8 am"), ALWAYS prefer the explicit numeric time. Use the numeric time as the final answer (e.g., "8 am" takes precedence over "morning").
         - DO NOT assume a default like 10:00 AM if the user mentions "morning" or "subah" without a numeric/exact clock time (like 8:00 AM). Instead, treat it as ambiguous/incomplete and set the 'time' key strictly to "NOT_SPECIFIED".
         - Example: If today is Wednesday, May 21, 2026, and the request says "tomorrow at 5 PM" or "tomorrow 10 AM", the extracted 'time' MUST be "Thursday, May 22, 2026 at 5:00 PM" or "Thursday, May 22, 2026 at 10:00 AM" respectively. If request says "tomorrow morning 8 am", extract as "Thursday, May 22, 2026 at 8:00 AM". If the request says "tomorrow morning" or "kal subah" without any numeric time, set 'time' key strictly to "NOT_SPECIFIED".
         - If the user specifies a time or relative date in the past (e.g. "yesterday", "2 days ago", "last Sunday", "kal agla"), set the 'time' key strictly to "PAST_TIME_ERROR".
         - If a time is mentioned but is ambiguous without AM/PM or a clear period (e.g. "at 6" without am/pm, "3 baje" without context), set the 'time' key strictly to "AM_PM_MISSING".
         - CRITICAL: If NO time is mentioned at all, return "NOT_SPECIFIED" as the time value (never return null or empty string).
      3. 'clockTime': Extract strictly the 12-hour format clock time (e.g., "6:00 PM", "10:30 AM"). If 'time' is "NOT_SPECIFIED", 'clockTime' must be null.
      4. 'location': Constraint: Ensure the location is scoped to Pakistan.
         - If the location provided is just a city name (e.g. 'Lahore', 'Karachi') without a specific area, set the 'location' key strictly to "LOCATION_TOO_BROAD".
         - If the location is specific like 'G-13', format it as 'G-13, Islamabad, Pakistan'.
      5. 'city' and 'area': Extract into separate keys. If the user explicitly mentions a city like 'Hyderabad', ensure 'city' is set to 'Hyderabad' and NOT defaulted.
      6. 'typoSuggestion' and 'originalTypoWord': Perform a strict spelling and grammar check on the user's service and time inputs. 
         - If the user has made a spelling error or typo (e.g. "Techician", "electrican", "Plumbir"), set 'typoSuggestion' to the fully corrected service category term (e.g., "AC Technician", "Electrician", "Plumber") and set 'originalTypoWord' to the exact misspelled word in the user's request.
         - If there are no typos, set both keys to null.

      7. 'serviceMode': Extract whether the service is 'HOME' (Provider comes to Customer) or 'SHOP' (Customer goes to Provider's shop). Default to 'HOME' if unclear.

      Return exactly a JSON object with keys: service, serviceMode, location, city, area, time, clockTime, typoSuggestion, originalTypoWord, diagnosticNotes (if image analyzed).
      Request: "${text}"
    `;

    let contentToGenerate = promptText;
    if (imageBase64) {
      // Clean base64 prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contentToGenerate = [
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
        { text: promptText }
      ];
    }

    const responseText = await this.generateWithRetry(contentToGenerate, 300);
    return this.robustParseJSON(responseText, 'intent', text, currentAddress);
  }

  async discoverProviders(service, location, userCoords = null) {
    // We use Text Search because it handles "service in location" nicely.
    const query = `${service} in ${location}`;
    try {
      if (!this.mapsKey) {
        console.warn("Google Maps API key missing. Using fallback mock data.");
        throw new Error("Maps API key not configured");
      }

      const response = await this.mapsClient.textSearch({
        params: {
          query: query,
          key: this.mapsKey,
        }
      });

      if (!response || !response.data || !response.data.results) {
        console.warn("Invalid textSearch response structure");
        throw new Error("Invalid response from Maps API");
      }

      // Map to a simplified provider object
      let providers = response.data.results.map(place => ({
        name: place.name,
        address: place.formatted_address,
        rating: place.rating || 'N/A',
        userRatingsTotal: place.user_ratings_total || 0,
        openNow: place.opening_hours ? place.opening_hours.open_now : 'Unknown',
        placeId: place.place_id,
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng
      }));

      // Calculate distances using extremely fast local Haversine calculation!
      const userLat = userCoords?.lat || 33.6493;
      const userLng = userCoords?.lng || 72.9806;

      providers = providers.map(p => {
        const pLat = Number(p.lat) || userLat;
        const pLng = Number(p.lng) || userLng;
        const dLat = (pLat - userLat) * Math.PI / 180;
        const dLon = (pLng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = 6371 * c; // km
        return {
          ...p,
          distanceText: `${dist.toFixed(1)} km`,
          distanceValue: dist * 1000
        };
      });

      return providers;
    } catch (err) {
      console.warn("Google Maps API failed (403). Falling back to Mock Data.");
      return [
        {
          name: "Ali AC Services",
          address: "Shop 4, G-13 Markaz, Islamabad, Pakistan",
          rating: 4.8,
          userRatingsTotal: 124,
          openNow: true,
          placeId: "mock_1",
          distanceText: "2.1 km",
          distanceValue: 2100,
          lat: 33.6493,
          lng: 72.9806
        },
        {
          name: "Cool Breeze AC Repair",
          address: "G-13/1, Islamabad, Pakistan",
          rating: 4.2,
          userRatingsTotal: 45,
          openNow: true,
          placeId: "mock_2",
          distanceText: "4.5 km",
          distanceValue: 4500,
          lat: 33.6450,
          lng: 72.9750
        },
        {
          name: "Imran Electronics & AC",
          address: "G-13/4, Islamabad, Pakistan",
          rating: 4.9,
          userRatingsTotal: 210,
          openNow: false,
          placeId: "mock_3",
          distanceText: "1.2 km",
          distanceValue: 1200
        }
      ];
    }
  }

  async matchAndRank(intent, providers) {
    const prompt = `
      You are an AI autonomous negotiation broker acting on behalf of a customer.
      User Intent: Service: ${intent.service}, Location: ${intent.location}, Time: ${intent.time} (Clock: ${intent.clockTime}).
      Available Providers:
      ${JSON.stringify(providers.slice(0, 5), null, 2)}
      
      Task 1: Estimate a fair market price for this service in PKR (e.g. 1500).
      CRITICAL SERVICE-SPECIFIC RULES FOR ESTIMATED PRICE:
      - Carefully check if the selected provider has 'hasExplicitService: false'.
      - If 'hasExplicitService' is false, it means they do NOT offer the specific service under their registered sub-services list. In this case:
        1. Set the 'estimatedPrice' strictly to 0.
        2. Set the 'reasoning' string strictly to explicitly inform the user that the requested service is not listed by this provider, so only their visiting charges of Rs. X will be charged for diagnosis/inspection (where X is the provider's visitingCharges).
      - If 'hasExplicitService' is true (or not specified), estimate a fair market price for the service itself between their minPrice and maxPrice.

      Task 2: Select the absolute best provider based on rating and relevance.
      Give strong preference to providers who are registered (isRegistered: true).
      Task 3: Simulate a negotiation log. 
      CRITICAL Rules for Price Negotiation:
      - For the selected provider, they will strictly NOT accept any offer below their specific "minPrice" PKR.
      - Make sure the negotiation log negotiates and starts a bit lower but accepts a price between their specific "minPrice" and "maxPrice" PKR.
      - If they are NOT registered, their acceptable price range is 1000 to 5000 PKR.
      - NEVER accept a price below a provider's specific "minPrice".
      
      Example log:
      [{"provider": "Provider A", "price": 2000, "status": "Too high"}, {"provider": "Provider B", "price": 1500, "status": "Accepted"}]
      
      Task 4: (Agentic Behavior) Decide if a Multi-Turn Negotiation is required. 
      This is strictly forbidden. You MUST ALWAYS set 'negotiationRequired' to false and NEVER suggest alternative times or enter a negotiation state.

      Return exactly a JSON object with keys: 
      - estimatedPrice (number)
      - negotiationLog (array of objects: provider (string), price (number), status (string))
      - negotiationRequired (boolean)
      - proposedTime (string, optional, only if negotiationRequired is true)
      - selectedProvider (the exact provider object chosen from the list, including all its enriched fields: isRegistered, uid, branch, visitingCharges, minPrice, maxPrice, etc.)
      - reasoning (a short string explaining the choice, the price, and any negotiation outcome)
    `;
    const responseText = await this.generateWithRetry(prompt, 600);
    return this.robustParseJSON(responseText, 'rank', providers);
  }


  async simulateBooking(intent, provider) {
    const booking = {
      id: 'BKG-' + Math.floor(Math.random() * 1000000),
      service: intent.service,
      time: provider.proposedTime || intent.time || intent.clockTime,
      providerName: provider.name,
      providerAddress: provider.address,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };

    // Save to local JSON db to simulate database
    let db;
    if (this.inMemoryDb) {
      db = this.inMemoryDb;
    } else {
      try {
        db = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      } catch (e) {
        console.warn("[WARN] Could not read db.json from disk, falling back to memory:", e.message);
        if (!this.inMemoryDb) {
          this.inMemoryDb = { bookings: [] };
        }
        db = this.inMemoryDb;
      }
    }

    db.bookings.push(booking);

    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
    } catch (e) {
      console.warn("[WARN] Could not write to db.json (read-only environment):", e.message);
      this.inMemoryDb = db;
    }

    return booking;
  }

  scheduleFollowUp(booking) {
    // Simulate scheduling a follow up
    return {
      scheduled: true,
      message: `Reminder scheduled for 1 hour before ${booking.time} for your appointment with ${booking.providerName}.`,
      type: 'REMINDER'
    };
  }

  async resolveRedirect(url) {
    return new Promise((resolve) => {
      const agent = new https.Agent({ rejectUnauthorized: false });
      https.get(url, { agent }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(res.headers.location);
        } else {
          resolve(url);
        }
      }).on('error', () => resolve(url));
    });
  }

  async lookupShopDetails(queryText, isLink = false) {
    const trace = [];
    this.logTrace(trace, 'Shop Lookup Request', { queryText, isLink });

    try {
      let searchQuery = queryText;
      
      // If it's a link, resolve redirects first (important for maps.app.goo.gl)
      if (isLink && searchQuery.includes('maps.app.goo.gl')) {
        this.logTrace(trace, 'Resolving Redirect', searchQuery);
        const resolved = await this.resolveRedirect(searchQuery);
        this.logTrace(trace, 'Resolved URL', resolved);
        
        // If the resolved URL is a full maps link, it often contains the name in the path
        // e.g. .../place/Mirchi+360/@...
        if (resolved.includes('/place/')) {
          const parts = resolved.split('/place/');
          if (parts[1]) {
            const namePart = parts[1].split('/')[0].replace(/\+/g, ' ');
            searchQuery = decodeURIComponent(namePart);
            this.logTrace(trace, 'Extracted Name from URL', searchQuery);
          }
        }
      }
      
      if (!this.mapsKey) {
        this.logTrace(trace, 'Maps API Key Missing', 'Cannot perform link validation without Maps API key');
        return { success: false, error: 'LOCATION_VALIDATION_FAILED', trace };
      }

      let mapsRes = await this.mapsClient.findPlaceFromText({
        params: {
          input: searchQuery,
          inputtype: 'textquery',
          fields: ['name', 'formatted_address', 'place_id', 'geometry'],
          key: this.mapsKey,
          language: 'en'
        }
      });

      if (!mapsRes || !mapsRes.data) {
        this.logTrace(trace, 'Invalid Maps Response', 'findPlaceFromText returned invalid structure');
        return { success: false, error: 'LOCATION_VALIDATION_FAILED', trace };
      }

      // Fallback: If it's a link and standard search failed, use AI to tell us what this link is
      if ((!mapsRes.data.candidates || mapsRes.data.candidates.length === 0) && isLink) {
        this.logTrace(trace, 'Maps API Zero Results', 'Attempting AI-assisted link parsing...');
        const identifyPrompt = `
          The following is a Google Maps link or query: "${searchQuery}"
          Extract the most likely Shop Name and City from this text/URL.
          Return a JSON with "name" and "city".
          Example: {"name": "Yaqeen Electronics", "city": "Islamabad"}
          If you cannot identify anything, return null.
          Return ONLY JSON.
        `;
        const identifiedJson = await this.generateWithRetry(identifyPrompt);
        try {
          const id = this.robustParseJSON(identifiedJson, 'link');
          if (id && id.name) {
            searchQuery = `${id.name} ${id.city || ''}`;
            this.logTrace(trace, 'AI Identified Shop', searchQuery);
            mapsRes = await this.mapsClient.findPlaceFromText({
              params: {
                input: searchQuery,
                inputtype: 'textquery',
                fields: ['name', 'formatted_address', 'place_id', 'geometry'],
                key: this.mapsKey,
                language: 'en'
              }
            });
          }
        } catch (e) {
          console.warn("AI link identification failed", e.message);
        }
      }

      if (mapsRes.data.candidates && mapsRes.data.candidates.length > 0) {
        const place = mapsRes.data.candidates[0];
        const placeId = place.place_id;
        
        // Get full details including components for city/area and phone number
        const detailsRes = await this.mapsClient.placeDetails({
          params: {
            place_id: placeId,
            fields: ['name', 'formatted_address', 'address_components', 'url', 'formatted_phone_number', 'international_phone_number'],
            key: this.mapsKey,
            language: 'en'
          }
        });

        const details = detailsRes.data.result;
        let city = '';
        let area = '';
        const phone = details.formatted_phone_number || details.international_phone_number || null;

        details.address_components.forEach(comp => {
          if (comp.types.includes('locality')) city = comp.long_name;
          if (comp.types.includes('neighborhood') || comp.types.includes('sublocality')) area = comp.long_name;
        });

        // Use AI to refine the results and ensure they look good
        const prompt = `
          Given the following shop details from Google Maps:
          Name: ${details.name}
          Address: ${details.formatted_address}
          City Component: ${city}
          Area Component: ${area}
          Maps Link: ${details.url}
          Phone Number: ${phone || 'Not available'}
          Original Query/Link: ${queryText}
          Resolved URL: ${isLink ? searchQuery : 'N/A'}

          CRITICAL Constraints:
          - Return the address and all fields strictly in English.
          - Do NOT include any Plus Codes (like '98CP+5CE') in the "address" field under any circumstances. If a Plus Code is present, replace it with a clean descriptive street address, neighborhood name, or nearby landmark from Google Maps.
          - If the Google Maps data contains details like "Shop # 512 near Allied Bank", ensure this is perfectly preserved.

          Return a JSON object with:
          "name": The clean name of the shop (include branch if specified, e.g. "Mirchi 360 Qasimabad").
          "address": The clean, full shop address in detailed English without any Plus Codes.
          "city": The best city name (e.g., Hyderabad).
          "area": The specific area or sector (e.g., Qasimabad).
          "landmark": A nearby landmark if identifiable, or null.
          "phone": The phone number exactly as provided (e.g., "${phone || ''}"), or null if not available.
          "shopLink": ${details.url ? JSON.stringify(details.url) : 'null'}

          Return ONLY the JSON.
        `;

        let refined;
        try {
          const aiResponse = await this.generateWithRetry(prompt);
          refined = this.robustParseJSON(aiResponse, 'shop', details, city, area);
          
          if (refined && typeof refined === 'object') {
            const normalizedRefined = {};
            for (const [key, value] of Object.entries(refined)) {
              normalizedRefined[key.toLowerCase()] = value;
            }
            refined = {
              name: normalizedRefined.name || details.name || "Verified Professional",
              address: normalizedRefined.address || details.formatted_address || "Islamabad, Pakistan",
              city: normalizedRefined.city || city || "Islamabad",
              area: normalizedRefined.area || area || "G-13",
              landmark: normalizedRefined.landmark || null,
              phone: normalizedRefined.phone || phone || null,
              shopLink: normalizedRefined.shoplink || normalizedRefined.shop_link || details.url || null
            };
          }
          // Ensure phone is always present (AI may omit it)
          if (refined && !refined.phone && phone) refined.phone = phone;
        } catch (aiErr) {
          console.warn("[lookupShopDetails] AI refinement failed, using raw fallback:", aiErr.message);
          refined = this.buildFallbackJSON(details.formatted_address || '', 'shop', [details, city, area, phone]);
        }

        return { success: true, shop: refined, trace };
      } else {
        return { success: false, error: 'NO_SHOP_FOUND', trace };
      }
    } catch (err) {
      console.error("Shop lookup error:", err);
      return { success: false, error: err.message, trace };
    }
  }
}

module.exports = AntigravityOrchestrator;
