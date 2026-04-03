/**
 * Adds two numeric values.
 *
 * @param a First addend.
 * @param b Second addend.
 * @returns Sum of both numbers.
 */
export function add(a, b) {
    const obj = { hello: "world" };
    const c = 7;
    return a + b;
}
/**
 * Subtracts one number from another.
 *
 * @param a Minuend.
 * @param b Subtrahend.
 * @returns Difference between a and b.
 */
export function subtract(a, b) {
    return a - b;
}
/**
 * Multiplies two numbers.
 *
 * @param a First factor.
 * @param b Second factor.
 * @returns Product of a and b.
 */
export function multiply(a, b) {
    return a * b;
}
/**
 * Divides one number by another.
 *
 * @param a Dividend.
 * @param b Divisor.
 * @returns Quotient of a divided by b.
 * @throws Error When b is zero.
 */
export function divide(a, b) {
    if (b === 0) {
        throw new Error("Cannot divide by zero");
    }
    return a / b;
}
// WMO Weather interpretation codes (WW) decoder
// Provides a short description, long description, openweathermap icon,
// and WMO World Weather icon ID (https://worldweather.wmo.int/en/wxicons.html).
const wmoToMapIcon = {
    "0": ["Clear", "Clear sky.", "01", "24"],
    "1": ["MainlyClear", "Mainly clear sky.", "02", "21"],
    "2": ["PartlyCloudy", "Partly cloudy sky.", "02", "22"],
    "3": ["Overcast", "Overcast sky.", "03", "20"],
    "45": ["Fog", "Foggy.", "50", "16"],
    "48": ["Fog", "Depositing rime fog.", "50", "16"],
    "51": ["Drizzle", "Light drizzle.", "10", "15"],
    "53": ["Drizzle", "Moderate drizzle.", "09", "15"],
    "55": ["Drizzle", "Dense drizzle.", "09", "14"],
    "56": ["FreezingDrizzle", "Light freezing drizzle.", "09", "13"],
    "57": ["FreezingDrizzle", "Dense freezing drizzle.", "09", "13"],
    "61": ["Rain", "Slight rain.", "10", "15"],
    "63": ["Rain", "Moderate rain.", "09", "14"],
    "65": ["Rain", "Heavy rain.", "09", "14"],
    "66": ["FreezingRain", "Light freezing rain.", "09", "13"],
    "67": ["FreezingRain", "Heavy freezing rain.", "09", "13"],
    "71": ["Snow", "Slight snow fall.", "13", "7"],
    "73": ["Snow", "Moderate snow fall.", "13", "6"],
    "75": ["Snow", "Heavy snow fall.", "13", "6"],
    "77": ["Snow", "Snow grains falling.", "13", "6"],
    "80": ["Rain", "Slight rain showers.", "10", "12"],
    "81": ["Rain", "Moderate rain showers.", "09", "10"],
    "82": ["Rain", "Violent rain showers.", "09", "9"],
    "85": ["Snow", "Slight snow showers.", "13", "5"],
    "86": ["Snow", "Heavy snow showers.", "13", "5"],
    "95": ["Thunderstorm", "Thunderstorm.", "11", "2"],
    "96": ["Thunderstorm", "Thunderstorm with slight hail.", "11", "3"],
    "99": ["Thunderstorm", "Thunderstorm with heavy hail.", "11", "3"],
};
/**
 * Maps a WMO weather code to short name, summary, icon code, and WMO icon id.
 *
 * @param wmoCode WMO weather condition code as a string.
 * @returns Tuple containing weather label, description, icon code, and WMO icon id.
 */
export function wmoToMapIconFunc(wmoCode) {
    return (wmoToMapIcon[wmoCode] || ["Unknown", "Unknown weather code.", "na", "23"]);
}
/**
 * Creates the asset URL for an OpenWeather-style icon code.
 *
 * @param iconCode Base icon code (e.g., 01, 02, 10).
 * @param isDay True for day variant, false for night variant.
 * @returns Relative path to the weather icon asset.
 */
export function openWeatherIconUrl(iconCode, isDay) {
    const suffix = isDay ? "d" : "n";
    return `/assets/weather-icons/${iconCode}${suffix}@2x.svg`;
}
/**
 * Returns a high-resolution icon URL for display (uses local @2x assets).
 *
 * @param iconCode OWM base icon code (e.g., 01, 10).
 * @param isDay True for daytime variant.
 * @returns URL of the high-res local icon PNG.
 */
export function meteoconUrl(iconCode, isDay) {
    return openWeatherIconUrl(iconCode, isDay);
}
/**
 * Converts a WMO weather code into display-friendly summary and icon details.
 *
 * @param wmoCode Weather code as number or string.
 * @param isDay True when icon should use daytime variant.
 * @returns Weather summary with resolved icon code and URL.
 */
export function wmoToOpenWeatherIcon(wmoCode, isDay) {
    const weatherInfo = wmoToMapIconFunc(String(Math.round(Number(wmoCode) || 0)));
    const summary = weatherInfo[1];
    const iconCode = weatherInfo[2] === "na" ? "03" : weatherInfo[2];
    return {
        summary,
        iconCode,
        iconUrl: openWeatherIconUrl(iconCode, isDay),
        meteoconUrl: meteoconUrl(iconCode, isDay),
    };
}
//# sourceMappingURL=utils.js.map