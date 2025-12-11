'use client'

import { useThree } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useRef, useEffect, useMemo, useState } from 'react'
import { Vector3, PerspectiveCamera } from 'three'
import { useAppState } from './AppStateProvider'
import { projects } from '../projects/content'
import { experiments } from '../experiments/content'
import { SCENE_CONFIG, VideoAlignment } from './sceneConfig'
import { getItemGridPosition, extractSlugsFromLayout, calculateGridWorldBounds } from './gridLayout'

// Calculate the about scene camera position
function calculateAboutCameraPosition(
  viewportWidth: number,
  viewportHeight: number,
  scrollPosition: number = 0
): Vector3 {
  const aboutCameraDistance = SCENE_CONFIG.ABOUT_CAMERA_DISTANCE
  const fovRad = (SCENE_CONFIG.CAMERA_FOV * Math.PI) / 180
  const tanHalfFov = Math.tan(fovRad / 2)
  const aspectRatio = viewportWidth / viewportHeight
  
  // Visible width at about camera distance
  const visibleWidthAtAbout = 2 * aboutCameraDistance * tanHalfFov * aspectRatio
  
  // Camera moves slightly to the right (homepage content still visible on left)
  const aboutCameraX = visibleWidthAtAbout * SCENE_CONFIG.ABOUT_CAMERA_X_OFFSET
  
  // Calculate scroll ratio for about camera distance
  const scrollRatio = (2 / viewportHeight) * aboutCameraDistance * tanHalfFov
  
  // Camera Y starts at initial position and moves with scroll
  const cameraY = SCENE_CONFIG.INITIAL_CAMERA_Y - (scrollPosition * scrollRatio)
  
  return new Vector3(aboutCameraX, cameraY, aboutCameraDistance)
}

// Easing function for smooth camera movement
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Camera rocking configuration
const ROCK_AMPLITUDE = 0.00 // Maximum rotation in radians (~1.7 degrees)
const ROCK_FREQUENCY = 0.004 // How fast the rocking cycles as you scroll

/**
 * Calculate aligned video position within a grid cell
 * This mirrors the logic in SelfManagingGalleryItem to get the actual video position
 */
const calculateAlignedPosition = (
  gridPos: { col: number; row: number },
  worldPos: Vector3,
  alignment: VideoAlignment,
  videoAspectRatio: number,
  gridCols: number,
  gridRows: number,
  viewportWidth: number,
  viewportHeight: number
): Vector3 => {
  // If center alignment, return original position
  if (alignment === 'center') {
    return worldPos.clone()
  }

  // Calculate cell dimensions using the same method as GridLines
  const { cellWidth, cellHeight } = calculateGridWorldBounds(
    gridCols,
    gridRows,
    viewportWidth,
    viewportHeight
  )

  // Calculate video dimensions in world units (same as SelfManagingGalleryItem)
  // Use mobile scale on mobile, regular scale otherwise
  const { columns } = SCENE_CONFIG.GRID_CONFIG
  const isMobile = gridCols === columns.mobile
  const videoScale = isMobile ? SCENE_CONFIG.MOBILE_VIDEO_SCALE : SCENE_CONFIG.VIDEO_SCALE
  
  const baseHeight = 9 // Base height from geometry
  const videoHeight = baseHeight * videoScale
  const videoWidth = videoHeight * videoAspectRatio

  // Calculate cell corners relative to cell center (worldPos)
  // GridLines draws vertical lines at: x = left + col * cellWidth
  // GridLines draws horizontal lines at: y = top - row * cellHeight
  // Cell center is at: x = left + (col + 0.5) * cellWidth, y = top - (row + 0.5) * cellHeight
  // So from center: top-left corner is at (-cellWidth/2, +cellHeight/2)
  const cellTopLeftX = worldPos.x - cellWidth / 2
  const cellTopLeftY = worldPos.y + cellHeight / 2
  const cellTopRightX = worldPos.x + cellWidth / 2
  const cellBottomLeftY = worldPos.y - cellHeight / 2

  // Position video center so its corner aligns with cell corner
  let videoCenterX = worldPos.x
  let videoCenterY = worldPos.y

  switch (alignment) {
    case 'top-left':
      // Video's top-left corner at cell's top-left corner
      videoCenterX = cellTopLeftX + videoWidth / 2
      videoCenterY = cellTopLeftY - videoHeight / 2
      break
    case 'top-right':
      // Video's top-right corner at cell's top-right corner
      videoCenterX = cellTopRightX - videoWidth / 2
      videoCenterY = cellTopLeftY - videoHeight / 2
      break
    case 'bottom-left':
      // Video's bottom-left corner at cell's bottom-left corner
      videoCenterX = cellTopLeftX + videoWidth / 2
      videoCenterY = cellBottomLeftY + videoHeight / 2
      break
    case 'bottom-right':
      // Video's bottom-right corner at cell's bottom-right corner
      videoCenterX = cellTopRightX - videoWidth / 2
      videoCenterY = cellBottomLeftY + videoHeight / 2
      break
  }

  const alignedPos = worldPos.clone()
  alignedPos.x = videoCenterX
  alignedPos.y = videoCenterY
  return alignedPos
}

// Get breakpoint type based on viewport width
type BreakpointType = 'mobile' | 'tablet' | 'laptop' | 'desktop'
const getBreakpointType = (viewportWidth: number): BreakpointType => {
  const { breakpoints } = SCENE_CONFIG.GRID_CONFIG
  if (viewportWidth <= breakpoints.mobile) return 'mobile'
  if (viewportWidth <= breakpoints.tablet) return 'tablet'
  if (viewportWidth <= breakpoints.laptop) return 'laptop'
  return 'desktop'
}

// Get target video width ratio based on breakpoint
// Returns what fraction of the viewport width the video should occupy
const getTargetWidthRatio = (breakpoint: BreakpointType): number => {
  switch (breakpoint) {
    case 'mobile': return 1.0      // Full width on mobile
    case 'tablet': return 0.5      // 60% width on tablet
    case 'laptop': return 0.6     // 75% width on laptop
    case 'desktop': return 0.6    // 75% width on desktop
  }
}

// Calculate camera position for zoomed view with responsive behavior
// Camera Z distance is calculated to make video fill the target width ratio
// Camera X/Y is positioned to anchor video to top-right (or top-center on mobile)
// Returns: camera position Vector3
const calculateZoomedCameraPosition = (
  videoPos: Vector3,
  worldOffsetX: number = 0,  // World-space offset in X (fallback if no viewport info)
  worldOffsetY: number = 0,  // World-space offset in Y (fallback if no viewport info)
  worldOffsetZ: number = 8,  // World-space offset in Z (fallback if no viewport info)
  viewportWidth?: number,    // Viewport width for dynamic positioning
  viewportHeight?: number,   // Viewport height for dynamic positioning
  videoAspectRatio?: number  // Video aspect ratio for dynamic positioning
): Vector3 => {
  // If viewport size and video aspect ratio are not provided, use fallback offsets
  if (viewportWidth === undefined || viewportHeight === undefined || videoAspectRatio === undefined) {
    return new Vector3(
      videoPos.x + worldOffsetX,
      videoPos.y + worldOffsetY,
      videoPos.z + worldOffsetZ
    )
  }
  
  const breakpoint = getBreakpointType(viewportWidth)
  const targetWidthRatio = getTargetWidthRatio(breakpoint)
  const isMobile = breakpoint === 'mobile'
  
  // Calculate video dimensions in world units
  // Use mobile scale on mobile, regular scale otherwise
  const baseHeight = 9 // Base height from geometry
  const videoScale = isMobile ? SCENE_CONFIG.MOBILE_VIDEO_SCALE : SCENE_CONFIG.VIDEO_SCALE
  const videoHeight = baseHeight * videoScale
  const videoWidth = videoHeight * videoAspectRatio
  
  // Camera FOV calculations
  const fovRad = (SCENE_CONFIG.CAMERA_FOV * Math.PI) / 180
  const tanHalfFov = Math.tan(fovRad / 2)
  const viewportAspectRatio = viewportWidth / viewportHeight
  
  // Calculate required camera Z distance so video fills targetWidthRatio of viewport width
  // Formula: visibleWidth = 2 * cameraZ * tan(FOV/2) * aspectRatio
  // We want: videoWidth = targetWidthRatio * visibleWidth
  // Solving: cameraZ = videoWidth / (targetWidthRatio * 2 * tan(FOV/2) * viewportAspectRatio)
  const cameraZ = videoPos.z + videoWidth / (targetWidthRatio * 2 * tanHalfFov * viewportAspectRatio)
  
  // Calculate visible area at the computed camera distance
  const cameraDistance = cameraZ - videoPos.z
  const viewportRightEdge = cameraDistance * tanHalfFov * viewportAspectRatio
  const viewportTopEdge = cameraDistance * tanHalfFov
  
  // Calculate top margin in world units (convert from vh)
  // visibleHeight = 2 * cameraDistance * tanHalfFov
  // marginWorld = (marginVh / 100) * visibleHeight
  const topMarginVh = SCENE_CONFIG.PROJECT_VIDEO_TOP_MARGIN_VH
  const visibleHeight = 2 * cameraDistance * tanHalfFov
  const topMarginWorld = (topMarginVh / 100) * visibleHeight
  
  let cameraX: number
  let cameraY: number
  
  if (isMobile) {
    // Mobile: video centered horizontally, anchored to top with margin
    // Video center = camera center (x = 0 relative offset)
    cameraX = videoPos.x
    
    // Video's top edge at viewport's top edge + margin
    // Adding topMarginWorld moves camera up, pushing video down on screen
    const dynamicOffsetY = (videoHeight / 2) - viewportTopEdge + topMarginWorld
    cameraY = videoPos.y + dynamicOffsetY
  } else {
    // Tablet/Laptop/Desktop: video anchored to top-right corner with margin from top
    // Video's right edge at viewport's right edge
    const dynamicOffsetX = (videoWidth / 2) - viewportRightEdge
    cameraX = videoPos.x + dynamicOffsetX
    
    // Video's top edge at viewport's top edge + margin
    // Adding topMarginWorld moves camera up, pushing video down on screen
    const dynamicOffsetY = (videoHeight / 2) - viewportTopEdge + topMarginWorld
    cameraY = videoPos.y + dynamicOffsetY
  }
  
  return new Vector3(cameraX, cameraY, cameraZ)
}

export function CameraController() {
  const { camera, size } = useThree()
  const { state } = useAppState()
  const { transition, scroll } = state
  
  // Camera state refs for smooth interpolation
  const targetPosition = useRef(new Vector3(0, SCENE_CONFIG.INITIAL_CAMERA_Y, SCENE_CONFIG.CAMERA_DISTANCE))
  const currentPosition = useRef(new Vector3(0, SCENE_CONFIG.INITIAL_CAMERA_Y, SCENE_CONFIG.CAMERA_DISTANCE))
  const lastPhase = useRef<string>('idle')
  
  // Scroll ratio ref for homepage - computed from viewport height for exact DOM matching
  const scrollRatioRef = useRef<number>(0.07) // For homepage (CAMERA_DISTANCE)
  
  // Cache aspect ratios for project videos
  const [aspectRatios, setAspectRatios] = useState<Map<string, number>>(new Map())
  
  // Detect aspect ratios for project videos
  useEffect(() => {
    const newAspectRatios = new Map<string, number>()
    const loadPromises: Promise<void>[] = []
    const videoElements: HTMLVideoElement[] = []
    
    // Set default aspect ratios immediately (will be updated when metadata loads)
    projects.forEach((project) => {
      newAspectRatios.set(project.slug, 16 / 9) // Default 16:9
    })
    setAspectRatios(new Map(newAspectRatios))
    
    projects.forEach((project) => {
      const video = document.createElement('video')
      video.src = project.video
      video.muted = true
      video.playsInline = true
      video.style.display = 'none'
      video.style.position = 'absolute'
      video.style.width = '1px'
      video.style.height = '1px'
      video.style.opacity = '0'
      video.style.pointerEvents = 'none'
      
      // Add to DOM temporarily to ensure metadata loads
      document.body.appendChild(video)
      videoElements.push(video)
      
      const promise = new Promise<void>((resolve) => {
        const handleLoadedMetadata = () => {
          if (video.videoWidth && video.videoHeight) {
            const ratio = video.videoWidth / video.videoHeight
            newAspectRatios.set(project.slug, ratio)
            setAspectRatios(new Map(newAspectRatios))
          }
          video.removeEventListener('loadedmetadata', handleLoadedMetadata)
          video.removeEventListener('error', handleError)
          resolve()
        }
        
        const handleError = () => {
          // Keep default 16:9 on error
          video.removeEventListener('loadedmetadata', handleLoadedMetadata)
          video.removeEventListener('error', handleError)
          resolve()
        }
        
        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('error', handleError)
        video.load()
      })
      
      loadPromises.push(promise)
    })
    
    // Cleanup: remove video elements after metadata loads
    Promise.all(loadPromises).finally(() => {
      videoElements.forEach((video) => {
        if (video.parentNode) {
          video.parentNode.removeChild(video)
        }
      })
    })
    
    // Cleanup on unmount
    return () => {
      videoElements.forEach((video) => {
        if (video.parentNode) {
          video.parentNode.removeChild(video)
        }
      })
    }
  }, [])
  
  // Pre-calculate all item positions (projects and experiments) and their zoomed camera positions
  // This is a Map of slug -> { itemPos, zoomedPos }
  // Recalculates when viewport size changes or aspect ratios update
  const itemPositions = useMemo(() => {
    // Get all slugs from the grid layout
    const gridSlugs = extractSlugsFromLayout()
    
    // Filter projects and experiments to only include those in the grid layout
    const projectsInGrid = projects.filter(p => gridSlugs.has(p.slug))
    const experimentsInGrid = experiments.filter(e => gridSlugs.has(e.slug))
    const allItems = [
      ...projectsInGrid.map(p => ({ slug: p.slug, type: 'project' as const })),
      ...experimentsInGrid.map(e => ({ slug: e.slug, type: 'experiment' as const }))
    ]
    
    const positions = new Map<string, { itemPos: Vector3; zoomedPos: Vector3 }>()
    
    allItems.forEach((item) => {
      const { worldPos, gridPos, gridCols, gridRows, textOptions } = getItemGridPosition(item.slug, size.width, size.height, allItems.length, 0)
      // Skip items that aren't in the grid layout
      if (worldPos && gridPos) {
        // Get the video aspect ratio
        const videoAspectRatio = aspectRatios.get(item.slug) || 16 / 9
        
        // Calculate the aligned position (where the video actually is in the grid cell)
        const alignment: VideoAlignment = textOptions?.videoAlignment ?? 'top-left'
        const alignedPos = calculateAlignedPosition(
          gridPos,
          worldPos,
          alignment,
          videoAspectRatio,
          gridCols,
          gridRows,
          size.width,
          size.height
        )
        
        // For projects, use dynamic X and Y positioning to align video's top-right corner with viewport's top-right
        // For experiments, use standard offsets
        if (item.type === 'project') {
          const zoomedPos = calculateZoomedCameraPosition(
            alignedPos,
            SCENE_CONFIG.ZOOM_OFFSET_X, // Will be overridden by dynamic calculation
            SCENE_CONFIG.PROJECT_ZOOM_Y_OFFSET, // Will be overridden by dynamic calculation
            SCENE_CONFIG.ZOOM_OFFSET_Z,
            size.width,
            size.height,
            videoAspectRatio
          )
          positions.set(item.slug, { itemPos: alignedPos, zoomedPos })
        } else {
          // Experiments use standard offsets, but we need to shift camera to align object
          // to the center of the right 2/3 column.
          // Column center is at 2/3 * width from left.
          // In normalized screen coords (-1 to 1), center is 0.
          // Column range is from -1 + 2*(1/3) = -0.333 to 1.
          // Column center is (-0.333 + 1)/2 = 0.333.
          // So we want the object to project to x = 0.333.
          
          const distance = SCENE_CONFIG.ZOOM_OFFSET_Z
          const fovRad = (SCENE_CONFIG.CAMERA_FOV * Math.PI) / 180
          const visibleHeight = 2 * distance * Math.tan(fovRad / 2)
          const visibleWidth = visibleHeight * (size.width / size.height)
          
          // Screen offset (normalized) = 0.333 = 1/3
          // World offset = (1/3) * (visibleWidth / 2) = visibleWidth / 6
          const shiftX = visibleWidth / 6
          
          // We want objectX - cameraX = shiftX => cameraX = objectX - shiftX
          // So we apply negative shiftX as offset to the camera position
          
          const zoomedPos = calculateZoomedCameraPosition(
            alignedPos,
            SCENE_CONFIG.ZOOM_OFFSET_X - shiftX,
            SCENE_CONFIG.ZOOM_OFFSET_Y,
            SCENE_CONFIG.ZOOM_OFFSET_Z
          )
          positions.set(item.slug, { itemPos: alignedPos, zoomedPos })
        }
      }
    })
    
    return positions
  }, [size.width, size.height, aspectRatios])
  
  // Update camera aspect ratio only when viewport size changes
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      camera.aspect = size.width / size.height
      camera.updateProjectionMatrix()
    }
  }, [size.width, size.height, camera])
  
  // Update scroll ratio for homepage when viewport height changes
  // Formula: (2 / viewportHeight) * cameraDistance * tan(FOV / 2)
  // This ensures camera movement matches DOM element scrolling exactly
  // Note: Project page scroll ratio is now calculated dynamically in useFrame
  // since camera Z distance varies by viewport size
  useEffect(() => {
    const viewportHeight = size.height
    const tanHalfFov = Math.tan((SCENE_CONFIG.CAMERA_FOV * Math.PI) / 360)
    // Homepage scroll ratio (camera at CAMERA_DISTANCE = 30)
    scrollRatioRef.current = (2 / viewportHeight) * SCENE_CONFIG.CAMERA_DISTANCE * tanHalfFov
  }, [size.height])
  
  // Helper to calculate scroll ratio for a given camera Z distance
  const calculateScrollRatio = (cameraZ: number): number => {
    const tanHalfFov = Math.tan((SCENE_CONFIG.CAMERA_FOV * Math.PI) / 360)
    return (2 / size.height) * cameraZ * tanHalfFov
  }
  
  useFrame(() => {
    
    const { phase, current, next, progress } = transition
    lastPhase.current = phase
    
    // Homepage: Scroll-based camera movement
    if (phase === 'idle' && current === 'homepage') {
      // Calculate camera Y based on scroll position
      // Camera starts above videos (positive Y) and moves down as user scrolls
      // Camera rotation is fixed (always faces down -Z axis)
      // Camera stays at x=0 on homepage (doesn't follow VIDEO_STAGGER_CENTER_X)
      const cameraY = SCENE_CONFIG.INITIAL_CAMERA_Y - (scroll.position * scrollRatioRef.current)
      targetPosition.current.set(0, cameraY, SCENE_CONFIG.CAMERA_DISTANCE)
    }
    // About page: Zoomed out camera position to the right
    else if (phase === 'idle' && current === 'about') {
      const aboutPos = calculateAboutCameraPosition(size.width, size.height, scroll.position)
      targetPosition.current.copy(aboutPos)
    }
    // Project page: Zoomed camera position with scroll-based movement
    else if (phase === 'idle' && current.startsWith('project-')) {
      const slug = current.replace('project-', '')
      const positionData = itemPositions.get(slug)
      if (positionData) {
        // Apply scroll-based Y movement from the zoomed position
        // Camera moves down as user scrolls, revealing gallery items below
        // Calculate scroll ratio dynamically based on actual camera Z distance
        const cameraDistance = positionData.zoomedPos.z // Camera Z is the distance from origin
        const dynamicScrollRatio = calculateScrollRatio(cameraDistance)
        const scrollOffset = scroll.position * dynamicScrollRatio
        targetPosition.current.set(
          positionData.zoomedPos.x,
          positionData.zoomedPos.y - scrollOffset,
          positionData.zoomedPos.z
        )
      }
    }
    // Experiment page: Fixed zoomed camera position (no scroll)
    else if (phase === 'idle' && current.startsWith('experiment-')) {
      const slug = current.replace('experiment-', '')
      const positionData = itemPositions.get(slug)
      if (positionData) {
        targetPosition.current.copy(positionData.zoomedPos)
      }
    }
    // Transitioning: Animate between positions
    else if (phase === 'transitioning') {
      const isZoomingIn = next?.startsWith('project-') || next?.startsWith('experiment-')
      const isZoomingOut = (current.startsWith('project-') || current.startsWith('experiment-')) && next === 'homepage'
      const isGoingToAbout = next === 'about'
      const isComingFromAbout = current === 'about' && next === 'homepage'
      
      if (isGoingToAbout) {
        // Homepage/Any → About: Zoom out and pan right
        const startPos = camera.position.clone()
        const endPos = calculateAboutCameraPosition(size.width, size.height, scroll.position)
        
        const eased = easeInOutCubic(progress)
        const transitionPos = startPos.clone().lerp(endPos, eased)
        
        currentPosition.current.copy(transitionPos)
        targetPosition.current.copy(transitionPos)
      } else if (isComingFromAbout) {
        // About → Homepage: Zoom in and pan left
        const startPos = camera.position.clone()
        const endCameraY = SCENE_CONFIG.INITIAL_CAMERA_Y - (scroll.position * scrollRatioRef.current)
        const endPos = new Vector3(0, endCameraY, SCENE_CONFIG.CAMERA_DISTANCE)
        
        const eased = easeInOutCubic(progress)
        const transitionPos = startPos.clone().lerp(endPos, eased)
        
        currentPosition.current.copy(transitionPos)
        targetPosition.current.copy(transitionPos)
      } else if (isZoomingIn && next) {
        // Homepage → Project/Experiment: Zoom in
        // Read the camera position directly
        const startPos = camera.position.clone()
        
        // Get zoomed position from pre-calculated map
        const slug = next.replace('project-', '').replace('experiment-', '')
        const positionData = itemPositions.get(slug)
        
        if (positionData) {
          // For projects, target includes scroll offset using dynamic scroll ratio
          // For experiments, target is the fixed zoomed position
          let targetPos = positionData.zoomedPos.clone()
          if (next.startsWith('project-')) {
            const cameraDistance = positionData.zoomedPos.z
            const dynamicScrollRatio = calculateScrollRatio(cameraDistance)
            const scrollOffset = scroll.position * dynamicScrollRatio
            targetPos.y = positionData.zoomedPos.y - scrollOffset
          }
          
          const eased = easeInOutCubic(progress)
          const transitionPos = startPos.clone().lerp(targetPos, eased)
          
          currentPosition.current.copy(transitionPos)
          targetPosition.current.copy(transitionPos)
        }
      } else if (isZoomingOut) {
        // Project/Experiment → Homepage: Zoom out
        // Start from current camera position
        const startPos = camera.position.clone()
        
        // End at homepage camera position (based on current scroll)
        const endCameraY = SCENE_CONFIG.INITIAL_CAMERA_Y - (scroll.position * scrollRatioRef.current)
        const endPos = new Vector3(0, endCameraY, SCENE_CONFIG.CAMERA_DISTANCE)
        
        const eased = easeInOutCubic(progress)
        const transitionPos = startPos.clone().lerp(endPos, eased)
        
        currentPosition.current.copy(transitionPos)
        targetPosition.current.copy(transitionPos)
      }
    }
    
    // Smoothly interpolate camera to target (only when not transitioning)
    if (phase !== 'transitioning') {
      const lerpFactor = 1
      currentPosition.current.lerp(targetPosition.current, lerpFactor)
    }
    
    // Update camera position
    camera.position.copy(currentPosition.current)
    
    // Calculate camera rotation with subtle rocking motion on homepage
    if (phase === 'idle' && current === 'homepage') {
      // Rock the camera left to right based on scroll position
      // Using sine wave for smooth oscillation
      const rockAngle = Math.sin(scroll.position * ROCK_FREQUENCY) * ROCK_AMPLITUDE
      camera.rotation.set(0, rockAngle, 0) // Rotate around Y axis (yaw)
    } else {
      // Fixed rotation for project pages and transitions
      camera.rotation.set(0, 0, 0) // Always faces down -Z axis
    }
  })
  
  return null // This component doesn't render anything
}
