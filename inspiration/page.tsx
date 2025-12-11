'use client'

import { Suspense } from 'react'
import { CanvasExperimentContainer } from '../experiments/[slug]/components'
import FluidVideoExperiment from '../../experiments/fluid-distortion-text/ExperimentVideo'

export default function TestPage() {
  return (
    <main className="test-page">
      <div className="test-canvas-wrapper">
        <CanvasExperimentContainer>
          <FluidVideoExperiment isPreview={false} />
        </CanvasExperimentContainer>
      </div>

      <style jsx>{`
        .test-page {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          z-index: 1000;
        }

        .test-canvas-wrapper {
          width: 90vw;
          max-width: 1400px;
          height: 80vh;
          max-height: 900px;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 768px) {
          .test-canvas-wrapper {
            width: 95vw;
            height: 70vh;
            border-radius: 16px;
          }
        }
      `}</style>
    </main>
  )
}

