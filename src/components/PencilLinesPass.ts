import {
    Pass,
    FullScreenQuad,
} from 'three/examples/jsm/postprocessing/Pass.js';
import * as THREE from 'three';
import { PencilLinesMaterial } from './PencilLinesMaterial';

export class PencilLinesPass extends Pass {
    fsQuad: FullScreenQuad;
    material: PencilLinesMaterial;
    normalBuffer: THREE.WebGLRenderTarget;
    normalMaterial: THREE.ShaderMaterial;
    scene: THREE.Scene;
    camera: THREE.Camera;

    constructor({
        width,
        height,
        scene,
        camera,
        texture,
    }: {
        width: number;
        height: number;
        scene: THREE.Scene;
        camera: THREE.Camera;
        texture?: THREE.Texture;
    }) {
        super();
        this.scene = scene;
        this.camera = camera;

        this.material = new PencilLinesMaterial();
        this.fsQuad = new FullScreenQuad(this.material);
        this.material.uniforms.uResolution.value = new THREE.Vector2(
            width,
            height
        );

        if (texture) {
            this.material.uniforms.uTexture.value = texture;
        }

        const normalBuffer = new THREE.WebGLRenderTarget(width, height);
        normalBuffer.texture.format = THREE.RGBAFormat;
        normalBuffer.texture.type = THREE.HalfFloatType;
        normalBuffer.texture.minFilter = THREE.NearestFilter;
        normalBuffer.texture.magFilter = THREE.NearestFilter;
        normalBuffer.texture.generateMipmaps = false;
        normalBuffer.stencilBuffer = false;
        this.normalBuffer = normalBuffer;

        // Custom Normal Material that outputs World Space normals
        this.normalMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    // Transform normal to world space using modelMatrix
                    vNormal = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    // Output world normal as color [0, 1]
                    gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
                }
            `,
        });
    }

    setSize(width: number, height: number) {
        this.material.uniforms.uResolution.value.set(width, height);
        this.normalBuffer.setSize(width, height);
    }

    dispose() {
        this.material.dispose();
        this.fsQuad.dispose();
        this.normalBuffer.dispose();
        this.normalMaterial.dispose();
    }

    render(
        renderer: THREE.WebGLRenderer,
        writeBuffer: THREE.WebGLRenderTarget,
        readBuffer: THREE.WebGLRenderTarget
    ) {
        renderer.setRenderTarget(this.normalBuffer);
        renderer.setClearColor(0xffffff, 1.0);
        renderer.clear();

        const overrideMaterialValue = this.scene.overrideMaterial;
        this.scene.overrideMaterial = this.normalMaterial;
        renderer.render(this.scene, this.camera);
        this.scene.overrideMaterial = overrideMaterialValue;

        this.material.uniforms.uNormals.value = this.normalBuffer.texture;
        this.material.uniforms.tDiffuse.value = readBuffer.texture;

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
            this.fsQuad.render(renderer);
        }
    }
}
