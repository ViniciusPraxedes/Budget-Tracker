import { PREDEFINED_COLORS } from '../constants';

export const getUsedColors = (categories: { color: string }[]): string[] => {
    return categories.map(c => c.color);
};

export const getAvailableColors = (usedColors: string[]): string[] => {
    return PREDEFINED_COLORS.filter(color => !usedColors.includes(color));
};

export const getUnusedColor = (usedColors: string[]): string => {
    const available = getAvailableColors(usedColors);
    if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
    }
    // If all colors are used, return a random one from the full list
    return PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)];
};
