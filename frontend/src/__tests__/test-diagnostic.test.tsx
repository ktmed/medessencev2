/**
 * Diagnostic Test Suite - Identifies Core Testing Issues
 * This test file helps identify what's broken in the test environment
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// Test basic Jest setup
describe('Diagnostic Tests', () => {
  it('Jest environment works correctly', () => {
    expect(true).toBe(true)
  })

  it('React Testing Library works', () => {
    const TestComponent = () => <div>Hello Test</div>
    render(<TestComponent />)
    expect(screen.getByText('Hello Test')).toBeInTheDocument()
  })

  it('Mock functions work', () => {
    const mockFn = jest.fn()
    mockFn('test')
    expect(mockFn).toHaveBeenCalledWith('test')
  })

  it('Global fetch mock exists', () => {
    expect(typeof global.fetch).toBe('function')
  })

  it('WebSpeech mocks exist', () => {
    expect(global.speechSynthesis).toBeDefined()
    expect(global.SpeechRecognition).toBeDefined()
  })

  it('Module resolution works for utils', () => {
    const { generateId } = require('@/utils')
    expect(generateId()).toBe('test-id-123')
  })

  it('Module resolution works for languages', () => {
    const { getMedicalTerm } = require('@/utils/languages')
    expect(getMedicalTerm('findings', 'de')).toBe('Befunde')
  })

  it('Hook mock works', () => {
    const { useEnhancedSpeechToText } = require('@/hooks/useEnhancedSpeechToText')
    const hookResult = useEnhancedSpeechToText()
    expect(hookResult.isListening).toBe(false)
    expect(hookResult.hasRecognitionSupport).toBe(true)
  })
})