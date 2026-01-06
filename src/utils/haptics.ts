// src/utils/haptics.ts
export const hapticTick = () => {
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(10); // Короткий "тык"
  }
};

export const hapticSuccess = () => {
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate([15, 30, 15]); // Двойной "тык"
  }
};