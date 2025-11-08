import React, { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import {
  Cube,
  Sphere,
  Cylinder,
  Download,
  RotateCw,
  Move,
  ZoomIn,
  ZoomOut,
  Grid,
} from 'lucide-react'

const CAD: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)

  const [selectedPrimitive, setSelectedPrimitive] = useState<
    'cube' | 'sphere' | 'cylinder' | 'torus'
  >('cube')
  const [width, setWidth] = useState(2)
  const [height, setHeight] = useState(2)
  const [depth, setDepth] = useState(2)
  const [radius, setRadius] = useState(1)
  const [color, setColor] = useState('#ffffff')
  const [metalness, setMetalness] = useState(0.5)
  const [roughness, setRoughness] = useState(0.5)
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 })
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 })
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 })

  const primitives = [
    { id: 'cube', name: 'Cube', icon: Cube },
    { id: 'sphere', name: 'Sphere', icon: Sphere },
    { id: 'cylinder', name: 'Cylinder', icon: Cylinder },
    { id: 'torus', name: 'Torus', icon: RotateCw },
  ]

  useEffect(() => {
    if (!mountRef.current) return

    const width = mountRef.current.clientWidth
    const height = mountRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(5, 5, 5)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    mountRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    const gridHelper = new THREE.GridHelper(10, 10)
    scene.add(gridHelper)

    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(5, 10, 7.5)
    scene.add(light)

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    scene.add(ambientLight)

    createPrimitive()

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  const createPrimitive = () => {
    if (!sceneRef.current || !meshRef.current) return

    sceneRef.current.remove(meshRef.current)
    meshRef.current.geometry.dispose()
    if (Array.isArray(meshRef.current.material)) {
      meshRef.current.material.forEach((mat) => mat.dispose())
    } else {
      meshRef.current.material.dispose()
    }

    let geometry: THREE.BufferGeometry

    switch (selectedPrimitive) {
      case 'cube':
        geometry = new THREE.BoxGeometry(width, height, depth)
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(radius, 32, 32)
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(radius, radius, height, 32)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(radius, 0.4, 16, 100)
        break
      default:
        geometry = new THREE.BoxGeometry(width, height, depth)
    }

    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: metalness,
      roughness: roughness,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(position.x, position.y, position.z)
    mesh.rotation.set(rotation.x, rotation.y, rotation.z)
    mesh.scale.set(scale.x, scale.y, scale.z)

    sceneRef.current.add(mesh)
    meshRef.current = mesh
  }

  useEffect(() => {
    if (meshRef.current) {
      createPrimitive()
    }
  }, [
    selectedPrimitive,
    width,
    height,
    depth,
    radius,
    color,
    metalness,
    roughness,
    position,
    rotation,
    scale,
  ])

  const exportModel = () => {
    if (!meshRef.current) return

    const exporter = new THREE.GLTFExporter()
    exporter.parse(
      meshRef.current,
      (result) => {
        const json = JSON.stringify(result, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'model.gltf'
        link.click()
        URL.revokeObjectURL(url)
      },
      { binary: false }
    )
  }

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.set(5, 5, 5)
    controlsRef.current.reset()
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Primitives:</span>
          {primitives.map((primitive) => {
            const Icon = primitive.icon
            return (
              <button
                key={primitive.id}
                onClick={() => setSelectedPrimitive(primitive.id as any)}
                className={`flex items-center gap-2 rounded px-3 py-2 ${
                  selectedPrimitive === primitive.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title={primitive.name}
              >
                <Icon size={18} />
                {primitive.name}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 border-l border-gray-200 pl-4">
          {(selectedPrimitive === 'cube' ||
            selectedPrimitive === 'cylinder') && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Width:</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseFloat(e.target.value))}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Height:</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseFloat(e.target.value))}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                  min="0.1"
                  step="0.1"
                />
              </div>
              {selectedPrimitive === 'cube' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Depth:</label>
                  <input
                    type="number"
                    value={depth}
                    onChange={(e) => setDepth(parseFloat(e.target.value))}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    min="0.1"
                    step="0.1"
                  />
                </div>
              )}
            </>
          )}

          {(selectedPrimitive === 'sphere' ||
            selectedPrimitive === 'torus' ||
            selectedPrimitive === 'cylinder') && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Radius:</label>
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                min="0.1"
                step="0.1"
              />
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={resetCamera}
            className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
          >
            Reset View
          </button>
          <button
            onClick={exportModel}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Download size={18} />
            Export GLTF
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        <div className="w-64 border-r border-gray-200 bg-white p-4 overflow-y-auto">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Transform
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-gray-600">
                Position
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="X"
                  value={position.x}
                  onChange={(e) =>
                    setPosition({ ...position, x: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={position.y}
                  onChange={(e) =>
                    setPosition({ ...position, y: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Z"
                  value={position.z}
                  onChange={(e) =>
                    setPosition({ ...position, z: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-600">
                Rotation
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="X"
                  value={rotation.x}
                  onChange={(e) =>
                    setRotation({ ...rotation, x: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={rotation.y}
                  onChange={(e) =>
                    setRotation({ ...rotation, y: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Z"
                  value={rotation.z}
                  onChange={(e) =>
                    setRotation({ ...rotation, z: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-600">Scale</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="X"
                  value={scale.x}
                  onChange={(e) =>
                    setScale({ ...scale, x: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={scale.y}
                  onChange={(e) =>
                    setScale({ ...scale, y: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
                <input
                  type="number"
                  placeholder="Z"
                  value={scale.z}
                  onChange={(e) =>
                    setScale({ ...scale, z: parseFloat(e.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <h3 className="mt-6 mb-4 text-sm font-semibold text-gray-700">
            Material
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm text-gray-600">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-full cursor-pointer rounded border border-gray-300"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-gray-600">
                Metalness
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={metalness}
                onChange={(e) => setMetalness(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-gray-600">
                Roughness
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={roughness}
                onChange={(e) => setRoughness(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (controlsRef.current) {
                    controlsRef.current.enabled = true
                    controlsRef.current.update()
                  }
                }}
                className="rounded bg-gray-200 p-2 hover:bg-gray-300"
                title="Move"
              >
                <Move size={18} />
              </button>
            </div>

            <div className="text-sm text-gray-600">
              {selectedPrimitive} | {width} x {height}{' '}
              {selectedPrimitive === 'cube' ? `x ${depth}` : ''}
            </div>
          </div>

          <div className="flex-1 relative">
            <div ref={mountRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CAD
