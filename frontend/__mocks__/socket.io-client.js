const mockSocket = {
  id: 'mock-socket-id',
  connected: false,
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
  off: jest.fn(),
};

const io = jest.fn(() => mockSocket);

module.exports = { io, Socket: jest.fn(() => mockSocket) };