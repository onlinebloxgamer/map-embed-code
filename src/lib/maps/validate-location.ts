// Validates location-related inputs

export function validateLatitude(value: number): boolean {
    return !isNaN(value) && value >= -90 && value <= 90;
}

export function validateLongitude(value: number): boolean {
    return !isNaN(value) && value >= -180 && value <= 180;
}

export function validateDimension(value: number): boolean {
    return !isNaN(value) && Number.isFinite(value) && value >= 50 && value <= 4000;
}

export function validateZoom(value: number): boolean {
    return !isNaN(value) && Number.isInteger(value) && value >= 1 && value <= 21;
}

export function sanitizeQuery(query: string): string {
    return query.trim();
}

export function parseCoordinate(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '-') return null;
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
}

export interface ValidationResult {
    valid: boolean;
    message?: string;
}

export function validateLatitudeInput(value: string): ValidationResult {
    if (!value.trim()) return { valid: false, message: 'Latitude is required.' };
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, message: 'Latitude must be a number.' };
    if (num < -90 || num > 90) return { valid: false, message: 'Latitude must be between -90 and +90.' };
    return { valid: true };
}

export function validateLongitudeInput(value: string): ValidationResult {
    if (!value.trim()) return { valid: false, message: 'Longitude is required.' };
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, message: 'Longitude must be a number.' };
    if (num < -180 || num > 180) return { valid: false, message: 'Longitude must be between -180 and +180.' };
    return { valid: true };
}
