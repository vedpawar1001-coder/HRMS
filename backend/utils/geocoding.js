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
        namedetails: 1 // Get named features like bridges, landmarks
      },
      headers: {
        'User-Agent': 'HRMS-App/1.0' // Required by Nominatim
      },
      timeout: 8000 // Increased timeout for detailed lookup
    });

    const data = response.data;
    console.log(`[GEOCODING] ========== FULL API RESPONSE ==========`);
    console.log(`[GEOCODING] Coordinates: ${latitude}, ${longitude}`);
    console.log(`[GEOCODING] Display Name: ${data.display_name || 'N/A'}`);
    console.log(`[GEOCODING] Address Object:`, JSON.stringify(data.address, null, 2));
    console.log(`[GEOCODING] =======================================`);
    
    if (data && data.address) {
      const addr = data.address;
      const locationParts = [];
      
      // Helper function to check if string contains wrong areas
      const isWrongArea = (str) => {
        if (!str) return false;
        const lower = str.toLowerCase();
        return /shivajinagar|pune district|district/i.test(lower);
      };
      
      // Helper function to check for location keywords
      const hasLocationKeyword = (str) => {
        if (!str) return false;
        const lower = str.toLowerCase();
        return /naghegaon|narhegaon|navle|bridge|gaon|nagar|wadi/i.test(lower);
      };
      
      // Priority 1: Parse display_name FIRST - it often has the exact location
      // display_name format: "Specific Location, Area, City, District, State, India"
      // Example: "Navle Bridge, Narhegaon, Pune, Pune District, Maharashtra, India"
      if (data.display_name) {
        const displayParts = data.display_name.split(',').map(p => p.trim());
        console.log(`[GEOCODING] Parsing display_name (${displayParts.length} parts):`, displayParts);
        
        // Look through display_name parts to find the most specific location
        for (let i = 0; i < Math.min(displayParts.length, 5); i++) {
          const part = displayParts[i];
          
          // Skip generic terms and wrong areas
          const isGeneric = part.match(/^(Pune|Maharashtra|India|PIN|District|Pune District)$/i);
          const isWrong = isWrongArea(part);
          
          if (isWrong || isGeneric || part.length < 3) {
            continue;
          }
          
          // Check if this part has location keywords (Narhegaon, Navle, Bridge, etc.)
          if (hasLocationKeyword(part)) {
            // This is likely the specific location we want
            if (!locationParts.includes(part)) {
              locationParts.push(part);
              console.log(`[GEOCODING] ✅ Found specific location from display_name: ${part}`);
            }
          } else if (locationParts.length === 0) {
            // If no specific location found yet, take first meaningful part
            if (!locationParts.includes(part)) {
              locationParts.push(part);
              console.log(`[GEOCODING] Using first meaningful part from display_name: ${part}`);
            }
          }
        }
      }
      
      // Priority 2: Extract from address components (if display_name didn't give us specific location)
      // Order of specificity: quarter < neighbourhood < suburb < residential < village < locality
      if (locationParts.length === 0 || !hasLocationKeyword(locationParts.join(' '))) {
        // Check quarter (most specific)
        if (addr.quarter && !isWrongArea(addr.quarter) && !locationParts.includes(addr.quarter)) {
          locationParts.unshift(addr.quarter);
          console.log(`[GEOCODING] Found quarter: ${addr.quarter}`);
        }
        
        // Check neighbourhood
        if (addr.neighbourhood && !isWrongArea(addr.neighbourhood) && !locationParts.includes(addr.neighbourhood)) {
          if (!locationParts.some(p => hasLocationKeyword(p))) {
            locationParts.unshift(addr.neighbourhood);
            console.log(`[GEOCODING] Found neighbourhood: ${addr.neighbourhood}`);
          }
        }
        
        // Check suburb
        if (addr.suburb && !isWrongArea(addr.suburb) && !locationParts.includes(addr.suburb)) {
          if (!locationParts.some(p => hasLocationKeyword(p))) {
            locationParts.unshift(addr.suburb);
            console.log(`[GEOCODING] Found suburb: ${addr.suburb}`);
          }
        }
        
        // Check residential
        if (addr.residential && !isWrongArea(addr.residential) && !locationParts.includes(addr.residential)) {
          if (!locationParts.some(p => hasLocationKeyword(p))) {
            locationParts.unshift(addr.residential);
          }
        }
        
        // Check village (for outskirts like Narhegaon)
        if (addr.village && !isWrongArea(addr.village) && !locationParts.includes(addr.village)) {
          if (!locationParts.some(p => hasLocationKeyword(p))) {
            locationParts.unshift(addr.village);
            console.log(`[GEOCODING] Found village: ${addr.village}`);
          }
        }
      }
      
      // Priority 3: Add road/landmark (bridges, major roads)
      if (addr.road) {
        const roadName = addr.road;
        // Always include if it's a bridge or has location keywords
        if (roadName.toLowerCase().includes('bridge') || hasLocationKeyword(roadName)) {
          if (!locationParts.includes(roadName)) {
            locationParts.unshift(roadName); // Prepend for bridges/landmarks
            console.log(`[GEOCODING] Found road/landmark: ${roadName}`);
          }
        } else if (locationParts.length === 0) {
          // Only add road if we don't have any location yet
          if (!isWrongArea(roadName) && !locationParts.includes(roadName)) {
            locationParts.push(roadName);
          }
        }
      }
      
      // Priority 4: Filter and add city (only if we have specific location)
      // Filter out wrong areas like Shivajinagar
      if (locationParts.length > 0) {
        let cityName = null;
        
        // Get city, filtering out wrong areas
        if (addr.city && !isWrongArea(addr.city)) {
          cityName = addr.city;
        } else if (addr.town && !isWrongArea(addr.town)) {
          cityName = addr.town;
        }
        
        // Only add city if it's valid and not already included
        if (cityName && !locationParts.includes(cityName)) {
          // Check if city name is not part of any location part
          const cityAlreadyIncluded = locationParts.some(part => 
            part.toLowerCase() === cityName.toLowerCase() ||
            part.toLowerCase().includes(cityName.toLowerCase()) || 
            cityName.toLowerCase().includes(part.toLowerCase())
          );
          
          if (!cityAlreadyIncluded) {
            locationParts.push(cityName);
            console.log(`[GEOCODING] Added city for context: ${cityName}`);
          }
        }
      }
      
      // Return final location string
      if (locationParts.length > 0) {
        const finalLocation = locationParts.join(', ');
        console.log(`[GEOCODING] ✅ FINAL RESOLVED LOCATION: ${finalLocation}`);
        console.log(`[GEOCODING] Location parts (${locationParts.length}):`, locationParts);
        return finalLocation;
      }
      
      // Fallback: Try display_name first 2 parts (filtered)
      if (data.display_name) {
        const parts = data.display_name.split(',').map(p => p.trim());
        const meaningfulParts = parts.filter(p => 
          !isWrongArea(p) &&
          !p.match(/^(Maharashtra|India|District|Pune District|PIN)$/i) && 
          p.length > 2
        ).slice(0, 2);
        
        if (meaningfulParts.length > 0) {
          const fallbackLocation = meaningfulParts.join(', ');
          console.log(`[GEOCODING] Using fallback from display_name: ${fallbackLocation}`);
          return fallbackLocation;
        }
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
