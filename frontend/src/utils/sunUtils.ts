export const sunUtils = {
    /**
     * Calculates the sun's position (altitude) for a given date and location.
     * If altitude > -0.833 degrees (official sunrise/sunset), it is considered daytime.
     * 
     * Based on a simplified version of the SunCalc algorithm.
     */
    isDaytime: (date: Date, lat: number, lng: number): boolean => {
        const PI = Math.PI;
        const rad = PI / 180;
        const dayMs = 1000 * 60 * 60 * 24;
        const J1970 = 2440588;
        const J2000 = 2451545;

        // Calculate Julian Date
        const J = date.valueOf() / dayMs - 0.5 + J1970;
        const d = J - J2000;

        // Solar coordinates
        const M = (357.5291 + 0.98560028 * d) % 360;
        const C = 1.9148 * Math.sin(M * rad) + 0.0200 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
        const L = (M + C + 102.9372 + 180) % 360;
        const sinDec = 0.39779 * Math.sin(L * rad);
        const dec = Math.asin(sinDec);

        // Sidereal Time
        const J0 = 0.0009;
        const lw = rad * -lng;
        const phi = rad * lat;
        const th = rad * (280.1600 + 360.9856235 * d) - lw;

        // Hour Angle
        const H = th - (Math.atan2(Math.sin(L * rad) * Math.cos(23.4397 * rad), Math.cos(L * rad))); // Right Ascension approx?

        // Actually, let's use the direct altitude formula with proper HA
        // H = Local Sidereal Time - Right Ascension
        // But simpler: 
        // H = (Sidereal Time at Greenwich + Longitude) - Right Ascension

        // Let's use a more standard, compact implementation for Altitude
        // sin(h) = sin(lat)sin(dec) + cos(lat)cos(dec)cos(H)

        // Re-calculating H properly:
        // 1. Mean Longitude
        const L_mean = (280.460 + 0.9856474 * d) % 360;
        // 2. Mean Anomaly
        const g = (357.528 + 0.9856003 * d) % 360;
        // 3. Ecliptic Longitude
        const lambda = L_mean + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad);
        // 4. Obliquity of Ecliptic
        const epsilon = 23.439 - 0.0000004 * d;
        // 5. Right Ascension (alpha)
        const alpha = Math.atan2(Math.cos(epsilon * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad));
        // 6. Declination (delta)
        const delta = Math.asin(Math.sin(epsilon * rad) * Math.sin(lambda * rad));

        // 7. Greenwich Mean Sidereal Time (GMST)
        // GMST = 6.697375 + 0.0657098242 * d + 1.0027379 * (hours + minutes/60 + seconds/3600)
        // But 'd' here usually includes the fraction of day.
        // Let's use the 'd' we calculated which includes time fraction? No, d above is usually whole days for some formulas.
        // Let's use the 'th' approach which is common in JS implementations (like SunCalc)

        // SunCalc Reference Implementation Logic:
        const e = rad * 23.4397; // obliquity
        const rightAscension = Math.atan2(Math.sin(L * rad) * Math.cos(e), Math.cos(L * rad));

        const siderealTime = rad * (280.16 + 360.9856235 * d) - lw;
        const hourAngle = siderealTime - rightAscension;

        const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));

        // Altitude is in radians.
        // Sunrise/Sunset is at -0.833 degrees
        const altitudeDeg = altitude * (180 / PI);

        return altitudeDeg > -0.833;
    }
};
