'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center, PerspectiveCamera, TorusKnot, Box, Sphere, Plane } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { PencilLinesPass } from './PencilLinesPass'

// Generate a cloud noise texture procedurally
function generateNoiseTexture(size: number = 256): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4)
    
    // Simple Perlin-like noise using multiple octaves
    const noise2D = (x: number, y: number, seed: number = 0): number => {
        const dot = x * 12.9898 + y * 78.233 + seed
        const sinVal = Math.sin(dot) * 43758.5453
        return sinVal - Math.floor(sinVal)
    }
    
    const smoothNoise = (x: number, y: number, scale: number): number => {
        const x0 = Math.floor(x / scale) * scale
        const y0 = Math.floor(y / scale) * scale
        const x1 = x0 + scale
        const y1 = y0 + scale
        
        const fx = (x - x0) / scale
        const fy = (y - y0) / scale
        
        // Smoothstep interpolation
        const sx = fx * fx * (3 - 2 * fx)
        const sy = fy * fy * (3 - 2 * fy)
        
        const n00 = noise2D(x0, y0, 0)
        const n10 = noise2D(x1, y0, 0)
        const n01 = noise2D(x0, y1, 0)
        const n11 = noise2D(x1, y1, 0)
        
        const nx0 = n00 * (1 - sx) + n10 * sx
        const nx1 = n01 * (1 - sx) + n11 * sx
        
        return nx0 * (1 - sy) + nx1 * sy
    }
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4
            
            // Multiple octaves for cloud-like appearance
            let value = 0
            value += smoothNoise(x, y, 64) * 0.5
            value += smoothNoise(x, y, 32) * 0.25
            value += smoothNoise(x, y, 16) * 0.125
            value += smoothNoise(x, y, 8) * 0.0625
            
            const v = Math.floor(value * 255)
            data[i] = v
            data[i + 1] = v
            data[i + 2] = v
            data[i + 3] = 255
        }
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.needsUpdate = true
    
    return texture
}

interface ModelProps {
    url: string
    scale?: number
    rotation?: [number, number, number]
    position?: [number, number, number]
}

function Model({ url, scale = 1, rotation = [0, 0, 0], position = [0, 0, 0] }: ModelProps) {
    const { scene } = useGLTF(url)
    const groupRef = useRef<THREE.Group>(null)
    
    // Clone the scene to avoid issues with reusing
    const clonedScene = useMemo(() => scene.clone(), [scene])
    
    // Auto-rotate the model slowly
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.2
        }
    })
    
    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            <Center>
                <primitive object={clonedScene} scale={scale} />
            </Center>
        </group>
    )
}

// Default shapes for when no model is provided
function DefaultShapes() {
    const groupRef = useRef<THREE.Group>(null)
    
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.2
        }
    })
    
    return (
        <group ref={groupRef}>
            <TorusKnot args={[1, 0.3, 100, 16]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#ff6b6b" />
            </TorusKnot>
            <Box args={[1, 1, 1]} position={[-2.5, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
                <meshStandardMaterial color="#4ecdc4" />
            </Box>
            <Sphere args={[0.8, 32, 32]} position={[2.5, 0, 0]}>
                <meshStandardMaterial color="#ffe66d" />
            </Sphere>
        </group>
    )
}

interface PencilSceneContentProps {
    modelUrl?: string
    modelScale?: number
    lineColor?: string
    baseColor?: string
    thresholdMin?: number
    thresholdMax?: number
    distortionScale?: number
    useColor?: boolean
}

function PencilSceneContent({
    modelUrl,
    modelScale = 1,
    lineColor = '#521f33',
    baseColor = '#ffffff',
    thresholdMin = 0.01,
    thresholdMax = 0.03,
    distortionScale = 1.0,
    useColor = false
}: PencilSceneContentProps) {
    const { gl, scene, camera, size } = useThree()
    const composerRef = useRef<EffectComposer | null>(null)
    const pencilPassRef = useRef<PencilLinesPass | null>(null)
    
    // Generate noise texture once
    const noiseTexture = useMemo(() => generateNoiseTexture(256), [])
    
    // Setup the effect composer
    useEffect(() => {
        const composer = new EffectComposer(gl)
        composerRef.current = composer

        const renderPass = new RenderPass(scene, camera)
        composer.addPass(renderPass)

        const pencilPass = new PencilLinesPass({
            width: size.width,
            height: size.height,
            scene,
            camera,
            texture: noiseTexture
        })
        pencilPassRef.current = pencilPass
        composer.addPass(pencilPass)

        return () => {
            composer.dispose()
        }
    }, [gl, scene, camera, size, noiseTexture])

    // Update uniforms when props change
    useEffect(() => {
        if (pencilPassRef.current) {
            pencilPassRef.current.material.uniforms.uLineColor.value.set(lineColor)
            pencilPassRef.current.material.uniforms.uBaseColor.value.set(baseColor)
            pencilPassRef.current.material.uniforms.uSobelThresholdMin.value = thresholdMin
            pencilPassRef.current.material.uniforms.uSobelThresholdMax.value = thresholdMax
            pencilPassRef.current.material.uniforms.uDistortionScale.value = distortionScale
            pencilPassRef.current.material.uniforms.uUseColor.value = useColor ? 1.0 : 0.0
        }
    }, [lineColor, baseColor, thresholdMin, thresholdMax, distortionScale, useColor])

    // Handle resize
    useEffect(() => {
        if (composerRef.current) {
            composerRef.current.setSize(size.width, size.height)
        }
        if (pencilPassRef.current) {
            pencilPassRef.current.setSize(size.width, size.height)
        }
    }, [size])

    // Render loop with stop-motion effect (12fps)
    useFrame((state) => {
        if (pencilPassRef.current) {
            pencilPassRef.current.material.uniforms.uTime.value = 
                Math.floor(state.clock.elapsedTime * 12) / 12
        }
        if (composerRef.current) {
            composerRef.current.render()
        }
    }, 1) // Priority 1 to ensure it runs after other updates

    return (
        <>
            <color attach="background" args={[baseColor]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
            
            {modelUrl ? (
                <Model url={modelUrl} scale={modelScale} />
            ) : (
                <DefaultShapes />
            )}
            
            <Plane args={[20, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
                <meshStandardMaterial color="#f7f7f7" />
            </Plane>

            <OrbitControls 
                enablePan={false}
                minDistance={3}
                maxDistance={10}
            />
        </>
    )
}

export interface PencilSceneProps {
    modelUrl?: string
    modelScale?: number
    lineColor?: string
    baseColor?: string
    thresholdMin?: number
    thresholdMax?: number
    distortionScale?: number
    useColor?: boolean
}

export default function PencilScene(props: PencilSceneProps) {
    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={50} />
            <PencilSceneContent {...props} />
        </>
    )
}
