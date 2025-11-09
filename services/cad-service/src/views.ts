import { ViewDefinition } from './types'

export const getViewDefinitions = (): ViewDefinition[] => [
  {
    id: 'perspective',
    label: 'Perspective',
    projection: 'perspective',
    position: [6, 6, 6],
    target: [0, 0, 0],
    up: [0, 1, 0],
    options: { fov: 60 },
  },
  {
    id: 'orthographic',
    label: 'Ortho',
    projection: 'orthographic',
    position: [0, 0, 10],
    target: [0, 0, 0],
    up: [0, 1, 0],
    options: { zoom: 1 },
  },
  { id: 'front', label: 'Front', projection: 'orthographic', position: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0] },
  { id: 'back', label: 'Back', projection: 'orthographic', position: [0, 0, -10], target: [0, 0, 0], up: [0, 1, 0] },
  { id: 'left', label: 'Left', projection: 'orthographic', position: [-10, 0, 0], target: [0, 0, 0], up: [0, 1, 0] },
  { id: 'right', label: 'Right', projection: 'orthographic', position: [10, 0, 0], target: [0, 0, 0], up: [0, 1, 0] },
  { id: 'top', label: 'Top', projection: 'orthographic', position: [0, 10, 0], target: [0, 0, 0], up: [0, 0, -1] },
  { id: 'bottom', label: 'Bottom', projection: 'orthographic', position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1] },
]
