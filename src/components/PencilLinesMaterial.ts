import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const fragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D uNormals;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uSobelThresholdMin;
uniform float uSobelThresholdMax;
uniform float uTime;
uniform float uDistortionScale;
uniform float uUseColor;

varying vec2 vUv;

// Gradient noise function
vec2 grad( ivec2 z ) {
    int n = z.x+z.y*11111;
    n = (n<<13)^n;
    n = (n*(n*n*15731+789221)+1376312589)>>16;
    n &= 7;
    vec2 gr = vec2(n&1,n>>1)*2.0-1.0;
    return ( n>=6 ) ? vec2(0.0,gr.x) : 
           ( n>=4 ) ? vec2(gr.x,0.0) :
                              gr;                            
}

float noise( in vec2 p ) {
    ivec2 i = ivec2(floor( p ));
    vec2 f =       fract( p );
    vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( dot( grad( i+ivec2(0,0) ), f-vec2(0.0,0.0) ), 
                     dot( grad( i+ivec2(1,0) ), f-vec2(1.0,0.0) ), u.x),
                mix( dot( grad( i+ivec2(0,1) ), f-vec2(0.0,1.0) ), 
                     dot( grad( i+ivec2(1,1) ), f-vec2(1.0,1.0) ), u.x), u.y);
}

float valueAtPoint(sampler2D image, vec2 coord, vec2 texel, vec2 point) {
    vec3 luma = vec3(0.299, 0.587, 0.114);
    return dot(texture2D(image, coord + texel * point).xyz, luma);
}

float diffuseValue(int x, int y) {
    float cutoff = 40.0;
    float offset =  0.5 / cutoff;
    // Offset UV by time to animate noise
    float noiseValue = clamp(texture2D(uTexture, vUv + vec2(sin(uTime), cos(uTime))*0.1).r, 0.0, cutoff) / cutoff - offset;
    noiseValue *= uDistortionScale;

    return valueAtPoint(tDiffuse, vUv + noiseValue, vec2(1.0 / uResolution.x, 1.0 / uResolution.y), vec2(x, y)) * 0.6;
}

float normalValue(int x, int y) {
    float cutoff = 50.0;
    float offset = 0.5 / cutoff;
    // Offset UV by time here too
    float noiseValue = clamp(texture2D(uTexture, vUv + vec2(sin(uTime), cos(uTime))*0.1).r, 0.0, cutoff) / cutoff - offset;
    noiseValue *= uDistortionScale;
    
    return valueAtPoint(uNormals, vUv + noiseValue, vec2(1.0 / uResolution.x, 1.0 / uResolution.y), vec2(x, y)) * 0.3;
}

float getValue(int x, int y) {
    float noiseValue = noise(gl_FragCoord.xy);
    noiseValue = noiseValue * 2.0 - 1.0;
    noiseValue *= 10.0;
    
    return diffuseValue(x, y) + normalValue(x, y) * noiseValue;
}

float combinedSobelValue() {
    const mat3 Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);
    const mat3 Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);

    float tx0y0 = getValue(-1, -1);
    float tx0y1 = getValue(-1, 0);
    float tx0y2 = getValue(-1, 1);

    float tx1y0 = getValue(0, -1);
    float tx1y1 = getValue(0, 0);
    float tx1y2 = getValue(0, 1);

    float tx2y0 = getValue(1, -1);
    float tx2y1 = getValue(1, 0);
    float tx2y2 = getValue(1, 1);

    float valueGx = Gx[0][0] * tx0y0 + Gx[1][0] * tx1y0 + Gx[2][0] * tx2y0 +
    Gx[0][1] * tx0y1 + Gx[1][1] * tx1y1 + Gx[2][1] * tx2y1 +
    Gx[0][2] * tx0y2 + Gx[1][2] * tx1y2 + Gx[2][2] * tx2y2;

    float valueGy = Gy[0][0] * tx0y0 + Gy[1][0] * tx1y0 + Gy[2][0] * tx2y0 +
    Gy[0][1] * tx0y1 + Gy[1][1] * tx1y1 + Gy[2][1] * tx2y1 +
    Gy[0][2] * tx0y2 + Gy[1][2] * tx1y2 + Gy[2][2] * tx2y2;

    float G = (valueGx * valueGx) + (valueGy * valueGy);
    return clamp(G, 0.0, 1.0);
}

void main() {
    float sobelValue = combinedSobelValue();
    sobelValue = smoothstep(uSobelThresholdMin, uSobelThresholdMax, sobelValue);

    vec4 sceneColor = texture2D(tDiffuse, vUv);
    vec4 lineColor = vec4(uLineColor, 1.0);
    vec4 baseColor = vec4(uBaseColor, 1.0);

    // If uUseColor is 1, mix the line color with the darkened scene color
    vec3 finalLineColor = mix(uLineColor, sceneColor.rgb * 0.5, uUseColor);

    if (sobelValue > 0.1) {
        gl_FragColor = vec4(finalLineColor, 1.0);
    } else {
        gl_FragColor = baseColor;
    }
}
`;

export class PencilLinesMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            uniforms: {
                tDiffuse: { value: null },
                uNormals: { value: null },
                uTexture: { value: null },
                uResolution: {
                    value: new THREE.Vector2(1, 1),
                },
                uLineColor: { value: new THREE.Color(0.32, 0.12, 0.2) },
                uBaseColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
                uSobelThresholdMin: { value: 0.01 },
                uSobelThresholdMax: { value: 0.03 },
                uTime: { value: 0 },
                uDistortionScale: { value: 1.0 },
                uUseColor: { value: 0.0 },
            },
            fragmentShader,
            vertexShader,
        });
    }
}
