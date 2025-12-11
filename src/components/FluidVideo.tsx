'use client'

import { OrthographicCamera, useFBO } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'

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

const fragShaderOutput = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D u_velocity_texture;
    uniform sampler2D u_video_texture;
    uniform vec2 u_texel;
    uniform float u_displacement_scale;
    uniform float u_chromatic_aberration;

    void main () {
        vec2 velocity = texture2D(u_velocity_texture, vUv).xy;
        vec2 displacement = velocity * u_displacement_scale * u_texel;
        vec2 baseUV = vUv;
        
        if (u_chromatic_aberration > 0.0) {
            vec2 redUV = clamp(baseUV + displacement * (1.0 + u_chromatic_aberration), 0.0, 1.0);
            vec2 greenUV = clamp(baseUV + displacement, 0.0, 1.0);
            vec2 blueUV = clamp(baseUV + displacement * (1.0 - u_chromatic_aberration), 0.0, 1.0);
            
            float r = texture2D(u_video_texture, redUV).r;
            float g = texture2D(u_video_texture, greenUV).g;
            float b = texture2D(u_video_texture, blueUV).b;
            float a = texture2D(u_video_texture, greenUV).a;
            
            gl_FragColor = vec4(r, g, b, a);
        } else {
            vec2 displacedUV = clamp(baseUV + displacement, 0.0, 1.0);
            gl_FragColor = texture2D(u_video_texture, displacedUV);
        }
    }
`

export type FluidVideoOptions = {
    videoSrc: string
    velocityDissipation?: number
    pressureIterations?: number
    splatRadius?: number
    splatForce?: number
    displacementScale?: number
    chromaticAberration?: number
}

const DEFAULT_OPTIONS = {
    velocityDissipation: 0.98,
    pressureIterations: 10,
    splatRadius: 0.0025,
    splatForce: 6000,
    displacementScale: 50.0,
    chromaticAberration: 0.0
}

function FluidVideoScene({ options }: { options: Required<FluidVideoOptions> }) {
    const { gl, size } = useThree()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
    
    const simWidth = Math.floor(size.width * 0.5)
    const simHeight = Math.floor(size.height * 0.5)
    
    const velocity1 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    const velocity2 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    const divergence = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    const pressure1 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    const pressure2 = useFBO(simWidth, simHeight, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })

    const refs = useRef({
        velocity: { read: velocity1, write: velocity2 },
        pressure: { read: pressure1, write: pressure2 },
    })
    
    const pointerRef = useRef({
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        isInteracting: false,
        // Touch state
        isTouching: false,
        touchX: 0,
        touchY: 0,
        touchVx: 0,
        touchVy: 0,
        lastTouchTime: 0,
        // Click/tap ripple state
        pendingClicks: [] as { x: number; y: number; vx: number; vy: number }[]
    })

    useEffect(() => {
        refs.current.velocity.read = velocity1
        refs.current.velocity.write = velocity2
        refs.current.pressure.read = pressure1
        refs.current.pressure.write = pressure2
    }, [velocity1, velocity2, pressure1, pressure2])

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
                fragmentShader: fragShaderOutput
            })
        }
    }, [simWidth, simHeight, options.velocityDissipation, options.displacementScale, options.chromaticAberration])

    useEffect(() => {
        const texel = new THREE.Vector2(1/simWidth, 1/simHeight)
        
        materials.divergence.uniforms.u_texel.value = texel
        materials.pressure.uniforms.u_texel.value = texel
        materials.gradientSubtract.uniforms.u_texel.value = texel
        materials.advection.uniforms.u_texel.value = texel
        materials.output.uniforms.u_texel.value = texel
        materials.splat.uniforms.u_ratio.value = simWidth / simHeight
        
    }, [simWidth, simHeight, materials])

    useEffect(() => {
        materials.advection.uniforms.u_dissipation.value = options.velocityDissipation
        materials.output.uniforms.u_displacement_scale.value = options.displacementScale
        materials.output.uniforms.u_chromatic_aberration.value = options.chromaticAberration
    }, [materials, options.velocityDissipation, options.displacementScale, options.chromaticAberration])

    // Touch and click event handlers
    const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
        const canvas = gl.domElement
        const rect = canvas.getBoundingClientRect()
        const x = ((clientX - rect.left) / rect.width) * size.width
        const y = ((rect.bottom - clientY) / rect.height) * size.height
        return { x, y }
    }, [gl.domElement, size.width, size.height])

    useEffect(() => {
        const canvas = gl.domElement
        const p = pointerRef.current
        
        // Throttle interval for touch events (ms) - ~60fps
        const TOUCH_THROTTLE = 16
        
        // Click/tap handler - creates a ripple burst
        const handleClick = (e: MouseEvent) => {
            const { x, y } = getCanvasCoords(e.clientX, e.clientY)
            // Create random velocity for burst effect
            const angle = Math.random() * Math.PI * 2
            const strength = 50 + Math.random() * 50
            p.pendingClicks.push({
                x,
                y,
                vx: Math.cos(angle) * strength,
                vy: Math.sin(angle) * strength
            })
        }
        
        // Touch start - initialize touch tracking
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0]
                const { x, y } = getCanvasCoords(touch.clientX, touch.clientY)
                p.isTouching = true
                p.touchX = x
                p.touchY = y
                p.touchVx = 0
                p.touchVy = 0
                p.lastTouchTime = performance.now()
                
                // Also trigger a click ripple on touch start
                const angle = Math.random() * Math.PI * 2
                const strength = 50 + Math.random() * 50
                p.pendingClicks.push({
                    x,
                    y,
                    vx: Math.cos(angle) * strength,
                    vy: Math.sin(angle) * strength
                })
            }
        }
        
        // Touch move - throttled for performance
        const handleTouchMove = (e: TouchEvent) => {
            if (!p.isTouching || e.touches.length === 0) return
            
            const now = performance.now()
            if (now - p.lastTouchTime < TOUCH_THROTTLE) return
            
            const touch = e.touches[0]
            const { x, y } = getCanvasCoords(touch.clientX, touch.clientY)
            
            const dt = (now - p.lastTouchTime) / 1000
            if (dt > 0) {
                p.touchVx = 5 * (x - p.touchX)
                p.touchVy = 5 * (y - p.touchY)
            }
            
            p.touchX = x
            p.touchY = y
            p.lastTouchTime = now
        }
        
        // Touch end
        const handleTouchEnd = () => {
            p.isTouching = false
            p.touchVx = 0
            p.touchVy = 0
        }
        
        canvas.addEventListener('click', handleClick)
        canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
        canvas.addEventListener('touchmove', handleTouchMove, { passive: true })
        canvas.addEventListener('touchend', handleTouchEnd)
        canvas.addEventListener('touchcancel', handleTouchEnd)
        
        return () => {
            canvas.removeEventListener('click', handleClick)
            canvas.removeEventListener('touchstart', handleTouchStart)
            canvas.removeEventListener('touchmove', handleTouchMove)
            canvas.removeEventListener('touchend', handleTouchEnd)
            canvas.removeEventListener('touchcancel', handleTouchEnd)
        }
    }, [gl.domElement, getCanvasCoords])

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

        const p = pointerRef.current
        
        // Helper function to apply a splat
        const applySplat = (px: number, py: number, vx: number, vy: number, radius?: number) => {
            mesh.material = materials.splat
            materials.splat.uniforms.u_point.value.set(px / size.width, py / size.height)
            materials.splat.uniforms.u_point_size.value = radius ?? options.splatRadius
            materials.splat.uniforms.u_input_texture.value = velocity.read.texture
            materials.splat.uniforms.u_point_value.value.set(vx * options.splatForce / 1000, vy * options.splatForce / 1000, 1)
            gl.setRenderTarget(velocity.write)
            gl.render(scene, camera)
            
            const tempV = velocity.read
            velocity.read = velocity.write
            velocity.write = tempV
        }
        
        // Process pending click/tap ripples
        while (p.pendingClicks.length > 0) {
            const click = p.pendingClicks.shift()!
            applySplat(click.x, click.y, click.vx, click.vy, options.splatRadius * 1.5)
        }
        
        // Handle touch input (takes priority over mouse when active)
        if (p.isTouching) {
            const touchInteracting = Math.abs(p.touchVx) > 0.1 || Math.abs(p.touchVy) > 0.1
            if (touchInteracting) {
                applySplat(p.touchX, p.touchY, p.touchVx, p.touchVy)
            }
        } else {
            // Handle mouse input when not touching
            const uvX = (state.pointer.x + 1) / 2
            const uvY = (state.pointer.y + 1) / 2
            const targetX = uvX
            const targetY = uvY

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

            // 1. Splat Velocity (mouse)
            if (p.isInteracting) {
                applySplat(p.x, p.y, p.vx, p.vy)
            }
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

        // 5. Advection
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

        // Update output
        materials.output.uniforms.u_velocity_texture.value = velocity.read.texture
        if (videoTextureRef.current) {
            materials.output.uniforms.u_video_texture.value = videoTextureRef.current
        }
    })

    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <primitive object={materials.output} attach="material" />
        </mesh>
    )
}

export default function FluidVideo({ 
    videoSrc,
    velocityDissipation = DEFAULT_OPTIONS.velocityDissipation,
    pressureIterations = DEFAULT_OPTIONS.pressureIterations,
    splatRadius = DEFAULT_OPTIONS.splatRadius,
    splatForce = DEFAULT_OPTIONS.splatForce,
    displacementScale = DEFAULT_OPTIONS.displacementScale,
    chromaticAberration = DEFAULT_OPTIONS.chromaticAberration
}: FluidVideoOptions) {
    const options: Required<FluidVideoOptions> = {
        videoSrc,
        velocityDissipation,
        pressureIterations,
        splatRadius,
        splatForce,
        displacementScale,
        chromaticAberration
    }

    return (
        <>
            <FluidVideoScene options={options} />
            <OrthographicCamera makeDefault position={[0, 0, 1]} />
        </>
    )
}
