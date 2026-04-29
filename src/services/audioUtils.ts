export const audioUtils = {
  base64ToArrayBuffer: (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  },

  arrayBufferToBase64: (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  convertFloat32ToInt16: (float32Array: Float32Array): Int16Array => {
    const l = float32Array.length;
    const int16Array = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF;
    }
    return int16Array;
  },

  convertInt16ToFloat32: (int16Buffer: ArrayBuffer): Float32Array => {
    const int16Array = new Int16Array(int16Buffer);
    const l = int16Array.length;
    const float32Array = new Float32Array(l);
    for (let i = 0; i < l; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  }
};