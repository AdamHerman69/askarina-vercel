'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, TorusKnot, Box, Sphere, Plane, Environment, PerspectiveCamera, useTexture } from '@react-three/drei'
import { useExperimentControls } from '@/app/components/controls'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { PencilLinesPass } from './PencilLinesPass'

function SceneContent() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer>(null)
  const pencilPassRef = useRef<PencilLinesPass>(null)
  
  const { lineColor, baseColor, thresholdMin, thresholdMax, distortionScale, useColor } = useExperimentControls('Pencil Effect', {
    lineColor: { value: '#521f33' },
    baseColor: { value: '#ffffff' },
    thresholdMin: { value: 0.01, min: 0, max: 0.1, step: 0.001 },
    thresholdMax: { value: 0.03, min: 0, max: 0.2, step: 0.001 },
    distortionScale: { value: 1.0, min: 0.0, max: 5.0, step: 0.1 },
    useColor: { value: false }
  })

  const cloudTexture = useTexture('/experiments/sketchy-pencil-effect/cloud-noise.png')
  
  useEffect(() => {
      if (cloudTexture) {
          cloudTexture.wrapS = THREE.RepeatWrapping
          cloudTexture.wrapT = THREE.RepeatWrapping
      }
  }, [cloudTexture])

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
        texture: cloudTexture
    })
    pencilPassRef.current = pencilPass
    composer.addPass(pencilPass)

    return () => {
        // cleanup if needed
    }
  }, [gl, scene, camera, size, cloudTexture])

  // Update uniforms when controls change
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

  useFrame((state) => {
      if (pencilPassRef.current) {
        // Animate the time uniform at 12fps for a stop-motion feel
        pencilPassRef.current.material.uniforms.uTime.value = Math.floor(state.clock.elapsedTime * 12) / 12
      }
      if (composerRef.current) {
          composerRef.current.render()
      }
  }, 1)

  return (
    <>
      <color attach="background" args={[baseColor]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
      
      <group>
        <TorusKnot args={[1, 0.3, 100, 16]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#ff6b6b" />
        </TorusKnot>
        <Box args={[1, 1, 1]} position={[-2.5, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
             <meshStandardMaterial color="#4ecdc4" />
        </Box>
        <Sphere args={[0.8, 32, 32]} position={[2.5, 0, 0]}>
             <meshStandardMaterial color="#ffe66d" />
        </Sphere>
        <Plane args={[20, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
            <meshStandardMaterial color="#f7f7f7" />
        </Plane>
      </group>

      <Environment preset="city" />
      <OrbitControls />
    </>
  )
}

export default function Experiment({ isPreview }: { isPreview?: boolean }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
      <SceneContent />
    </>
  )
}
