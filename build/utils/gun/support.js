export const isPlatformWeb = () => {
    return typeof window !== 'undefined';
};
export const isGunInstance = (gun) => {
    return !!gun?.user && !!gun?.constructor?.SEA;
};
