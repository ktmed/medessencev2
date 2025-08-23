import { io, Socket } from 'socket.io-client'
import { WebSocketClient } from '../websocket'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn()
}))

describe('WebSocketClient', () => {
  let mockSocket: any
  let wsClient: WebSocketClient

  beforeEach(() => {
    // Create mock socket
    mockSocket = {
      connected: false,
      id: 'test-socket-123',
      on: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      off: jest.fn()
    }

    // Mock io function
    ;(io as jest.Mock).mockReturnValue(mockSocket)

    // Clear any existing instance
    WebSocketClient['instance'] = null
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Connection Management', () => {
    it('creates singleton instance', () => {
      const client1 = WebSocketClient.getInstance()
      const client2 = WebSocketClient.getInstance()
      
      expect(client1).toBe(client2)
      expect(io).toHaveBeenCalledTimes(1)
    })

    it('connects to correct URL', () => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      
      expect(io).toHaveBeenCalledWith('https://test-backend.herokuapp.com', 
        expect.objectContaining({
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        })
      )
    })

    it('handles connection success', () => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      
      // Simulate connection
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectCallback()
      
      expect(wsClient.isConnected()).toBe(true)
    })

    it('handles disconnection', () => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      
      // Simulate disconnection
      mockSocket.connected = false
      const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1]
      disconnectCallback()
      
      expect(wsClient.isConnected()).toBe(false)
    })

    it('handles reconnection attempts', () => {
      wsClient = WebSocketClient.getInstance()
      const onReconnect = jest.fn()
      wsClient.on('reconnect_attempt', onReconnect)
      
      wsClient.connect('https://test-backend.herokuapp.com')
      
      const reconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'reconnect_attempt')[1]
      reconnectCallback(1)
      
      expect(onReconnect).toHaveBeenCalledWith(1)
    })

    it('handles connection errors', () => {
      wsClient = WebSocketClient.getInstance()
      const onError = jest.fn()
      wsClient.on('error', onError)
      
      wsClient.connect('https://test-backend.herokuapp.com')
      
      const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1]
      const error = new Error('Connection failed')
      errorCallback(error)
      
      expect(onError).toHaveBeenCalledWith(error)
    })
  })

  describe('Message Handling', () => {
    beforeEach(() => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      mockSocket.connected = true
    })

    it('emits messages when connected', () => {
      const testData = { text: 'Test transcription', language: 'de' }
      
      wsClient.emit('transcription', testData)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('transcription', testData)
    })

    it('queues messages when disconnected', () => {
      mockSocket.connected = false
      const testData = { text: 'Test transcription', language: 'de' }
      
      wsClient.emit('transcription', testData)
      
      expect(mockSocket.emit).not.toHaveBeenCalled()
      
      // Reconnect and check if message is sent
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectCallback()
      
      expect(mockSocket.emit).toHaveBeenCalledWith('transcription', testData)
    })

    it('handles incoming messages', () => {
      const onReport = jest.fn()
      wsClient.on('report', onReport)
      
      const reportCallback = mockSocket.on.mock.calls.find(call => call[0] === 'report')[1]
      const reportData = {
        id: 'report-123',
        befund: 'Test findings',
        beurteilung: 'Test assessment'
      }
      reportCallback(reportData)
      
      expect(onReport).toHaveBeenCalledWith(reportData)
    })

    it('handles multiple event listeners', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()
      
      wsClient.on('report', listener1)
      wsClient.on('report', listener2)
      
      const reportCallback = mockSocket.on.mock.calls.find(call => call[0] === 'report')[1]
      const reportData = { id: 'report-123' }
      reportCallback(reportData)
      
      expect(listener1).toHaveBeenCalledWith(reportData)
      expect(listener2).toHaveBeenCalledWith(reportData)
    })

    it('removes event listeners', () => {
      const listener = jest.fn()
      
      wsClient.on('report', listener)
      wsClient.off('report', listener)
      
      expect(mockSocket.off).toHaveBeenCalledWith('report', expect.any(Function))
    })
  })

  describe('Request-Response Pattern', () => {
    beforeEach(() => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      mockSocket.connected = true
    })

    it('sends request and waits for response', async () => {
      const requestData = { text: 'Test transcription' }
      const responseData = { report: 'Generated report' }
      
      // Start request
      const responsePromise = wsClient.request('generate-report', requestData)
      
      // Simulate server response
      setTimeout(() => {
        const ackCallback = mockSocket.emit.mock.calls[0][2]
        if (ackCallback) {
          ackCallback(responseData)
        }
      }, 10)
      
      const response = await responsePromise
      expect(response).toEqual(responseData)
    })

    it('handles request timeout', async () => {
      const requestData = { text: 'Test transcription' }
      
      const responsePromise = wsClient.request('generate-report', requestData, 100)
      
      await expect(responsePromise).rejects.toThrow('Request timeout')
    })

    it('handles request error', async () => {
      const requestData = { text: 'Test transcription' }
      const errorMessage = 'Server error'
      
      const responsePromise = wsClient.request('generate-report', requestData)
      
      // Simulate error response
      setTimeout(() => {
        const ackCallback = mockSocket.emit.mock.calls[0][2]
        if (ackCallback) {
          ackCallback({ error: errorMessage })
        }
      }, 10)
      
      await expect(responsePromise).rejects.toThrow(errorMessage)
    })
  })

  describe('Room Management', () => {
    beforeEach(() => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      mockSocket.connected = true
    })

    it('joins a room', () => {
      wsClient.joinRoom('session-123')
      
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', 'session-123')
    })

    it('leaves a room', () => {
      wsClient.leaveRoom('session-123')
      
      expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', 'session-123')
    })

    it('handles room-specific messages', () => {
      const onRoomMessage = jest.fn()
      wsClient.on('room-message', onRoomMessage)
      
      const roomCallback = mockSocket.on.mock.calls.find(call => call[0] === 'room-message')[1]
      const messageData = {
        room: 'session-123',
        message: 'Room broadcast'
      }
      roomCallback(messageData)
      
      expect(onRoomMessage).toHaveBeenCalledWith(messageData)
    })
  })

  describe('Health Monitoring', () => {
    beforeEach(() => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      mockSocket.connected = true
    })

    it('responds to ping with pong', () => {
      const pingCallback = mockSocket.on.mock.calls.find(call => call[0] === 'ping')[1]
      pingCallback()
      
      expect(mockSocket.emit).toHaveBeenCalledWith('pong')
    })

    it('tracks connection latency', () => {
      wsClient.startLatencyMonitoring()
      
      // Simulate ping-pong
      const pongCallback = mockSocket.on.mock.calls.find(call => call[0] === 'pong')[1]
      pongCallback({ latency: 45 })
      
      expect(wsClient.getLatency()).toBe(45)
    })

    it('detects connection quality', () => {
      wsClient.startLatencyMonitoring()
      
      // Simulate various latencies
      const pongCallback = mockSocket.on.mock.calls.find(call => call[0] === 'pong')[1]
      
      pongCallback({ latency: 20 })
      expect(wsClient.getConnectionQuality()).toBe('excellent')
      
      pongCallback({ latency: 100 })
      expect(wsClient.getConnectionQuality()).toBe('good')
      
      pongCallback({ latency: 300 })
      expect(wsClient.getConnectionQuality()).toBe('poor')
    })
  })

  describe('Authentication', () => {
    beforeEach(() => {
      wsClient = WebSocketClient.getInstance()
    })

    it('sends auth token on connection', () => {
      const authToken = 'Bearer test-token-123'
      wsClient.setAuthToken(authToken)
      
      wsClient.connect('https://test-backend.herokuapp.com')
      
      expect(io).toHaveBeenCalledWith('https://test-backend.herokuapp.com',
        expect.objectContaining({
          auth: { token: authToken }
        })
      )
    })

    it('handles authentication success', () => {
      const onAuthSuccess = jest.fn()
      wsClient.on('authenticated', onAuthSuccess)
      
      wsClient.connect('https://test-backend.herokuapp.com')
      
      const authCallback = mockSocket.on.mock.calls.find(call => call[0] === 'authenticated')[1]
      authCallback({ userId: 'user-123' })
      
      expect(onAuthSuccess).toHaveBeenCalledWith({ userId: 'user-123' })
    })

    it('handles authentication failure', () => {
      const onAuthError = jest.fn()
      wsClient.on('unauthorized', onAuthError)
      
      wsClient.connect('https://test-backend.herokuapp.com')
      
      const unauthCallback = mockSocket.on.mock.calls.find(call => call[0] === 'unauthorized')[1]
      unauthCallback({ message: 'Invalid token' })
      
      expect(onAuthError).toHaveBeenCalledWith({ message: 'Invalid token' })
    })
  })

  describe('Cleanup', () => {
    it('disconnects and cleans up on destroy', () => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      
      wsClient.destroy()
      
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(mockSocket.removeAllListeners).toHaveBeenCalled()
    })

    it('clears message queue on destroy', () => {
      wsClient = WebSocketClient.getInstance()
      wsClient.connect('https://test-backend.herokuapp.com')
      mockSocket.connected = false
      
      // Queue a message
      wsClient.emit('test', { data: 'test' })
      
      wsClient.destroy()
      
      // Reconnect should not send queued message
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectCallback()
      
      expect(mockSocket.emit).not.toHaveBeenCalledWith('test', { data: 'test' })
    })
  })
})