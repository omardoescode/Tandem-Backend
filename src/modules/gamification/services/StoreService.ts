export const StoreService = {
  calcSessionCoin(focusSeconds: number, breakSeconds: number): number {
    const focusMinutes = focusSeconds / 60;
    const breakMinutes = breakSeconds / 60;

    return Math.floor(Math.sqrt(focusMinutes) * 4 + breakMinutes * 0.2);
  },
};
