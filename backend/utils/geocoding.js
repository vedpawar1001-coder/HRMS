const axios = require('axios');

/**
 * Reverse geocoding - Convert latitude/longitude to specific location name
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * Returns specific locations like "Narhegaon, Pune" or "Navle Bridge, Narhegaon, Pune"
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Specific location name (e.g., "Narhegaon, Pune", "Navle Bridge, Narhegaon, Pune")
 */
async function getCityName(latitude, longitude) {
  try {
    // Use OpenStreetMap Nominatim API for reverse geocoding
    // Maximum zoom (18) for most detailed location information
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1,
        zoom: 18, // Maximum zoom for most detailed location
        namedetails: 1, // Get named features like bridges, landmarks
        'accept-language': 'en' // Ensure English language
      },
      headers: {
        'User-Agent': 'HRMS-App/1.0' // Required by Nominatim
      },
      timeout: 10000 // Increased timeout for detailed lookup
    });

    const data = response.data;
    console.log(`[GEOCODING] ========== FULL API RESPONSE ==========`);
    console.log(`[GEOCODING] Coordinates: ${latitude}, ${longitude}`);
    console.log(`[GEOCODING] Display Name: ${data.display_name || 'N/A'}`);
    console.log(`[GEOCODING] Address Object:`, JSON.stringify(data.address, null, 2));
    console.log(`[GEOCODING] =======================================`);
    
    if (!data || !data.address) {
      throw new Error('No address data received from API');
    }

    const addr = data.address;
    const locationParts = [];
    
    // Helper function to check if string is generic/wrong
    const isGenericOrWrong = (str) => {
      if (!str) return true;
      const lower = str.toLowerCase();
      return /^(pune|maharashtra|india|pin|district|pune district)$/i.test(str) ||
             /shivajinagar|pune district|district/i.test(lower) ||
             str.length < 3;
    };
    
    // Helper to check if string is a city name
    const isCityName = (str) => {
      if (!str) return false;
      const lower = str.toLowerCase();
      return /^(pune|nagpur|mumbai|delhi|bangalore|hyderabad|chennai|kolkata)$/i.test(str);
    };
    
    // Helper to check if string is a road/street
    const isRoad = (str) => {
      if (!str) return false;
      const lower = str.toLowerCase();
      return /road|street|avenue|lane|drive|boulevard|highway/i.test(lower);
    };
    
    // PRIORITY 1: Parse display_name FIRST - it's usually the most accurate
    // Format: "Specific Location, Area, City, State, Country"
    // Example: "Dhayri, Pune, Maharashtra, India"
    if (data.display_name) {
      const displayParts = data.display_name.split(',').map(p => p.trim());
      console.log(`[GEOCODING] Parsing display_name (${displayParts.length} parts):`, displayParts);
      
      // Find the most specific location name (usually first or second part)
      for (let i = 0; i < Math.min(displayParts.length, 5); i++) {
        const part = displayParts[i];
        
        // Skip if generic, city name, or road
        if (isGenericOrWrong(part) || isCityName(part) || isRoad(part)) {
          continue;
        }
        
        // This is likely the specific location we want
        if (!locationParts.includes(part)) {
          locationParts.push(part);
          console.log(`[GEOCODING] ✅ Found location from display_name: ${part}`);
          // Usually the first meaningful part is the most specific
          if (i < 2) break;
        }
      }
    }
    
    // PRIORITY 2: Extract from address components (if display_name didn't give us good result)
    // Check ALL specific location fields in order of specificity
    const locationFields = [
      'hamlet',        // Very specific (like Dhayri)
      'quarter',       // Building/area name
      'neighbourhood', // Neighbourhood
      'suburb',        // Suburb
      'residential',   // Residential area
      'village',       // Village (for outskirts)
      'locality',      // Locality
      'municipality_district', // Municipality district
      'city_district', // City district
      'state_district' // State district
    ];
    
    for (const field of locationFields) {
      if (addr[field] && !isGenericOrWrong(addr[field]) && !locationParts.includes(addr[field])) {
        // Only add if we don't have a good location yet, or if this is more specific
        if (locationParts.length === 0 || field === 'hamlet' || field === 'quarter') {
          locationParts.unshift(addr[field]);
          console.log(`[GEOCODING] Found ${field}: ${addr[field]}`);
          break; // Take the most specific one
        }
      }
    }
    
    // PRIORITY 3: Add road/landmark if it's significant (bridges, major roads)
    if (addr.road && !isGenericOrWrong(addr.road)) {
      const roadName = addr.road;
      // Only add if it's a landmark or we don't have location yet
      if (roadName.toLowerCase().includes('bridge') || 
          roadName.toLowerCase().includes('highway') ||
          locationParts.length === 0) {
        if (!locationParts.includes(roadName)) {
          locationParts.unshift(roadName);
          console.log(`[GEOCODING] Found significant road/landmark: ${roadName}`);
        }
      }
    }
    
    // PRIORITY 4: Determine correct city name
    let cityName = null;
    
    // First, check display_name for city (most reliable)
    if (data.display_name) {
      const displayLower = data.display_name.toLowerCase();
      if (displayLower.includes('pune')) {
        cityName = 'Pune';
        console.log(`[GEOCODING] City from display_name: Pune`);
      } else if (displayLower.includes('nagpur')) {
        cityName = 'Nagpur';
      } else if (displayLower.includes('mumbai')) {
        cityName = 'Mumbai';
      }
    }
    
    // If not found in display_name, check address fields
    if (!cityName) {
      if (addr.city && !isGenericOrWrong(addr.city)) {
        cityName = addr.city;
      } else if (addr.town && !isGenericOrWrong(addr.town)) {
        cityName = addr.town;
      } else if (addr.municipality && !isGenericOrWrong(addr.municipality)) {
        cityName = addr.municipality;
      }
    }
    
    // Validate: If display_name mentions Pune, always use Pune
    if (data.display_name && data.display_name.toLowerCase().includes('pune')) {
      if (!cityName || cityName.toLowerCase() !== 'pune') {
        console.log(`[GEOCODING] ⚠️ Display name mentions Pune, correcting city from ${cityName} to Pune`);
        cityName = 'Pune';
      }
    }
    
    // Add city if we have location and city is valid
    if (locationParts.length > 0 && cityName) {
      // Check if city is already included in location parts
      const cityAlreadyIncluded = locationParts.some(part => 
        part.toLowerCase() === cityName.toLowerCase() ||
        part.toLowerCase().includes(cityName.toLowerCase()) || 
        cityName.toLowerCase().includes(part.toLowerCase())
      );
      
      if (!cityAlreadyIncluded) {
        locationParts.push(cityName);
        console.log(`[GEOCODING] Added city: ${cityName}`);
      }
    }
    
    // Return final location string
    if (locationParts.length > 0) {
      // Limit to max 3 parts for readability: [Specific Location, City]
      const finalParts = locationParts.slice(0, 3);
      const finalLocation = finalParts.join(', ');
      console.log(`[GEOCODING] ✅ FINAL RESOLVED LOCATION: ${finalLocation}`);
      console.log(`[GEOCODING] Location parts (${finalParts.length}):`, finalParts);
      return finalLocation;
    }
    
    // Fallback: Use first 2 meaningful parts from display_name
    if (data.display_name) {
      const parts = data.display_name.split(',').map(p => p.trim());
      const meaningfulParts = parts.filter(p => 
        !isGenericOrWrong(p) && !isCityName(p)
      ).slice(0, 2);
      
      if (meaningfulParts.length > 0) {
        // Add city if available
        if (cityName && !meaningfulParts.includes(cityName)) {
          meaningfulParts.push(cityName);
        }
        const fallbackLocation = meaningfulParts.join(', ');
        console.log(`[GEOCODING] Using fallback from display_name: ${fallbackLocation}`);
        return fallbackLocation;
      }
    }

    // Final fallback: Return coordinates
    const fallback = `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    console.log(`[GEOCODING] Using coordinates fallback: ${fallback}`);
    return fallback;
  } catch (error) {
    console.error('[GEOCODING] Error:', error.message);
    // Return coordinates as fallback if geocoding fails
    return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
  }
}

module.exports = { getCityName };
