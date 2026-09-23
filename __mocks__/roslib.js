// Auto-mocked for Jest: roslib is ESM-only and Jest (CJS) cannot require it.
module.exports = {
  Ros: jest.fn(() => ({
    on: jest.fn(),
    isConnected: false,
  })),
  Topic: jest.fn(() => ({
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn(),
  })),
  Service: jest.fn(() => ({
    callService: jest.fn(),
  })),
  Action: jest.fn(() => ({
    sendGoal: jest.fn(),
    cancelGoal: jest.fn(),
  })),
};
