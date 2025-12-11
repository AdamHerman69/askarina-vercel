# Sketchy Pencil Effect with Three.js Post-Processing

In this tutorial, you’ll learn how to create a sketchy, pencil effect using Three.js post-processing. We’ll go through the steps for creating a custom post-processing render pass, implementing edge detection in WebGL, re-rendering the normal buffer to a render target, and tweaking the end result with generated and imported textures.

## Post-processing in Three.js

Post-processing in Three.js is a way of applying effects to your rendered scene after it has been drawn. In addition to all the out-of-the-box post-processing effects provided by Three.js, it is also possible to add your own filters by creating custom render passes.

A custom render pass is essentially a function that takes in an image of the scene and returns a new image, with the desired effect applied. You can think of these render passes like layer effects in Photoshop—each applies a new filter based on the previous effect output. The resulting image is a combination of all the different effects.

## Enabling post-processing in Three.js

To add post-processing to our scene, we need to set up our scene rendering to use an `EffectComposer` in addition to the `WebGLRenderer`. The effect composer stacks the post-processing effects one on top of the other, in the order in which they’re passed. If we want our rendered scene to be passed to the next effect, we need to add the `RenderPass` post-processing pass is passed first.

## Sobel operator for creating outlines

We need to be able to tell the computer to detect lines based on our input image, in this case the rendered scene. The kind of edge detection we’ll be using is called the Sobel operator.

The Sobel operator does edge detection by looking at the gradient of a small section of the image—essentially how sharp the transition from one value to another is. The image is broken down into smaller “kernels”, or 3px by 3px squares where the central pixel is the one currently being processed.

## Creating a custom render pass

A custom pass inherits from the Pass class and has three methods: setSize, render, and dispose. We focus on the render method to implement our logic, creating a `PencilLinesPass` that handles the normal buffer generation and the final composition.

## Implementation Details

The effect works by:
1. Rendering the scene to a normal buffer (capturing surface orientation).
2. Using a custom shader (`PencilLinesMaterial`) that implements the Sobel operator.
3. Combining edge detection from both the diffuse (color) buffer and the normal buffer.
4. Applying generated noise for a sketchy shading effect.
5. Using a noise texture to distort the lines, giving them a hand-drawn feel.

