'use client'

import { OrthographicCamera, useFBO } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

// Shaders - same as original except output shader

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 u_texel;

    void main () {
        vUv = uv;
        vL = vUv - vec2(u_texel.x, 0.);
        vR = vUv + vec2(u_texel.x, 0.);
        vT = vUv + vec2(0., u_texel.y);
        vB = vUv - vec2(0., u_texel.y);
        gl_Position = vec4(position, 1.0);
    }
`

const fragShaderAdvection = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D u_velocity_texture;
    uniform sampler2D u_input_texture;
    uniform vec2 u_texel;
    uniform float u_dt;
    uniform float u_dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
        vec2 coord = vUv - u_dt * bilerp(u_velocity_texture, vUv, u_texel).xy * u_texel;
        gl_FragColor = u_dissipation * bilerp(u_input_texture, coord, u_texel);
        gl_FragColor.a = 1.;
    }
`

const fragShaderDivergence = /* glsl */ `
    precision highp float;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D u_velocity_texture;

    void main () {
        float L = texture2D(u_velocity_texture, vL).x;
        float R = texture2D(u_velocity_texture, vR).x;
        float T = texture2D(u_velocity_texture, vT).y;
        float B = texture2D(u_velocity_texture, vB).y;
        float div = .6 * (R - L + T - B);
        gl_FragColor = vec4(div, 0., 0., 1.);
    }
`

const fragShaderPressure = /* glsl */ `
    precision highp float;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D u_pressure_texture;
    uniform sampler2D u_divergence_texture;

    void main () {
        float L = texture2D(u_pressure_texture, vL).x;
        float R = texture2D(u_pressure_texture, vR).x;
        float T = texture2D(u_pressure_texture, vT).x;
        float B = texture2D(u_pressure_texture, vB).x;
        float divergence = texture2D(u_divergence_texture, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0., 0., 1.);
    }
`

const fragShaderGradientSubtract = /* glsl */ `
    precision highp float;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D u_pressure_texture;
    uniform sampler2D u_velocity_texture;

    void main () {
        float L = texture2D(u_pressure_texture, vL).x;
        float R = texture2D(u_pressure_texture, vR).x;
        float T = texture2D(u_pressure_texture, vT).x;
        float B = texture2D(u_pressure_texture, vB).x;
        vec2 velocity = texture2D(u_velocity_texture, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0., 1.);
    }
`

const fragShaderPoint = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D u_input_texture;
    uniform float u_ratio;
    uniform vec3 u_point_value;
    uniform vec2 u_point;
    uniform float u_point_size;

    void main () {
        vec2 p = vUv - u_point.xy;
        p.x *= u_ratio;
        vec3 splat = pow(2., -dot(p, p) / u_point_size) * u_point_value;
        vec3 base = texture2D(u_input_texture, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.);
    }
`

// NEW: Output shader that displaces video using velocity field
const fragShaderOutputShader = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D u_velocity_texture;
    uniform sampler2D u_video_texture;
    uniform vec2 u_texel;
    uniform float u_displacement_scale;
    uniform float u_chromatic_aberration;

    void main () {
        // Sample velocity field
        vec2 velocity = texture2D(u_velocity_texture, vUv).xy;
        
        // Calculate displacement (scale velocity to appropriate range)
        vec2 displacement = velocity * u_displacement_scale * u_texel;
        
        // Base UV for sampling video
        vec2 baseUV = vUv;
        
        // Apply chromatic aberration if enabled
        if (u_chromatic_aberration > 0.0) {
            // Sample RGB channels with different offsets
            vec2 redUV = clamp(baseUV + displacement * (1.0 + u_chromatic_aberration), 0.0, 1.0);
            vec2 greenUV = clamp(baseUV + displacement, 0.0, 1.0);
            vec2 blueUV = clamp(baseUV + displacement * (1.0 - u_chromatic_aberration), 0.0, 1.0);
            
            float r = texture2D(u_video_texture, redUV).r;
            float g = texture2D(u_video_texture, greenUV).g;
            float b = texture2D(u_video_texture, blueUV).b;
            float a = texture2D(u_video_texture, greenUV).a;
            
            gl_FragColor = vec4(r, g, b, a);
        } else {
            // Simple displacement without chromatic aberration
            vec2 displacedUV = clamp(baseUV + displacement, 0.0, 1.0);
            gl_FragColor = texture2D(u_video_texture, displacedUV);
        }
    }
`

type FluidVideoOptions = {
    videoSrc: string
    color: string
    // Physics
    velocityDissipation: number
    pressureIterations: number
    splatRadius: number
    splatForce: number
    // Displacement
    displacementScale: number
    chromaticAberration: number
    isPreview?: boolean
}

const DEFAULT_OPTIONS: FluidVideoOptions = {
    videoSrc: '/projects/germos/cms_final1.mp4',
    color: "#ff0080",
    velocityDissipation: 0.98,
    pressureIterations: 10,
    splatRadius: 0.0025,
    splatForce: 6000,
    displacementScale: 50.0,
    chromaticAberration: 0.0
}

function hexToRgb(hex: string): [number, number, number] {
    hex = hex.replace(/^#/, '')
    if (hex.length === 3) {
        hex = hex.split('').map((x) => x + x).join('')
    }
    const num = parseInt(hex, 16)
    const r = ((num >> 16) & 255) / 255
    const g = ((num >> 8) & 255) / 255
    const b = (num & 255) / 255
    return [r, g, b]
}

function FluidVideoScene({ options }: { options: FluidVideoOptions }) {
    const { gl, size } = useThree()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
    
    // Simulation resolution
    const simWidth = Math.floor(size.width * 0.5)
    const simHeight = Math.floor(size.height * 0.5)
    
    // FBOs - we only need velocity now, not color
    const velocity1 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    const velocity2 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    const divergence = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    const pressure1 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    const pressure2 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })

    // Refs for swapping
    const refs = useRef({
        velocity: { read: velocity1, write: velocity2 },
        pressure: { read: pressure1, write: pressure2 },
    })
    
    // Pointer state
    const pointerRef = useRef({
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        isInteracting: false
    })

    // Update refs when FBOs change
    useEffect(() => {
        refs.current.velocity.read = velocity1
        refs.current.velocity.write = velocity2
        refs.current.pressure.read = pressure1
        refs.current.pressure.write = pressure2
    }, [velocity1, velocity2, pressure1, pressure2])

    // Load video texture
    useEffect(() => {
        if (!options.videoSrc) return

        const video = document.createElement('video')
        video.src = options.videoSrc
        video.loop = true
        video.muted = true
        video.playsInline = true
        video.autoplay = true
        videoRef.current = video

        const playPromise = video.play()
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Video playback failed:', error)
            })
        }

        const videoTexture = new THREE.VideoTexture(video)
        videoTexture.minFilter = THREE.LinearFilter
        videoTexture.magFilter = THREE.LinearFilter
        videoTextureRef.current = videoTexture

        return () => {
            video.pause()
            videoTexture.dispose()
        }
    }, [options.videoSrc])

    // Materials
    const materials = useMemo(() => {
        return {
            splat: new THREE.ShaderMaterial({
                uniforms: {
                    u_input_texture: { value: null },
                    u_ratio: { value: simWidth / simHeight },
                    u_point_value: { value: new THREE.Vector3() },
                    u_point: { value: new THREE.Vector2() },
                    u_point_size: { value: 0.0 }
                },
                vertexShader,
                fragmentShader: fragShaderPoint
            }),
            divergence: new THREE.ShaderMaterial({
                uniforms: {
                    u_velocity_texture: { value: null },
                    u_texel: { value: new THREE.Vector2(1/simWidth, 1/simHeight) }
                },
                vertexShader,
                fragmentShader: fragShaderDivergence
            }),
            pressure: new THREE.ShaderMaterial({
                uniforms: {
                    u_pressure_texture: { value: null },
                    u_divergence_texture: { value: null },
                    u_texel: { value: new THREE.Vector2(1/simWidth, 1/simHeight) }
                },
                vertexShader,
                fragmentShader: fragShaderPressure
            }),
            gradientSubtract: new THREE.ShaderMaterial({
                uniforms: {
                    u_pressure_texture: { value: null },
                    u_velocity_texture: { value: null },
                    u_texel: { value: new THREE.Vector2(1/simWidth, 1/simHeight) }
                },
                vertexShader,
                fragmentShader: fragShaderGradientSubtract
            }),
            advection: new THREE.ShaderMaterial({
                uniforms: {
                    u_velocity_texture: { value: null },
                    u_input_texture: { value: null },
                    u_texel: { value: new THREE.Vector2(1/simWidth, 1/simHeight) },
                    u_dt: { value: 1/60 },
                    u_dissipation: { value: options.velocityDissipation }
                },
                vertexShader,
                fragmentShader: fragShaderAdvection
            }),
            output: new THREE.ShaderMaterial({
                uniforms: {
                    u_velocity_texture: { value: null },
                    u_video_texture: { value: null },
                    u_texel: { value: new THREE.Vector2(1/simWidth, 1/simHeight) },
                    u_displacement_scale: { value: options.displacementScale },
                    u_chromatic_aberration: { value: options.chromaticAberration }
                },
                vertexShader,
                fragmentShader: fragShaderOutputShader
            })
        }
    }, [simWidth, simHeight, options.velocityDissipation, options.displacementScale, options.chromaticAberration])

    // Update uniforms that depend on size
    useEffect(() => {
        const texel = new THREE.Vector2(1/simWidth, 1/simHeight)
        
        materials.divergence.uniforms.u_texel.value = texel
        materials.pressure.uniforms.u_texel.value = texel
        materials.gradientSubtract.uniforms.u_texel.value = texel
        materials.advection.uniforms.u_texel.value = texel
        materials.output.uniforms.u_texel.value = texel
        materials.splat.uniforms.u_ratio.value = simWidth / simHeight
        
    }, [simWidth, simHeight, materials])

    // Update option uniforms
    useEffect(() => {
        materials.advection.uniforms.u_dissipation.value = options.velocityDissipation
        materials.output.uniforms.u_displacement_scale.value = options.displacementScale
        materials.output.uniforms.u_chromatic_aberration.value = options.chromaticAberration
    }, [materials, options.velocityDissipation, options.displacementScale, options.chromaticAberration])

    const scene = useMemo(() => {
        const s = new THREE.Scene()
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), materials.output)
        s.add(m)
        return s
    }, [materials])
    
    const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])

    useFrame((state) => {
        const { velocity, pressure } = refs.current
        const mesh = scene.children[0] as THREE.Mesh
        const t = state.clock.elapsedTime

        // Handle Pointer Interaction
        const p = pointerRef.current
        
        // Auto-move for preview or if interacting
        let targetX = 0
        let targetY = 0
        let isMoving = false

        if (options.isPreview) {
             targetX = (.5 - .45 * Math.sin(.003 * t * 1000 - 2))
             targetY = (.5 + .1 * Math.sin(.0025 * t * 1000) + .1 * Math.cos(.002 * t * 1000))
             isMoving = true
        } else {
            const uvX = (state.pointer.x + 1) / 2
            const uvY = (state.pointer.y + 1) / 2
            targetX = uvX
            targetY = uvY
            isMoving = true
        }

        if (isMoving) {
            const px = targetX * size.width
            const py = targetY * size.height
            
            if (p.x === 0 && p.y === 0) {
                p.x = px
                p.y = py
            }

            p.vx = 5 * (px - p.x)
            p.vy = 5 * (py - p.y)
            
            p.x = px
            p.y = py
            
            if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) {
                p.isInteracting = true
            } else {
                p.isInteracting = false
            }
        }

        // 1. Splat Velocity (only if interacting)
        if (p.isInteracting) {
            mesh.material = materials.splat
            materials.splat.uniforms.u_point.value.set(p.x / size.width, p.y / size.height)
            materials.splat.uniforms.u_point_size.value = options.splatRadius
            materials.splat.uniforms.u_input_texture.value = velocity.read.texture
            materials.splat.uniforms.u_point_value.value.set(p.vx * options.splatForce / 1000, p.vy * options.splatForce / 1000, 1)
            gl.setRenderTarget(velocity.write)
            gl.render(scene, camera)
            
            const tempV = velocity.read
            velocity.read = velocity.write
            velocity.write = tempV
        }

        // 2. Divergence
        mesh.material = materials.divergence
        materials.divergence.uniforms.u_velocity_texture.value = velocity.read.texture
        gl.setRenderTarget(divergence)
        gl.render(scene, camera)

        // 3. Pressure
        mesh.material = materials.pressure
        materials.pressure.uniforms.u_divergence_texture.value = divergence.texture
        
        for (let i = 0; i < options.pressureIterations; i++) {
            materials.pressure.uniforms.u_pressure_texture.value = pressure.read.texture
            gl.setRenderTarget(pressure.write)
            gl.render(scene, camera)
            
            const tempP = pressure.read
            pressure.read = pressure.write
            pressure.write = tempP
        }

        // 4. Gradient Subtract
        mesh.material = materials.gradientSubtract
        materials.gradientSubtract.uniforms.u_pressure_texture.value = pressure.read.texture
        materials.gradientSubtract.uniforms.u_velocity_texture.value = velocity.read.texture
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)
        
        const tempV2 = velocity.read
        velocity.read = velocity.write
        velocity.write = tempV2

        // 5. Advection (Velocity)
        mesh.material = materials.advection
        materials.advection.uniforms.u_velocity_texture.value = velocity.read.texture
        materials.advection.uniforms.u_input_texture.value = velocity.read.texture
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)

        const tempV3 = velocity.read
        velocity.read = velocity.write
        velocity.write = tempV3

        // Reset Render Target
        gl.setRenderTarget(null)

        // Update output material uniforms
        materials.output.uniforms.u_velocity_texture.value = velocity.read.texture
        if (videoTextureRef.current) {
            materials.output.uniforms.u_video_texture.value = videoTextureRef.current
        }
    })

    // Return a mesh that R3F will render to screen
    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <primitive object={materials.output} attach="material" />
        </mesh>
    )
}

export default function FluidVideoExperiment({ isPreview = false }: { isPreview?: boolean }) {
    const controls = isPreview ? DEFAULT_OPTIONS : useControls('Fluid Video', {
        videoSrc: { value: DEFAULT_OPTIONS.videoSrc },
        color: { value: DEFAULT_OPTIONS.color },
        
        // Fluid Physics
        velocityDissipation: { value: DEFAULT_OPTIONS.velocityDissipation, min: 0.9, max: 1.0, step: 0.001, label: 'Velocity Fade' },
        
        // Solver
        pressureIterations: { value: DEFAULT_OPTIONS.pressureIterations, min: 1, max: 30, step: 1, label: 'Solver Iters' },
        
        // Interaction
        splatRadius: { value: DEFAULT_OPTIONS.splatRadius, min: 0.0001, max: 0.01, step: 0.0001, label: 'Pointer Size' },
        splatForce: { value: DEFAULT_OPTIONS.splatForce, min: 1000, max: 10000, step: 100, label: 'Pointer Force' },
        
        // Displacement
        displacementScale: { value: DEFAULT_OPTIONS.displacementScale, min: 0, max: 200, step: 1, label: 'Displacement Scale' },
        chromaticAberration: { value: DEFAULT_OPTIONS.chromaticAberration, min: 0, max: 0.3, step: 0.01, label: 'Chromatic Aberration' },
    })

    return (
        <>
            <FluidVideoScene options={{ ...controls as FluidVideoOptions, isPreview }} />
            <OrthographicCamera makeDefault position={[0, 0, 1]} />
        </>
    )
}

