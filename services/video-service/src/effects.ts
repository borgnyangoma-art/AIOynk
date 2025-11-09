import { EffectDefinition, EffectType } from './types'

export const EFFECT_LIBRARY: Record<EffectType, EffectDefinition[]> = {
  filter: [
    {
      type: 'filter',
      name: 'blur',
      description: 'Gaussian blur applied to the full frame',
      parameters: [
        { name: 'radius', type: 'number', default: 8, min: 0, max: 64 },
      ],
    },
    {
      type: 'filter',
      name: 'brightness',
      description: 'Adjust overall brightness',
      parameters: [
        { name: 'value', type: 'number', default: 0, min: -1, max: 1 },
      ],
    },
    {
      type: 'filter',
      name: 'contrast',
      description: 'Adjust contrast curve',
      parameters: [
        { name: 'value', type: 'number', default: 0, min: -1, max: 1 },
      ],
    },
    {
      type: 'filter',
      name: 'grayscale',
      description: 'Convert footage to grayscale',
      parameters: [],
    },
    {
      type: 'filter',
      name: 'sepia',
      description: 'Apply sepia tone',
      parameters: [],
    },
  ],
  transition: [
    {
      type: 'transition',
      name: 'fade',
      description: 'Cross-fade between clips',
      parameters: [
        { name: 'duration', type: 'number', default: 0.5, min: 0.1, max: 5 },
      ],
    },
    {
      type: 'transition',
      name: 'slide',
      description: 'Slide-in transition',
      parameters: [
        { name: 'direction', type: 'enum', default: 'left', options: ['left', 'right', 'up', 'down'] },
        { name: 'duration', type: 'number', default: 0.5, min: 0.1, max: 5 },
      ],
    },
    {
      type: 'transition',
      name: 'wipe',
      description: 'Linear wipe transition',
      parameters: [
        { name: 'direction', type: 'enum', default: 'left', options: ['left', 'right', 'up', 'down'] },
        { name: 'duration', type: 'number', default: 0.4, min: 0.1, max: 5 },
      ],
    },
  ],
  text: [
    {
      type: 'text',
      name: 'title',
      description: 'Large title overlay',
      parameters: [
        { name: 'text', type: 'string', default: 'Title' },
        { name: 'position', type: 'enum', default: 'center', options: ['top', 'center', 'bottom'] },
        { name: 'size', type: 'number', default: 48, min: 12, max: 120 },
      ],
    },
    {
      type: 'text',
      name: 'subtitle',
      description: 'Lower-thirds subtitle',
      parameters: [
        { name: 'text', type: 'string', default: 'Subtitle' },
        { name: 'position', type: 'enum', default: 'bottom', options: ['top', 'center', 'bottom'] },
        { name: 'size', type: 'number', default: 24, min: 10, max: 72 },
      ],
    },
  ],
  audio: [
    {
      type: 'audio',
      name: 'ducking',
      description: 'Auto-duck music under voiceover',
      parameters: [
        { name: 'threshold', type: 'number', default: -20, min: -60, max: 0 },
        { name: 'ratio', type: 'number', default: 0.5, min: 0.1, max: 1 },
      ],
    },
    {
      type: 'audio',
      name: 'fade-audio',
      description: 'Fade audio in/out',
      parameters: [
        { name: 'duration', type: 'number', default: 1, min: 0, max: 10 },
      ],
    },
  ],
}

export const listEffects = () => EFFECT_LIBRARY

export const findEffectDefinition = (type: EffectType, name: string) =>
  EFFECT_LIBRARY[type]?.find((effect) => effect.name === name)
