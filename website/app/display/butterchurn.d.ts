/**
 * Just enough typing for butterchurn (MilkDrop in WebGL) and its preset pack,
 * which ship without types. Only what BpmMilkdrop uses.
 */

declare module "butterchurn" {
  /** Raw time-domain audio, bytes centred on 128, butterchurn's fftSize (1024) long. */
  export interface ButterchurnAudioLevels {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }

  export interface ButterchurnVisualizer {
    /** Draws a frame. Without audioLevels it reads its own analyser, which needs an AudioContext. */
    render(opts?: { audioLevels?: ButterchurnAudioLevels; elapsedTime?: number }): void;
    /** Blends to a preset over blendTimeS seconds. */
    loadPreset(preset: object, blendTimeS: number): void;
    setRendererSize(width: number, height: number): void;
  }

  export interface ButterchurnOptions {
    width: number;
    height: number;
    pixelRatio?: number;
    textureRatio?: number;
  }

  const butterchurn: {
    /** context can be null when every render passes audioLevels. */
    createVisualizer(context: AudioContext | null, canvas: HTMLCanvasElement, opts: ButterchurnOptions): ButterchurnVisualizer;
  };
  export default butterchurn;
}

declare module "butterchurn-presets" {
  const butterchurnPresets: {
    /** Preset name -> preset. */
    getPresets(): Record<string, object>;
  };
  export default butterchurnPresets;
}

// the other preset packs in butterchurn-presets/lib/, same shape as the base pack
declare module "butterchurn-presets/lib/*" {
  const butterchurnPresetPack: {
    /** Preset name -> preset. */
    getPresets(): Record<string, object>;
  };
  export default butterchurnPresetPack;
}
