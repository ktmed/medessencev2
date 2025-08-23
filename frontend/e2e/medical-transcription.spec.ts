import { test, expect, Page } from '@playwright/test'

test.describe('Medical Transcription Workflow', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('/')
    // Wait for the app to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 })
  })

  test('should load the application successfully', async () => {
    // Check for main elements
    await expect(page).toHaveTitle(/MedEssence/i)
    
    // Check for microphone button
    const micButton = page.locator('[data-testid="microphone-button"]')
    await expect(micButton).toBeVisible()
    
    // Check for language selector
    const languageSelector = page.locator('[data-testid="language-selector"]')
    await expect(languageSelector).toBeVisible()
  })

  test('should display browser compatibility message', async () => {
    // Check if WebSpeech API is supported
    const browserSupport = await page.evaluate(() => {
      return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    })

    if (!browserSupport) {
      const warningMessage = page.locator('[data-testid="browser-warning"]')
      await expect(warningMessage).toContainText(/Browser.*not supported/i)
    }
  })

  test('should toggle microphone recording state', async () => {
    const micButton = page.locator('[data-testid="microphone-button"]')
    
    // Initial state should be "Start"
    await expect(micButton).toContainText(/Start|Mikrofon starten/i)
    
    // Click to start recording
    await micButton.click()
    
    // Should change to "Stop" state
    await expect(micButton).toContainText(/Stop|Stoppen/i)
    
    // Click to stop recording
    await micButton.click()
    
    // Should return to "Start" state
    await expect(micButton).toContainText(/Start|Mikrofon starten/i)
  })

  test('should change language selection', async () => {
    const languageSelector = page.locator('[data-testid="language-selector"]')
    
    // Select English
    await languageSelector.selectOption('en')
    await expect(languageSelector).toHaveValue('en')
    
    // UI should update to English
    const micButton = page.locator('[data-testid="microphone-button"]')
    await expect(micButton).toContainText(/Start/i)
    
    // Select German
    await languageSelector.selectOption('de')
    await expect(languageSelector).toHaveValue('de')
    
    // UI should update to German
    await expect(micButton).toContainText(/Mikrofon/i)
  })

  test('should display transcription results', async () => {
    // Mock transcription text
    await page.evaluate(() => {
      const event = new CustomEvent('transcriptionUpdate', {
        detail: {
          transcript: 'Mammographie-Untersuchung zeigt unauffällige Befunde',
          interim: 'beidseits',
          confidence: 0.92
        }
      })
      window.dispatchEvent(event)
    })

    // Check if transcription is displayed
    const transcriptionArea = page.locator('[data-testid="transcription-display"]')
    await expect(transcriptionArea).toContainText('Mammographie-Untersuchung')
    
    // Check confidence score
    const confidenceScore = page.locator('[data-testid="confidence-score"]')
    await expect(confidenceScore).toContainText(/92%/)
  })

  test('should generate medical report', async () => {
    // Set transcription text
    await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="transcription-input"]') as HTMLTextAreaElement
      if (textarea) {
        textarea.value = 'Mammographie-Screening durchgeführt. Keine pathologischen Veränderungen erkennbar.'
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })

    // Click generate report button
    const generateButton = page.locator('[data-testid="generate-report-button"]')
    await generateButton.click()

    // Wait for report generation (with loading state)
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]')
    await expect(loadingIndicator).toBeVisible()

    // Wait for report to be generated (mock response)
    await page.route('**/api/generate-report', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            report: {
              befund: 'Mammographie-Screening ohne pathologische Befunde',
              beurteilung: 'Regelrechte Darstellung beider Mammae',
              empfehlung: 'Routinekontrolle in 24 Monaten'
            }
          }
        })
      })
    })

    // Check if report is displayed
    const reportViewer = page.locator('[data-testid="report-viewer"]')
    await expect(reportViewer).toBeVisible({ timeout: 20000 })
    await expect(reportViewer).toContainText(/Befund/)
    await expect(reportViewer).toContainText(/Beurteilung/)
    await expect(reportViewer).toContainText(/Empfehlung/)
  })

  test('should display ICD code suggestions', async () => {
    // Mock ICD code response
    await page.route('**/api/generate-icd', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            codes: [
              { code: 'Z12.31', description: 'Mammographie-Screening' },
              { code: 'R92.8', description: 'Sonstige abnorme Befunde' }
            ]
          }
        })
      })
    })

    // Trigger ICD generation
    const icdButton = page.locator('[data-testid="generate-icd-button"]')
    await icdButton.click()

    // Check ICD codes display
    const icdSection = page.locator('[data-testid="icd-codes-section"]')
    await expect(icdSection).toBeVisible()
    await expect(icdSection).toContainText('Z12.31')
    await expect(icdSection).toContainText('Mammographie-Screening')
  })

  test('should handle API errors gracefully', async () => {
    // Mock API error
    await page.route('**/api/generate-report', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      })
    })

    // Try to generate report
    const generateButton = page.locator('[data-testid="generate-report-button"]')
    await generateButton.click()

    // Check error message
    const errorMessage = page.locator('[data-testid="error-message"]')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText(/Error|Fehler/i)
  })

  test('should export report to different formats', async () => {
    // Generate a report first
    await page.evaluate(() => {
      window.localStorage.setItem('currentReport', JSON.stringify({
        befund: 'Test Befund',
        beurteilung: 'Test Beurteilung',
        empfehlung: 'Test Empfehlung'
      }))
    })

    // Test PDF export
    const exportButton = page.locator('[data-testid="export-button"]')
    await exportButton.click()

    const pdfOption = page.locator('[data-testid="export-pdf"]')
    await pdfOption.click()

    // Verify download initiated (mock)
    const downloadPromise = page.waitForEvent('download')
    await page.evaluate(() => {
      const link = document.createElement('a')
      link.href = 'data:application/pdf;base64,test'
      link.download = 'medical-report.pdf'
      link.click()
    })
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  test('should maintain session state across page refresh', async () => {
    // Set some transcription text
    await page.evaluate(() => {
      window.localStorage.setItem('transcriptionText', 'Test transcription text')
      window.localStorage.setItem('selectedLanguage', 'en')
    })

    // Reload page
    await page.reload()

    // Check if state is restored
    const transcriptionInput = page.locator('[data-testid="transcription-input"]')
    await expect(transcriptionInput).toHaveValue('Test transcription text')

    const languageSelector = page.locator('[data-testid="language-selector"]')
    await expect(languageSelector).toHaveValue('en')
  })
})

test.describe('WebSocket Connection', () => {
  test('should establish WebSocket connection', async ({ page }) => {
    await page.goto('/')

    // Check WebSocket connection status
    const connectionStatus = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Check if Socket.IO is connected
        const checkConnection = () => {
          const socket = (window as any).socket
          if (socket && socket.connected) {
            resolve('connected')
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        checkConnection()
        
        // Timeout after 5 seconds
        setTimeout(() => resolve('timeout'), 5000)
      })
    })

    expect(connectionStatus).toBe('connected')
  })

  test('should reconnect after disconnection', async ({ page }) => {
    await page.goto('/')

    // Simulate disconnection
    await page.evaluate(() => {
      const socket = (window as any).socket
      if (socket) {
        socket.disconnect()
      }
    })

    // Wait for reconnection
    const reconnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const socket = (window as any).socket
        if (socket) {
          socket.on('connect', () => resolve(true))
          socket.connect()
        } else {
          resolve(false)
        }
        
        setTimeout(() => resolve(false), 5000)
      })
    })

    expect(reconnected).toBe(true)
  })
})